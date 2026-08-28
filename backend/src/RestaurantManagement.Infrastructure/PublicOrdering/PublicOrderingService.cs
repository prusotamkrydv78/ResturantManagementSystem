using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
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
        string token,
        CancellationToken cancellationToken)
    {
        var table = await ResolveTableAsync(token, tracked: false, cancellationToken);

        if (table is null)
        {
            return Result.Failure<PublicTableResponse>(PublicOrderingErrors.NotFound);
        }

        var menu = await MenuOfAsync(table.RestaurantId, cancellationToken);
        var running = await OpenOrderOfAsync(table, tracked: false, cancellationToken);

        // A staff order on this table is not the guest order, and is not shown through a
        // public link. What they get told instead is to speak to the person serving them.
        var isStaffOrder = running is not null && !running.IsSelfService;

        return Result.Success(new PublicTableResponse(
            table.Restaurant.Name,
            table.Name,
            !isStaffOrder,
            isStaffOrder ? PublicOrderingErrors.StaffServing.Message : null,
            menu,
            isStaffOrder || running is null ? null : ToResponse(running)));
    }

    /// <inheritdoc />
    public async Task<Result<PublicOrderResponse>> PlaceOrderAsync(
        string token,
        PlacePublicOrderRequest request,
        CancellationToken cancellationToken)
    {
        // Tracked, because starting an order is what occupies the table. The same rule the
        // waiter path follows, reached through the same property.
        var table = await ResolveTableAsync(token, tracked: true, cancellationToken);

        if (table is null)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.NotFound);
        }

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

        var running = await OpenOrderOfAsync(table, tracked: true, cancellationToken);

        if (running is not null && !running.IsSelfService)
        {
            return Result.Failure<PublicOrderResponse>(PublicOrderingErrors.StaffServing);
        }

        var now = DateTimeOffset.UtcNow;
        var isNew = running is null;

        var order = running ?? new Order
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = table.RestaurantId,
            TableId = table.Id,
            Status = OrderStatus.Open,
            // Nobody placed this. Left null rather than filled with a placeholder staff
            // account, because attributing a guest order to a member of staff is a lie
            // that turns up later in somebody report.
            CreatedByStaffId = null,
            Source = OrderSource.QrCode,
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

        return Result.Success(ToResponse(saved ?? order));
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
                    .Select(item => new PublicMenuItemResponse(
                        item.Id,
                        item.Name,
                        item.Description,
                        item.Price))
                    .ToList()))
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

    private static PublicOrderResponse ToResponse(Order order)
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
            order.CreatedAtUtc);
    }

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
