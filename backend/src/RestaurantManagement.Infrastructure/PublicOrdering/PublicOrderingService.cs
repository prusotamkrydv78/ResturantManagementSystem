using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Menu;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.PublicOrdering;

/// <summary>
/// Ordering from the code printed on a table.
///
/// Isolation here cannot work the way it works everywhere else, because there is nobody
/// signed in to derive a restaurant from. The token takes that job: it is looked up once,
/// and the table it resolves to supplies the restaurant for every read and write that
/// follows. No value out of the request is ever used to widen that, which is why a guest
/// cannot reach a second table, let alone a second restaurant.
///
/// A guest order is an ordinary order. It gets a readable number from the same sequence,
/// occupies the table the same way, appears in the waiter workspace and on the floor, and
/// is settled by the same billing. The only difference recorded is that no member of staff
/// placed it.
/// </summary>
public sealed class PublicOrderingService : IPublicOrderingService
{
    /// <summary>
    /// How many times to retry a colliding order number. The same bound the waiter side
    /// uses, because it is the same collision.
    /// </summary>
    private const int OrderNumberAttempts = 5;

    private readonly ApplicationDbContext _dbContext;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<PublicOrderingService> _logger;

    /// <summary>Creates the service.</summary>
    public PublicOrderingService(
        ApplicationDbContext dbContext,
        IRealtimeNotifier realtime,
        ILogger<PublicOrderingService> logger)
    {
        _dbContext = dbContext;
        _realtime = realtime;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<PublicTableResponse>> GetTableAsync(
        Guid staffUserId,
        string token,
        CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerRestaurantIdAsync(staffUserId, cancellationToken);

        if (caller is null)
        {
            return Result.Failure<PublicTableResponse>(PublicOrderingErrors.NotFound);
        }

        var table = await ResolveTableAsync(token, tracked: false, cancellationToken);

        if (table is null)
        {
            return Result.Failure<PublicTableResponse>(PublicOrderingErrors.NotFound);
        }

        // The token used to be the whole authorisation. Now that a session is required
        // as well, the two have to agree: a waiter holding a card from another
        // restaurant is refused, and told nothing about whether the code was real.
        if (table.RestaurantId != caller.Value)
        {
            return Result.Failure<PublicTableResponse>(PublicOrderingErrors.NotYourTable);
        }

        var menu = await MenuOfAsync(table.RestaurantId, cancellationToken);
        var running = await OpenOrderOfAsync(table, tracked: false, cancellationToken);

        // No gate here any more, and that is the point of the change. This pad used to
        // be a guest, who had to be kept out of a waiter order; the caller is now the
        // waiter, and whatever is running on this table belongs to the restaurant they
        // work at. Hiding it would leave them unable to add a second round to an order
        // they took themselves.

        return Result.Success(new PublicTableResponse(
            table.Restaurant.Name,
            table.Restaurant.Currency,
            table.Name,
            true,
            null,
            menu,
            running is null ? null : ToResponse(running)));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> PlaceOrderAsync(
        Guid staffUserId,
        string token,
        PlacePublicOrderRequest request,
        CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerRestaurantIdAsync(staffUserId, cancellationToken);

        if (caller is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // Tracked, because starting an order is what occupies the table. The same rule the
        // waiter path follows, reached through the same property.
        var table = await ResolveTableAsync(token, tracked: true, cancellationToken);

        if (table is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        if (table.RestaurantId != caller.Value)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotYourTable);
        }

        // Attributed to whoever scanned it, and recorded as a staff order rather than a
        // guest one. That is the whole change in this route: it used to be a guest
        // ordering for themselves, and it is now a member of staff standing at the table
        // with their own phone. Leaving it as "Guest at the table" would put a lie in
        // the answer to "who took this order".
        return await PlaceForTableAsync(
            table,
            request.Items,
            OrderSource.Staff,
            cancellationToken,
            staffUserId);
    }

    /// <inheritdoc />
    public async Task<Result<ScannedTableRestaurantResponse>> ResolveScannedRestaurantAsync(
        string token,
        CancellationToken cancellationToken)
    {
        if (!PublicOrderingToken.CouldBeValid(token))
        {
            return Result.Failure<ScannedTableRestaurantResponse>(
                PublicOrderingErrors.NotFound);
        }

        // Deliberately does not require the table to be open to guest ordering. Somebody
        // has scanned a printed code and needs to be sent somewhere; whether that table
        // takes guest orders is a question for the page they land on, not for the
        // redirect that gets them there.
        var found = await _dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table =>
                table.PublicOrderingToken == token &&
                table.IsActive &&
                table.Restaurant.IsActive)
            .Select(table => new ScannedTableRestaurantResponse(
                table.Restaurant.Slug,
                table.Restaurant.Name,
                table.Id,
                table.Name,
                // The order running on this table, if a customer placed it themselves.
                // This is what gets somebody back to their order after a flat battery
                // or a cleared browser: the printed code is the one thing they still
                // have, and it names exactly one table.
                //
                // Null for a waiter's order, which has no key, and null when the table
                // is free.
                _dbContext.Orders
                    .Where(order =>
                        order.TableId == table.Id &&
                        order.Status == OrderStatus.Open &&
                        order.PublicOrderKey != null)
                    .Select(order => order.PublicOrderKey)
                    .FirstOrDefault()))
            .SingleOrDefaultAsync(cancellationToken);

        return found is null
            ? Result.Failure<ScannedTableRestaurantResponse>(PublicOrderingErrors.NotFound)
            : Result.Success(found);
    }

    /// <inheritdoc />
    public async Task<Result<PublicRestaurantResponse>> GetRestaurantAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicRestaurantResponse>(PublicOrderingErrors.NotFound);
        }

