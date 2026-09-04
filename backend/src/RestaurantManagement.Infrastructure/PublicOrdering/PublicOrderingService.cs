using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
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
    private readonly ILogger<PublicOrderingService> _logger;

    /// <summary>Creates the service.</summary>
    public PublicOrderingService(
        ApplicationDbContext dbContext,
        ILogger<PublicOrderingService> logger)
    {
        _dbContext = dbContext;
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
                table.Name))
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
            .OrderBy(table => table.Name)
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

        return Result.Success(new PublicRestaurantResponse(
            restaurant.Value.Name,
            menu,
            tables,
            tables.Count > 0));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> PlaceWebsiteOrderAsync(
        string slug,
        PlaceWebsiteOrderRequest request,
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

        // Refused rather than appended to, which is where this path parts company with a
        // scanned code. Somebody holding the code on a table is sitting at it, so a second
        // round is almost certainly the same party. A table picked from a list on a
        // website is a claim by a stranger, and adding them to somebody else's bill is the
        // one mistake here that costs real money.
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
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> CancelWebsiteOrderAsync(
        string slug,
        CancelWebsiteOrderRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        var key = Normalise(request.CancelKey);

        if (key is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // Scoped to the restaurant in the URL as well as to the key. The key alone would
        // be enough - it is unique across the table and unguessable - but scoping costs
        // one clause and means a key can never act outside the restaurant it came from.
        //
        // The payment and the kitchen line of every item are loaded deliberately: both
        // feed the decision below, and a navigation that was never loaded reads as
        // "nothing here", which would turn every refusal into an approval.
        var order = await _dbContext.Orders
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(candidate => candidate.Payment)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.PublicCancelKey == key &&
                    candidate.RestaurantId == restaurant.Value.Id,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

        // Already cancelled reads as done rather than as a failure. A customer who taps
        // the button twice, or whose first request succeeded on a connection that dropped
        // before the answer arrived, has got what they asked for.
        if (order.Status == OrderStatus.Cancelled)
        {
            return Result.Success(ToResponse(order));
        }

        if (!order.CanGuestCancel)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.CannotCancel);
        }

        var now = DateTimeOffset.UtcNow;

        // No user id, because there is no account behind this and naming a member of
        // staff would put a lie in the record. The reason carries who it was instead,
        // which is what anybody reading the order back actually wants to know.
        if (!order.TryCancel(null, "Cancelled by the customer before it reached the kitchen.", now))
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.CannotCancel);
        }

        // Spent. Nothing else can be done with this order, and leaving a live key on a
        // dead order is a capability with no purpose.
        order.PublicCancelKey = null;

        await ReleaseTableAsync(order, now, cancellationToken);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Somebody at the restaurant touched the order between the read and the
            // write, which is very likely them sending it to the kitchen. Refusing is
            // the right answer to that race, and it is the same answer they would get
            // from the check above a second later.
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.CannotCancel);
        }

        _logger.LogInformation(
            "Customer cancelled website order {OrderNumber} worth {Subtotal} on table {TableId}.",
            order.OrderNumber,
            order.Subtotal,
            order.TableId);

        return Result.Success(ToResponse(order));
    }

    /// <summary>
    /// Puts the table back into service when the order leaving is the last one on it.
    ///
    /// Availability only. Whether the table is in service at all is the manager decision
    /// and is left exactly as it was.
    /// </summary>
    private async Task ReleaseTableAsync(
        Order order,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var stillBusy = await _dbContext.Orders.AnyAsync(
            candidate =>
                candidate.TableId == order.TableId &&
                candidate.Id != order.Id &&
                candidate.Status == OrderStatus.Open,
            cancellationToken);

        if (stillBusy)
        {
            return;
        }

        var table = await _dbContext.RestaurantTables.SingleOrDefaultAsync(
            candidate => candidate.Id == order.TableId,
            cancellationToken);

        if (table is null || table.Status == TableStatus.Available)
        {
            return;
        }

        table.Status = TableStatus.Available;
        table.UpdatedAtUtc = now;
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
        Guid? placedByStaffId = null)
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
            // Only a website order gets one. A member of staff cancels through billing,
            // as themselves, and minting a key nobody is ever given would be a live
            // capability sitting in a column for no reason.
            PublicCancelKey = source == OrderSource.Website ? NewCancelKey() : null,
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

        order.Subtotal = subtotal;
        order.UpdatedAtUtc = now;

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

        // The one moment the key is ever handed out. Read off the order this call
        // created rather than off what came back, so appending to an order that was
        // already there cannot hand out the key belonging to it.
        return Result.Success(
            ToResponse(saved ?? order, isNew ? order.PublicCancelKey : null));
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

    private async Task<(Guid Id, string Name)?> ResolveRestaurantAsync(
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
            .Select(restaurant => new { restaurant.Id, restaurant.Name })
            .SingleOrDefaultAsync(cancellationToken);

        return found is null ? null : (found.Id, found.Name);
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
    /// <param name="cancelKey">
    /// The key to hand back, or null on every read. Passed in rather than read off the
    /// order, so a route has to decide to give it away and cannot do so by forgetting.
    /// </param>
    private static PublicOrderResponse ToResponse(Order order, string? cancelKey = null)
    {
        var lines = order.Items
            .OrderBy(item => item.CreatedAtUtc)
            .ThenBy(item => item.ItemName)
            .Select(item => new PublicOrderLineResponse(
                item.ItemName,
                item.Quantity,
                item.Note,
                item.LineTotal,
                item.IsSubmittedToKitchen))
            .ToList();

        return new PublicOrderResponse(
            order.OrderNumber,
            lines,
            order.Items.Sum(item => item.Quantity),
            order.Subtotal,
            order.Items
                .Where(item => !item.IsSubmittedToKitchen)
                .Sum(item => item.Quantity),
            order.CreatedAtUtc,
            order.CanGuestCancel,
            cancelKey);
    }

    /// <summary>
    /// A fresh key for a customer to hold.
    ///
    /// Hex of 16 cryptographic bytes: 32 characters, which is what the column allows, and
    /// 128 bits of entropy, which is not going to be guessed. Hex rather than base64 so
    /// it survives a URL, a copy and paste and a phone keyboard unchanged.
    /// </summary>
    private static string NewCancelKey() =>
        Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