        var menu = await MenuOfAsync(restaurant.Value.Id, cancellationToken);

        // Only tables the manager has opened to ordering. A table with its code switched
        // off is not offered on the website either: that switch is the one place a
        // manager says whether guests may order at a table at all, and having it mean
        // one thing for a scanned code and another for the website would be a trap.
        var tables = await _dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table =>
                table.RestaurantId == restaurant.Value.Id &&
                table.IsActive &&
                table.IsOrderingEnabled)
            .Select(table => new PublicTableChoiceResponse(
                table.Id,
                table.Name,
                table.Capacity,
                // Free means nothing open on it. Computed here rather than read off
                // TableStatus, because an order is what a customer would be joining and
                // the status is a separate thing a manager can also set by hand.
                !_dbContext.Orders.Any(order =>
                    order.TableId == table.Id && order.Status == OrderStatus.Open)))
            .ToListAsync(cancellationToken);

        // Ordered here rather than in the query, because the database sorts names as
        // text and a guest looking for table 10 would find it second, between 1 and 2.
        // See TableNameComparer.
        var ordered = tables
            .OrderBy(table => table.Name, TableNameComparer.Instance)
            .ToList();

        return Result.Success(new PublicRestaurantResponse(
            restaurant.Value.Name,
            restaurant.Value.Currency,
            menu,
            ordered,
            ordered.Count > 0));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> RequestBillAsync(
        string slug,
        RequestBillRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var key = Normalise(request.OrderKey);

        if (key is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // Tracked, because this one writes. The table is loaded for the name the waiter
        // is about to be shown, and the payments for whether anything is still owed.
        var order = await _dbContext.Orders
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(candidate => candidate.Payments)
            .Include(candidate => candidate.Table)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.PublicOrderKey == key &&
                    candidate.RestaurantId == restaurant.Value.Id,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var now = DateTimeOffset.UtcNow;

        // False only when the order has already been settled or called off, and asking
        // to pay a bill that is paid is a request that has been answered - reported as
        // success with the order as it stands, so a phone that lagged behind simply
        // catches up rather than showing an error about nothing.
        if (!order.TryRequestBill(now))
        {
            return Result.Success(ToResponse(order, order.PublicOrderKey));
        }

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Somebody moved the order underneath us, very likely a waiter settling it
            // at the counter at the same moment. Nothing is owed by the guest here.
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        _logger.LogInformation(
            "Table {TableName} asked for the bill on order {OrderNumber}, {Total} outstanding.",
            order.Table.Name,
            order.OrderNumber,
            order.AmountOutstanding);

        // After the save. A floor told to go and take a payment that then failed to
        // record would send a waiter to a table for nothing.
        await _realtime.BillRequestedAsync(
            restaurant.Value.Id,
            new BillRequestedEvent(
                order.Id,
                order.OrderNumber,
                order.Table.Name,
                order.Total),
            cancellationToken);

        return Result.Success(ToResponse(order, order.PublicOrderKey));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> LookupWebsiteOrderAsync(
        string slug,
        LookupWebsiteOrderRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var key = Normalise(request.OrderKey);

        if (key is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var order = await _dbContext.Orders
            .AsNoTracking()
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(candidate => candidate.Payments)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.PublicOrderKey == key &&
                    candidate.RestaurantId == restaurant.Value.Id,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // Only for a finished visit. An order still being eaten cannot have been
        // reviewed, so asking would be a query whose answer is always no.
        var reviewed = order.Status == OrderStatus.Completed &&
            await _dbContext.Reviews.AnyAsync(
                review => review.OrderId == order.Id,
                cancellationToken);

        // The key goes back with it. They already hold it - that is how they got here -
        // and returning it means the page can carry on treating the response as the one
        // source of what it knows, rather than stitching it together from two places.
        return Result.Success(ToResponse(order, order.PublicOrderKey, reviewed));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> PlaceWebsiteOrderAsync(
        string slug,
        PlaceWebsiteOrderRequest request,
        string? placedFromIp,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // The table is checked against this restaurant rather than trusted. It arrived in
        // the request body from an unauthenticated caller, which the token path never has
        // to deal with, so this is the one new thing that can be tampered with here.
        var table = await _dbContext.RestaurantTables
            .Include(candidate => candidate.Restaurant)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == request.TableId &&
                    candidate.RestaurantId == restaurant.Value.Id &&
                    candidate.IsActive &&
                    candidate.IsOrderingEnabled,
                cancellationToken);

        if (table is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var key = Normalise(request.OrderKey);

        // Adding to an order they already have. The key is what tells the person who
        // started it from a stranger claiming the table, so it is checked against the
        // table as well - a key must not be usable to put food on an order elsewhere in
        // the room.
        if (key is not null)
        {
            var existing = await _dbContext.Orders
                .Include(candidate => candidate.Items)
                    .ThenInclude(item => item.KitchenTicketItem)
                .Include(candidate => candidate.Payments)
                .SingleOrDefaultAsync(
                    candidate =>
                        candidate.PublicOrderKey == key &&
                        candidate.RestaurantId == restaurant.Value.Id &&
                        candidate.TableId == table.Id,
                    cancellationToken);

            if (existing is null)
            {
                return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
            }

            if (!existing.CanCustomerAddTo)
            {
                return Result.Failure<PublicOrderResponse>(
                    PublicOrderingErrors.CannotAddMore);
            }

            return await PlaceForTableAsync(
                table,
                request.Items,
                OrderSource.Website,
                cancellationToken,
                placedFromIp: placedFromIp);
        }

        // No key, so this is a first order and the table has to be free. A table picked
        // from a list on a website is a claim by a stranger, and joining them to another
        // party's bill is the one mistake here that costs real money.
        var running = await _dbContext.Orders.AnyAsync(
            order => order.TableId == table.Id && order.Status == OrderStatus.Open,
            cancellationToken);

        if (running)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.TableInUse);
        }

        return await PlaceForTableAsync(
            table,
            request.Items,
            OrderSource.Website,
            cancellationToken,
            placedFromIp: placedFromIp);
    }

    /// <summary>
    /// Takes an order for a table that has already been resolved and authorised.
    ///
    /// Shared by both ways in, and that sharing is the point: the pricing, the folding of
    /// identical lines, the per-line cap, the availability re-check and the seating of the
    /// table are one implementation. A second copy for the website would be a second place
    /// for a price to be trusted from a request.
    /// </summary>
    private async Task<Result<PublicOrderResponse>> PlaceForTableAsync(
        RestaurantTable table,
        List<CreateOrderItemRequest> items,
        OrderSource source,
        CancellationToken cancellationToken,
        Guid? placedByStaffId = null,
        string? placedFromIp = null)
    {
        var request = new PlacePublicOrderRequest { Items = items };

        // Identical lines are folded together, but a note is what makes one line different
        // from another, so two teas with different notes stay apart. Same rule as the
        // waiter path, for the same reason: a bill should read the way somebody ordered.
        var requested = request.Items
            .Where(line => line.Quantity > 0)
            .GroupBy(line => new { line.MenuItemId, Note = Normalise(line.Note) })
            .Select(group => new
            {
                group.Key.MenuItemId,
                group.Key.Note,
                Quantity = group.Sum(line => line.Quantity),
            })
            .ToList();

        if (requested.Count == 0)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NoItems);
        }

        // The per-line cap has to survive consolidation, or twenty requests of five would
        // walk straight past it.
        if (requested.Any(line => line.Quantity > OrderLimits.MaxQuantity))
        {
            return Result.Failure<PublicOrderResponse>(
                PublicOrderingErrors.ItemsUnavailable(
                    $"You cannot order more than {OrderLimits.MaxQuantity} of one thing at once."));
        }

        // Priced from our own menu, in this restaurant, in one query. Nothing in the
        // request contributes a name or an amount.
        var ids = requested.Select(line => line.MenuItemId).Distinct().ToList();

        var available = await AvailableItems(table.RestaurantId)
            .Where(item => ids.Contains(item.Id))
            .Select(item => new { item.Id, item.Name, item.Price })
            .ToListAsync(cancellationToken);

        var lookup = available.ToDictionary(item => item.Id);
        var missing = ids.Count(id => !lookup.ContainsKey(id));

        // Anything not found is inactive, hidden, or from another restaurant. All three
        // are refused identically, and the whole order goes back rather than half of it.
        if (missing > 0)
        {
            _logger.LogInformation(
                "Public order on table {TableId} rejected: {Count} item(s) not available.",
                table.Id,
                missing);

            return Result.Failure<PublicOrderResponse>(
                PublicOrderingErrors.ItemsUnavailable(
                    missing == 1
                        ? "One of the things you chose is no longer available. Please refresh the menu."
                        : "Some of the things you chose are no longer available. Please refresh the menu."));
        }

        // Appended to whatever is already open on the table, whoever started it. The
        // website path refuses a busy table outright before it reaches here, so the only
        // caller that gets this far is a member of staff adding to their own restaurant
        // order - which is exactly what a second round is.
        var running = await OpenOrderOfAsync(table, tracked: true, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var isNew = running is null;

        var order = running ?? new Order
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = table.RestaurantId,
            TableId = table.Id,
            Status = OrderStatus.Open,
            // Null for a website order, because nobody at the restaurant placed it and
            // filling in a placeholder staff account would be a lie that turns up later
            // in somebody's report. Set when a member of staff scanned the table, because
            // then somebody genuinely did.
            CreatedByStaffId = placedByStaffId,
            Source = source,
            // Snapshotted at the moment the order opens, so a rate change later in the
            // evening cannot rewrite a bill somebody has already been quoted.
            ServiceChargeRate = table.Restaurant.ServiceChargeRate,
            VatRate = table.Restaurant.VatRate,
            // Audit only. Never read back to identify anybody - see the property.
            PlacedFromIp = placedFromIp,
            // Every order gets one, not only the ones a customer started.
            //
            // A guest who sits down, orders through a waiter and then scans the code on
            // their table is the same person with the same order, and before this they
            // were shown a menu with their own table marked "in use" - told to scan the
            // code they had just scanned. The key is what the printed code hands back,
            // so an order without one is an order the table cannot reach.
            //
            // It grants no more than it did: following the order, and adding to it while
            // the kitchen has not been told. Anything a customer adds now needs agreeing
            // whoever opened the order - see Order.NeedsConfirmation.
            PublicOrderKey = NewOrderKey(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        // Captured before anything is added, so the total does not depend on whether the
        // change tracker has already fixed the new lines onto the navigation. It does,
        // as it happens, which is how the first version of this double-counted a second
        // round: the lines were on the collection and added again on top.
        var subtotal = isNew ? 0m : order.Items.Sum(item => item.LineTotal);

        foreach (var line in requested)
        {
            var menuItem = lookup[line.MenuItemId];

            var added = new OrderItem
            {
                Id = Guid.CreateVersion7(),
                OrderId = order.Id,
                MenuItemId = menuItem.Id,
                // Snapshots. From here the line stops depending on the menu, so a price
                // change tonight does not rewrite what somebody agreed to pay.
                ItemName = menuItem.Name,
                UnitPrice = menuItem.Price,
                Quantity = line.Quantity,
                Note = line.Note,
                LineTotal = menuItem.Price * line.Quantity,
                // Nobody at the restaurant is holding the device on this path unless a
                // member of staff scanned the table, which is what placedByStaffId says.
                AddedByCustomer = placedByStaffId is null,
                CreatedAtUtc = now,
            };

            if (isNew)
            {
                order.Items.Add(added);
            }
            else
            {
                // Added through the set rather than the navigation. On an order already
                // being tracked, adding through the navigation gets the new line marked
                // as modified instead of inserted, and the update then matches no row.
                _dbContext.OrderItems.Add(added);
            }

            subtotal += added.LineTotal;
        }

        order.RecalculateBill(subtotal);
        order.UpdatedAtUtc = now;

        // A customer adding to an order a waiter has already agreed withdraws that
        // agreement, and this is the load-bearing line of the whole add feature.
        //
        // Without it the confirmation gate is trivially defeated: order one thing, wait
        // for a waiter to come over and confirm it, then add whatever you like and it
        // rides into the kitchen on the back of an agreement about something else. The
        // waiter has to see the order again, because what they agreed is no longer what
        // it says.
        //
        // Only for a customer's own addition. A member of staff adding to an order is
        // themselves the agreement.
        //
        // No longer asks whether the order was customer-placed. A dessert added from a
        // phone to an order a waiter took still needs somebody to read it back, and
        // checking the order's origin let exactly that case through.
        if (!isNew && placedByStaffId is null)
        {
            order.ConfirmedAtUtc = null;
            order.ConfirmedByStaffId = null;
        }

        if (isNew)
        {
            // Seated from now until the bill is settled, exactly as when a waiter opens an
            // order. Only availability moves; whether the table is in service at all stays
            // the manager decision.
            if (table.Status != TableStatus.Occupied)
            {
                table.Status = TableStatus.Occupied;
                table.UpdatedAtUtc = now;
            }

            _dbContext.Orders.Add(order);

            if (!await SaveWithOrderNumberAsync(order, table.RestaurantId, cancellationToken))
            {
                return Result.Failure<PublicOrderResponse>(
                    PublicOrderingErrors.NumberUnavailable);
            }
        }
        else
        {
            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                // A waiter touched the order between the read and the write. Refused
                // rather than undoing their change; the guest can simply ask again.
                return Result.Failure<PublicOrderResponse>(
                    PublicOrderingErrors.NumberUnavailable);
            }
        }

        _logger.LogInformation(
            "Guest at table {TableId} {Action} order {OrderNumber} with {LineCount} line(s); " +
            "subtotal now {Subtotal}.",
            table.Id,
            isNew ? "opened" : "added to",
            order.OrderNumber,
            requested.Count,
            order.Subtotal);

        // Read back rather than projected from what is in memory. An appended order holds
        // its new lines in the change tracker rather than on the navigation, and a response
        // missing the line somebody just ordered is the one thing this page cannot do.
        var saved = await OpenOrderOfAsync(table, tracked: false, cancellationToken);

        // The floor is told whenever a customer was the one ordering - starting an
        // order or adding to one, and whoever opened it.
        //
        // It used to ask whether the *order* was customer-placed, which stopped being
        // the right question the moment a guest could add to an order a waiter typed:
        // the dessert correctly reopened the confirmation gate and held the food back,
        // and then nobody was told, so it sat there until somebody happened to reload.
        // The gate reads the lines; this has to read the same thing.
        //
        // A waiter's own order still announces nothing: they are holding the device
        // that made it, and reporting somebody's own action back to them is how a
        // product teaches people to ignore its notifications.
        if (placedByStaffId is null)
        {
            await _realtime.OrderPlacedAsync(
                table.RestaurantId,
                new OrderPlacedEvent(
                    order.Id,
                    order.OrderNumber,
                    table.Name,
                    (saved ?? order).Items.Sum(item => item.Quantity),
                    (saved ?? order).Subtotal),
                cancellationToken);
        }

        // Handed back on the order this call created, and again when its own holder adds
        // to it - they already have it, so returning it costs nothing and saves the page
        // from having to remember it across a response that omits it.
        //
        // Read off the order this call touched rather than off what came back, so a
        // member of staff appending to a customer's order never receives their key.
        return Result.Success(
            ToResponse(
                saved ?? order,
                placedByStaffId is null ? order.PublicOrderKey : null));
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// Turns a token into the one table it names, or nothing.
    ///
    /// The shape is checked before the database is asked, so a link somebody typed wrong
    /// or a probe made of junk never becomes a query. Beyond that there is one lookup, and
    /// it carries the whole permission: out of service and switched off are filtered here
    /// rather than reported, so every way of failing looks the same from outside.
    /// </summary>
    /// <summary>
    /// The restaurant an authenticated caller belongs to, whichever way they belong.
    ///
    /// Two different facts, because the two roles record it in different places: a staff
    /// account carries its restaurant, and a manager is named by the restaurant. Both
    /// are checked here so the scanned pad does not have to care which it is looking at,
    /// and an inactive account resolves to nothing at all.
    /// </summary>
    private async Task<Guid?> ResolveCallerRestaurantIdAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var staffRestaurantId = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == userId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.RestaurantId != null)
            .Select(user => user.RestaurantId)
            .SingleOrDefaultAsync(cancellationToken);

        if (staffRestaurantId is not null)
        {
            return staffRestaurantId;
        }

        var managed = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant =>
                restaurant.ManagerId == userId && restaurant.IsActive)
            .Select(restaurant => (Guid?)restaurant.Id)
            .SingleOrDefaultAsync(cancellationToken);

        return managed;
    }

    private async Task<(Guid Id, string Name, string Currency)?> ResolveRestaurantAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        var normalised = (slug ?? string.Empty).Trim().ToLowerInvariant();

        if (normalised.Length == 0)
        {
            return null;
        }

        var found = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.Slug == normalised && restaurant.IsActive)
            .Select(restaurant => new { restaurant.Id, restaurant.Name, restaurant.Currency })
            .SingleOrDefaultAsync(cancellationToken);

        return found is null ? null : (found.Id, found.Name, found.Currency);
    }

    private async Task<RestaurantTable?> ResolveTableAsync(
        string token,
        bool tracked,
        CancellationToken cancellationToken)
    {
        if (!PublicOrderingToken.CouldBeValid(token))
        {
            return null;
        }

        var query = _dbContext.RestaurantTables
            .Include(table => table.Restaurant)
            .Where(table =>
                table.PublicOrderingToken == token &&
                table.IsActive &&
                table.IsOrderingEnabled &&
                // A suspended restaurant is filtered here with the rest, so the link
                // simply stops working. A guest holding a printed code is owed a dead
                // page, not an explanation of the restaurant commercial standing.
                table.Restaurant.IsActive);

        return tracked
            ? await query.SingleOrDefaultAsync(cancellationToken)
            : await query.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// The order currently running on this table, if any.
    ///
    /// Filtered by the restaurant as well as the table even though the table came from our
    /// own lookup. It costs nothing, and it means no query in this file can widen if the
    /// resolution above ever changes.
    /// </summary>
    private async Task<Order?> OpenOrderOfAsync(
        RestaurantTable table,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Orders
            .Where(order =>
                order.RestaurantId == table.RestaurantId &&
                order.TableId == table.Id &&
                order.Status == OrderStatus.Open)
            .Include(order => order.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .OrderByDescending(order => order.CreatedAtUtc);

        return tracked
            ? await query.FirstOrDefaultAsync(cancellationToken)
            : await query.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// The menu a guest may order from, grouped as the restaurant groups it.
    ///
    /// Availability is the same definition the waiter workspace uses: an active item in an
    /// active section. A guest must never be shown something a waiter could not order, and
    /// the create path re-checks it anyway rather than trusting that it was not shown.
    /// </summary>
    private async Task<IReadOnlyList<PublicMenuSectionResponse>> MenuOfAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var sections = await _dbContext.MenuCategories
            .AsNoTracking()
            .Where(category => category.RestaurantId == restaurantId && category.IsActive)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .Select(category => new PublicMenuSectionResponse(
                category.Name,
                category.Items
                    .Where(item => item.IsActive)
                    .OrderBy(item => item.Name)
                    // Projected, so the picture's bytes are never loaded here. Only
                    // the stamp is read, and it is all the URL needs.
                    .Select(item => new PublicMenuItemResponse(
                        item.Id,
                        item.Name,
                        item.Description,
                        item.Price,
                        MenuItemImage.UrlFor(item.Id, item.ImageUpdatedAtUtc)))
                    .ToList(),
                MenuCategoryImage.UrlFor(category.Id, category.ImageUpdatedAtUtc)))
            .ToListAsync(cancellationToken);

        // An empty section is a heading with nothing under it, which on a phone reads as
        // something having failed to load.
        return sections.Where(section => section.Items.Count > 0).ToList();
    }

    private IQueryable<Domain.Menu.MenuItem> AvailableItems(Guid restaurantId) =>
        _dbContext.MenuItems.Where(item =>
            item.RestaurantId == restaurantId &&
            item.IsActive &&
            item.Category.IsActive);

    /// <summary>
    /// Saves a new order, claiming the next readable number for the restaurant.
    ///
    /// The same approach the waiter side takes: derive from the current maximum, let the
    /// unique index turn a race into a failed insert, and take the next one. A guest and a
    /// waiter submitting in the same instant is exactly the case this handles.
    /// </summary>
    private async Task<bool> SaveWithOrderNumberAsync(
        Order order,
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= OrderNumberAttempts; attempt++)
        {
            var highest = await _dbContext.Orders
                .AsNoTracking()
                .Where(existing => existing.RestaurantId == restaurantId)
                .MaxAsync(existing => (int?)existing.OrderNumber, cancellationToken);

            order.OrderNumber = (highest ?? 0) + 1;

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
                return true;
            }
            catch (DbUpdateException) when (attempt < OrderNumberAttempts)
            {
                _logger.LogInformation(
                    "Order number {Number} was taken in restaurant {RestaurantId}; retrying.",
                    order.OrderNumber,
                    restaurantId);
            }
        }

        return false;
    }

    /// <summary>
    /// An order as its customer sees it.
    /// </summary>
    /// <param name="order">The order to describe.</param>
    /// <param name="orderKey">
    /// The key to hand back, or null on every read. Passed in rather than read off the
    /// order, so a route has to decide to give it away and cannot do so by forgetting.
    /// </param>
    /// <param name="hasReview">
    /// Whether this visit has already been reviewed.
    ///
    /// Passed in rather than read off a navigation, because only the one path that
    /// serves a finished order needs to ask - and making every place path run that
    /// query to answer "no" about an order still being eaten would be waste.
    /// </param>
    private static PublicOrderResponse ToResponse(
        Order order,
        string? orderKey = null,
        bool hasReview = false)
    {
        var lines = order.Items
            .OrderBy(item => item.CreatedAtUtc)
            .ThenBy(item => item.ItemName)
            .Select(item => new PublicOrderLineResponse(
                item.ItemName,
                item.Quantity,
                item.Note,
                item.LineTotal,
                item.IsSubmittedToKitchen,
                // Read off the kitchen's own line rather than inferred from the
                // ticket, so the guest is told exactly what the chef ticked.
                item.KitchenTicketItem?.ReadyAtUtc != null,
                item.KitchenTicketItem?.ServedAtUtc != null))
            .ToList();

        return new PublicOrderResponse(
            order.OrderNumber,
            lines,
            order.Items.Sum(item => item.Quantity),
            order.Subtotal,
            order.ServiceChargeAmount,
            order.VatAmount,
            order.Total,
            order.Items
                .Where(item => !item.IsSubmittedToKitchen)
                .Sum(item => item.Quantity),
            order.CreatedAtUtc,
            order.BillRequestedAtUtc,
            order.CanRequestBill,
            order.Status == OrderStatus.Completed,
            order.Status == OrderStatus.Completed && !hasReview,
            order.CanCustomerAddTo,
            orderKey);
    }

    /// <summary>
    /// A fresh key for a customer to hold.
    ///
    /// Hex of 16 cryptographic bytes: 32 characters, which is what the column allows, and
    /// 128 bits of entropy, which is not going to be guessed. Hex rather than base64 so
    /// it survives a URL, a copy and paste and a phone keyboard unchanged.
    /// </summary>
    private static string NewOrderKey() =>
        Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
