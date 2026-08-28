using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Orders;

/// <summary>
/// The waiter ordering workflow.
///
/// Isolation works the way it does elsewhere: the restaurant is derived from the
/// authenticated staff member and every read and write is filtered by it, so a
/// table, item or order identifier from another restaurant simply does not resolve.
/// </summary>
public sealed class OrderService : IOrderService
{
    /// <summary>
    /// How many times to retry a colliding order number before giving up. Two
    /// waiters submitting at the same instant is normal; more than a handful of
    /// consecutive collisions means something else is wrong.
    /// </summary>
    private const int OrderNumberAttempts = 5;

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<OrderService> _logger;
    private readonly IStockConsumption _stock;

    /// <summary>Creates the service.</summary>
    public OrderService(
        ApplicationDbContext dbContext,
        ILogger<OrderService> logger,
        IStockConsumption stock)
    {
        _dbContext = dbContext;
        _logger = logger;
        _stock = stock;
    }

    /// <inheritdoc />
    public async Task<Result<WaiterContextResponse>> GetContextAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<WaiterContextResponse>(OrderErrors.NotAnActiveWaiter);
        }

        var restaurantId = waiter.Value.RestaurantId;

        var restaurantName = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.Id == restaurantId)
            .Select(restaurant => restaurant.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var activeTables = await _dbContext.RestaurantTables
            .AsNoTracking()
            .CountAsync(
                table => table.RestaurantId == restaurantId && table.IsActive,
                cancellationToken);

        var availableItems = await AvailableItems(restaurantId)
            .CountAsync(cancellationToken);

        return Result.Success(new WaiterContextResponse(
            restaurantName ?? string.Empty,
            activeTables,
            availableItems));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<WaiterTableResponse>>> GetTablesAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<IReadOnlyList<WaiterTableResponse>>(
                OrderErrors.NotAnActiveWaiter);
        }

        // Only tables in service. An out-of-service table is never offered, and the
        // create path checks again rather than trusting that it was not offered.
        var tables = await _dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table =>
                table.RestaurantId == waiter.Value.RestaurantId && table.IsActive)
            .OrderBy(table => table.Name)
            .Select(table => new WaiterTableResponse(table.Id, table.Name, table.Capacity))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<WaiterTableResponse>>(tables);
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<WaiterMenuCategoryResponse>>> GetMenuAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<IReadOnlyList<WaiterMenuCategoryResponse>>(
                OrderErrors.NotAnActiveWaiter);
        }

        var restaurantId = waiter.Value.RestaurantId;

        var rows = await _dbContext.MenuCategories
            .AsNoTracking()
            .Where(category => category.RestaurantId == restaurantId && category.IsActive)
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .Select(category => new
            {
                category.Id,
                category.Name,
                Items = category.Items
                    .Where(item => item.IsActive)
                    .OrderBy(item => item.Name)
                    .Select(item => new WaiterMenuItemResponse(
                        item.Id,
                        item.Name,
                        item.Description,
                        item.Price))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // A category with nothing orderable in it is noise on an ordering screen.
        var categories = rows
            .Where(row => row.Items.Count > 0)
            .Select(row => new WaiterMenuCategoryResponse(row.Id, row.Name, row.Items))
            .ToList();

        return Result.Success<IReadOnlyList<WaiterMenuCategoryResponse>>(categories);
    }

    /// <inheritdoc />
    public async Task<Result<OrderResponse>> CreateAsync(
        Guid staffUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotAnActiveWaiter);
        }

        var restaurantId = waiter.Value.RestaurantId;

        // The table must be ours and in service. Checked again here even though the
        // list endpoint already filters, because the request is not to be trusted.
        //
        // Tracked rather than projected, because placing an order is what occupies a
        // table. Occupancy has always belonged to the ordering system rather than to
        // a manager toggle, and this is the half that makes billing releasing the
        // table at closure mean anything.
        var table = await _dbContext.RestaurantTables
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == request.TableId &&
                    candidate.RestaurantId == restaurantId &&
                    candidate.IsActive,
                cancellationToken);

        if (table is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.TableUnavailable);
        }

        // Identical items are folded together, but the note is what distinguishes
        // one line from another, so lines with different notes stay separate.
        var requested = request.Items
            .Where(line => line.Quantity > 0)
            .GroupBy(line => new
            {
                line.MenuItemId,
                Note = Normalise(line.Note),
            })
            .Select(group => new
            {
                group.Key.MenuItemId,
                group.Key.Note,
                Quantity = group.Sum(line => line.Quantity),
            })
            .ToList();

        if (requested.Count == 0)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NoItems);
        }

        // One quantity cap per line survives consolidation too, otherwise five
        // requests of twenty would slip past the per-line bound.
        var overLimit = requested.FirstOrDefault(line => line.Quantity > OrderLimits.MaxQuantity);

        if (overLimit is not null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.ItemsUnavailable(
                $"A single line cannot exceed {OrderLimits.MaxQuantity}."));
        }

        // Load every requested item from our own available menu in one query. The
        // price and name used below come from here, never from the request.
        var ids = requested.Select(line => line.MenuItemId).Distinct().ToList();

        var available = await AvailableItems(restaurantId)
            .Where(item => ids.Contains(item.Id))
            .Select(item => new { item.Id, item.Name, item.Price })
            .ToListAsync(cancellationToken);

        var lookup = available.ToDictionary(item => item.Id);

        // Anything missing is either inactive, in a hidden category, or from another
        // restaurant. All three are refused the same way, and the whole order is
        // rejected rather than partially created.
        var missing = ids.Where(id => !lookup.ContainsKey(id)).ToList();

        if (missing.Count > 0)
        {
            _logger.LogInformation(
                "Order rejected for waiter {StaffId}: {Count} item(s) not available.",
                staffUserId,
                missing.Count);

            return Result.Failure<OrderResponse>(OrderErrors.ItemsUnavailable(
                missing.Count == 1
                    ? "One of the items is no longer available. Refresh the menu and try again."
                    : $"{missing.Count} of the items are no longer available. Refresh the menu and try again."));
        }

        var now = DateTimeOffset.UtcNow;

        var order = new Order
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId,
            TableId = table.Id,
            Status = OrderStatus.Open,
            CreatedByStaffId = staffUserId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        foreach (var line in requested)
        {
            var menuItem = lookup[line.MenuItemId];

            order.Items.Add(new OrderItem
            {
                Id = Guid.CreateVersion7(),
                OrderId = order.Id,
                MenuItemId = menuItem.Id,
                // Snapshots. From this point the line no longer depends on the menu.
                ItemName = menuItem.Name,
                UnitPrice = menuItem.Price,
                Quantity = line.Quantity,
                Note = line.Note,
                LineTotal = menuItem.Price * line.Quantity,
                CreatedAtUtc = now,
            });
        }

        order.Subtotal = order.Items.Sum(item => item.LineTotal);

        // Seated from now until the bill is settled. Only availability moves here;
        // whether the table is in service at all stays the manager decision.
        if (table.Status != Domain.Restaurants.TableStatus.Occupied)
        {
            table.Status = Domain.Restaurants.TableStatus.Occupied;
            table.UpdatedAtUtc = now;
        }

        _dbContext.Orders.Add(order);

        var saved = await SaveWithOrderNumberAsync(order, restaurantId, cancellationToken);

        if (!saved)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NumberUnavailable);
        }

        _logger.LogInformation(
            "Waiter {StaffId} placed order {OrderNumber} on table {TableId} " +
            "with {LineCount} line(s) totalling {Subtotal}.",
            staffUserId,
            order.OrderNumber,
            table.Id,
            order.Items.Count,
            order.Subtotal);

        return Result.Success(ToResponse(order, table.Name, waiter.Value.FullName));
    }

    /// <inheritdoc />
    public async Task<Result<OrderResponse>> GetByIdAsync(
        Guid staffUserId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotAnActiveWaiter);
        }

        var order = await _dbContext.Orders
            .AsNoTracking()
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
                    .ThenInclude(ticketItem => ticketItem!.KitchenTicket)
            .Include(candidate => candidate.Table)
            .Include(candidate => candidate.KitchenTickets)
                .ThenInclude(ticket => ticket.Items)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == orderId &&
                    candidate.RestaurantId == waiter.Value.RestaurantId,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotFound);
        }

        var placedBy = await NameOfStaffAsync(order.CreatedByStaffId, cancellationToken);

        return Result.Success(ToResponse(
            order,
            order.Table.Name,
            OrderAttribution.PlacedBy(order, placedBy)));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<OrderSummaryResponse>>> GetOpenAsync(
        Guid staffUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<IReadOnlyList<OrderSummaryResponse>>(
                OrderErrors.NotAnActiveWaiter);
        }

        // Restaurant-wide rather than per waiter: whoever is on the floor needs to
        // be able to pick up an open table. Who placed it is still shown.
        var orders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == waiter.Value.RestaurantId &&
                order.Status == OrderStatus.Open)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Take(Math.Clamp(limit, 1, 100))
            .Select(order => new OrderSummaryResponse(
                order.Id,
                order.OrderNumber,
                order.Status,
                order.Table.Name,
                order.Subtotal,
                order.Items.Sum(item => item.Quantity),
                // Written out rather than calling the shared helper, because this
                // projection runs in SQL. The two constants are the same ones.
                order.CreatedByStaffId == null
                    ? OrderAttribution.Guest
                    : _dbContext.Users
                        .Where(user => user.Id == order.CreatedByStaffId)
                        .Select(user => user.FullName)
                        .FirstOrDefault() ?? OrderAttribution.Unknown,
                // Counted from the absence of a ticket line rather than a flag, so
                // the list and the order detail can never disagree.
                order.Items
                    .Where(item => item.KitchenTicketItem == null)
                    .Sum(item => item.Quantity),
                order.KitchenTickets.Count,
                order.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<OrderSummaryResponse>>(orders);
    }

    /// <inheritdoc />
    public async Task<Result<OrderResponse>> UpdateAsync(
        Guid staffUserId,
        Guid orderId,
        UpdateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotAnActiveWaiter);
        }

        var restaurantId = waiter.Value.RestaurantId;

        var order = await _dbContext.Orders
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(candidate => candidate.Table)
            .Include(candidate => candidate.KitchenTickets)
                .ThenInclude(ticket => ticket.Items)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == orderId && candidate.RestaurantId == restaurantId,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotFound);
        }

        // The single rule about who may change what, asked of the entity.
        if (!order.IsEditable)
        {
            return Result.Failure<OrderResponse>(OrderErrors.NotEditable);
        }

        // Refuse a save built on a stale copy before doing any work.
        if (!string.IsNullOrWhiteSpace(request.RowVersion) &&
            !MatchesRowVersion(order.RowVersion, request.RowVersion))
        {
            return Result.Failure<OrderResponse>(OrderErrors.Conflict);
        }

        /* ---- 1. Existing lines: quantity and note only ---- */

        var submitted = request.Lines
            .GroupBy(line => line.Id)
            .Select(group => group.Last())
            .ToDictionary(line => line.Id);

        // A line id that is not on this order means the client is working from
        // something other than this order. Refuse rather than guess.
        if (submitted.Keys.Any(id => order.Items.All(item => item.Id != id)))
        {
            return Result.Failure<OrderResponse>(OrderErrors.LineNotFound);
        }

        var keptLines = new List<OrderItem>();

        foreach (var existing in order.Items.ToList())
        {
            // A line already on a kitchen ticket is history. It cannot be changed or
            // removed, and the request is refused rather than partly applied so the
            // waiter is told instead of silently losing the edit.
            if (existing.IsSubmittedToKitchen)
            {
                if (!submitted.TryGetValue(existing.Id, out var sentLine))
                {
                    // Absent from the request, which would mean removing it.
                    return Result.Failure<OrderResponse>(OrderErrors.SubmittedItemLocked);
                }

                if (sentLine.Quantity != existing.Quantity ||
                    Normalise(sentLine.Note) != existing.Note)
                {
                    return Result.Failure<OrderResponse>(OrderErrors.SubmittedItemLocked);
                }

                keptLines.Add(existing);
                continue;
            }

            if (!submitted.TryGetValue(existing.Id, out var line))
            {
                // Left out of the request, so the waiter removed it.
                _dbContext.OrderItems.Remove(existing);
                continue;
            }

            // Quantity and note are the only things that move. ItemName and
            // UnitPrice keep the values captured when the line was created, so a
            // later menu price change never reaches back into this order.
            existing.Quantity = line.Quantity;
            existing.Note = Normalise(line.Note);
            existing.LineTotal = existing.UnitPrice * line.Quantity;

            keptLines.Add(existing);
        }

        /* ---- 2. New items: validated against the live menu, fresh snapshots ---- */

        var additions = request.NewItems
            .Where(line => line.Quantity > 0)
            .GroupBy(line => new { line.MenuItemId, Note = Normalise(line.Note) })
            .Select(group => new
            {
                group.Key.MenuItemId,
                group.Key.Note,
                Quantity = group.Sum(line => line.Quantity),
            })
            .ToList();

        if (additions.Count > 0)
        {
            var ids = additions.Select(line => line.MenuItemId).Distinct().ToList();

            // Same availability definition as order creation, reused rather than
            // restated, so the two can never disagree.
            var available = await AvailableItems(restaurantId)
                .Where(item => ids.Contains(item.Id))
                .Select(item => new { item.Id, item.Name, item.Price })
                .ToListAsync(cancellationToken);

            var lookup = available.ToDictionary(item => item.Id);
            var missing = ids.Count(id => !lookup.ContainsKey(id));

            if (missing > 0)
            {
                return Result.Failure<OrderResponse>(OrderErrors.ItemsUnavailable(
                    missing == 1
                        ? "One of the items is no longer available. Refresh the menu and try again."
                        : $"{missing} of the items are no longer available. Refresh the menu and try again."));
            }

            var now = DateTimeOffset.UtcNow;

            foreach (var addition in additions)
            {
                var menuItem = lookup[addition.MenuItemId];

                // Folding a new item into an existing line is only safe when the line
                // is still unsubmitted and its stored price matches the live one.
                //
                // A submitted line is never touched: a burger sent to the kitchen at
                // 500 stays a line of its own, and another burger ordered after a
                // price change becomes a separate line at the new price. If the price
                // has moved, unsubmitted lines stay apart too, since merging would
                // either rewrite the historical price or quietly sell the new units
                // at the old one. Snapshot integrity wins over a tidier list.
                var mergeable = keptLines.FirstOrDefault(line =>
                    !line.IsSubmittedToKitchen &&
                    line.MenuItemId == menuItem.Id &&
                    line.Note == addition.Note &&
                    line.UnitPrice == menuItem.Price);

                if (mergeable is not null)
                {
                    var combined = mergeable.Quantity + addition.Quantity;

                    if (combined > OrderLimits.MaxQuantity)
                    {
                        return Result.Failure<OrderResponse>(OrderErrors.ItemsUnavailable(
                            $"A single line cannot exceed {OrderLimits.MaxQuantity}."));
                    }

                    mergeable.Quantity = combined;
                    mergeable.LineTotal = mergeable.UnitPrice * combined;
                    continue;
                }

                var added = new OrderItem
                {
                    Id = Guid.CreateVersion7(),
                    OrderId = order.Id,
                    MenuItemId = menuItem.Id,
                    // A fresh snapshot at today prices, independent of any older
                    // line for the same item.
                    ItemName = menuItem.Name,
                    UnitPrice = menuItem.Price,
                    Quantity = addition.Quantity,
                    Note = addition.Note,
                    LineTotal = menuItem.Price * addition.Quantity,
                    CreatedAtUtc = now,
                };

                // Added through the set, not only through the navigation.
                //
                // A Guid key is store-generated by convention, so an entity that
                // already carries one and is merely discovered hanging off a tracked
                // parent is assumed to exist already and marked Modified. EF then
                // issues an UPDATE that matches no row, and the save fails as a
                // concurrency conflict, which is the opposite of what happened.
                // Creation avoids this by accident, because adding the order itself
                // marks the whole graph as new.
                // Added through the set rather than through the navigation.
                //
                // A Guid key is store-generated by convention, so a line that already
                // carries one and is merely discovered hanging off a tracked order is
                // assumed to exist already and marked Modified. EF then issues an
                // UPDATE that matches no row and the save fails as a concurrency
                // conflict, which is the opposite of what happened. Creating an order
                // avoids this by accident, because adding the order itself marks the
                // whole graph as new.
                //
                // Tracking it also fixes up the order navigation, so it must not be
                // added there by hand as well or the collection would hold it twice
                // and the response would report a line that does not exist.
                _dbContext.OrderItems.Add(added);
                keptLines.Add(added);
            }
        }

        /* ---- 3. An order always has something on it ---- */

        if (keptLines.Count == 0)
        {
            // Removing the last line is not a way to delete an order. Cancellation
            // is a separate decision and does not exist yet.
            return Result.Failure<OrderResponse>(OrderErrors.NoItems);
        }

        /* ---- 4. Totals, recalculated from our own figures ---- */

        order.Subtotal = keptLines.Sum(line => line.LineTotal);
        order.UpdatedAtUtc = DateTimeOffset.UtcNow;

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Someone saved between our read and our write.
            return Result.Failure<OrderResponse>(OrderErrors.Conflict);
        }

        _logger.LogInformation(
            "Waiter {StaffId} updated order {OrderNumber}: {LineCount} line(s), total {Subtotal}.",
            staffUserId,
            order.OrderNumber,
            keptLines.Count,
            order.Subtotal);

        var placedBy = await NameOfStaffAsync(order.CreatedByStaffId, cancellationToken);

        return Result.Success(ToResponse(
            order,
            order.Table.Name,
            OrderAttribution.PlacedBy(order, placedBy)));
    }

    /// <inheritdoc />
    public async Task<Result<SubmitToKitchenResponse>> SubmitToKitchenAsync(
        Guid staffUserId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var waiter = await ResolveWaiterAsync(staffUserId, cancellationToken);

        if (waiter is null)
        {
            return Result.Failure<SubmitToKitchenResponse>(OrderErrors.NotAnActiveWaiter);
        }

        var restaurantId = waiter.Value.RestaurantId;

        var order = await _dbContext.Orders
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(candidate => candidate.Table)
            .Include(candidate => candidate.KitchenTickets)
                .ThenInclude(ticket => ticket.Items)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == orderId && candidate.RestaurantId == restaurantId,
                cancellationToken);

        if (order is null)
        {
            return Result.Failure<SubmitToKitchenResponse>(OrderErrors.NotFound);
        }

        if (!order.IsEditable)
        {
            return Result.Failure<SubmitToKitchenResponse>(OrderErrors.NotEditable);
        }

        // Everything not already on a ticket goes out together as one submission.
        // Not a ticket per item: the kitchen wants one slip per trip to the pass.
        var pending = order.Items
            .Where(item => !item.IsSubmittedToKitchen)
            .OrderBy(item => item.ItemName)
            .ToList();

        if (pending.Count == 0)
        {
            return Result.Failure<SubmitToKitchenResponse>(OrderErrors.NothingToSubmit);
        }

        var now = DateTimeOffset.UtcNow;

        var ticket = new KitchenTicket
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId,
            OrderId = order.Id,
            Status = KitchenTicketStatus.Pending,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        foreach (var item in pending)
        {
            ticket.Items.Add(new KitchenTicketItem
            {
                Id = Guid.CreateVersion7(),
                KitchenTicketId = ticket.Id,
                OrderItemId = item.Id,
                // What the kitchen was told, copied so the ticket stands alone.
                ItemName = item.ItemName,
                Quantity = item.Quantity,
                Note = item.Note,
            });
        }

        _dbContext.KitchenTickets.Add(ticket);

        // Ingredients leave the shelf here, because this is the moment the kitchen is
        // told to cook: earlier would take stock for food that may never be made, later
        // would take it after it was already used. The submitted lines are locked from
        // this point too, so the deduction cannot be invalidated afterwards.
        //
        // Not saved separately. The movements ride the same save as the ticket below, so
        // a ticket without its deduction cannot exist. Short stock does not refuse the
        // submission: a service must not stop because a count was wrong.
        await _stock.ApplyAsync(
            restaurantId,
            order.Id,
            ticket.Id,
            pending.Select(item => new ConsumedLine(item.MenuItemId, item.Quantity)).ToList(),
            staffUserId,
            now,
            cancellationToken);

        // Touching the order moves its row version, so anyone holding a stale copy
        // is told to reload rather than silently overwriting this submission.
        order.UpdatedAtUtc = now;

        var saved = await SaveWithTicketNumberAsync(ticket, restaurantId, cancellationToken);

        if (saved is null)
        {
            return Result.Failure<SubmitToKitchenResponse>(
                OrderErrors.TicketNumberUnavailable);
        }

        if (saved == SaveOutcome.AlreadySubmitted)
        {
            return Result.Failure<SubmitToKitchenResponse>(OrderErrors.AlreadySubmitted);
        }

        _logger.LogInformation(
            "Waiter {StaffId} sent {ItemCount} line(s) from order {OrderNumber} " +
            "to the kitchen as ticket {TicketNumber}.",
            staffUserId,
            pending.Count,
            order.OrderNumber,
            ticket.TicketNumber);

        var placedBy = await NameOfStaffAsync(order.CreatedByStaffId, cancellationToken);

        return Result.Success(new SubmitToKitchenResponse(
            ToTicketResponse(ticket),
            ToResponse(order, order.Table.Name, OrderAttribution.PlacedBy(order, placedBy))));
    }

    /// <summary>How a ticket save ended.</summary>
    private enum SaveOutcome
    {
        /// <summary>Saved with a fresh ticket number.</summary>
        Saved,

        /// <summary>
        /// Another submission claimed these order lines first, detected through the
        /// unique index on the ticket line.
        /// </summary>
        AlreadySubmitted,
    }

    /// <summary>
    /// Saves the ticket, assigning the next callable number for the restaurant.
    ///
    /// The number comes from the current maximum, which two simultaneous submissions
    /// can read identically, so the unique index turns a collision into a failed
    /// insert and the next attempt takes the following number. The same save can also
    /// fail because an order line is already on another ticket, which is the real
    /// protection against the kitchen being told to cook the same food twice; that is
    /// reported rather than retried.
    ///
    /// Returns null when a number could not be reserved at all.
    /// </summary>
    private async Task<SaveOutcome?> SaveWithTicketNumberAsync(
        KitchenTicket ticket,
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= OrderNumberAttempts; attempt++)
        {
            var highest = await _dbContext.KitchenTickets
                .AsNoTracking()
                .Where(existing => existing.RestaurantId == restaurantId)
                .MaxAsync(existing => (int?)existing.TicketNumber, cancellationToken);

            ticket.TicketNumber = (highest ?? 0) + 1;

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
                return SaveOutcome.Saved;
            }
            catch (DbUpdateConcurrencyException)
            {
                // The order moved under us, so someone else is editing or submitting.
                return SaveOutcome.AlreadySubmitted;
            }
            catch (DbUpdateException exception)
                when (IsDuplicateOrderItem(exception))
            {
                // An order line is already on a ticket. Retrying would not help.
                return SaveOutcome.AlreadySubmitted;
            }
            catch (DbUpdateException) when (attempt < OrderNumberAttempts)
            {
                // Most likely the ticket number was taken. Look again.
                _logger.LogInformation(
                    "Kitchen ticket number {Number} was taken in restaurant {RestaurantId}; retrying.",
                    ticket.TicketNumber,
                    restaurantId);
            }
        }

        return null;
    }

    /// <summary>
    /// Whether the failure came from the unique index that keeps an order line on at
    /// most one ticket, as opposed to the ticket number index.
    /// </summary>
    private static bool IsDuplicateOrderItem(DbUpdateException exception) =>
        exception.InnerException?.Message.Contains(
            "IX_KitchenTicketItems_OrderItemId",
            StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>Compares a stored row version with the base64 form a client sent.</summary>
    private static bool MatchesRowVersion(byte[] stored, string submitted)
    {
        try
        {
            return stored.AsSpan().SequenceEqual(Convert.FromBase64String(submitted));
        }
        catch (FormatException)
        {
            // Not valid base64, so it certainly does not match.
            return false;
        }
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// Confirms the caller is an active waiter attached to a restaurant, and returns
    /// that restaurant.
    ///
    /// The active check matters: an access token issued moments before the account
    /// was switched off would otherwise still work until it expired.
    /// </summary>
    private async Task<(Guid RestaurantId, string FullName)?> ResolveWaiterAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == staffUserId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.StaffRole == StaffRole.Waiter &&
                user.RestaurantId != null)
            .Select(user => new { RestaurantId = user.RestaurantId!.Value, user.FullName })
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : (rows[0].RestaurantId, rows[0].FullName);
    }

    /// <summary>
    /// The display name of one staff account, or null when there is nobody to name.
    ///
    /// Returns null for a guest order rather than querying: an order placed from a table
    /// code has no staff identifier, and a lookup on null comes back empty and would be
    /// reported as an account that could not be found.
    /// </summary>
    private async Task<string?> NameOfStaffAsync(
        Guid? staffId,
        CancellationToken cancellationToken)
    {
        if (staffId is null)
        {
            return null;
        }

        return await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == staffId)
            .Select(user => user.FullName)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// The items a waiter may order: active, in an active category, in this
    /// restaurant. This is the single definition of availability used by both the
    /// menu read and the create validation, so the two cannot disagree.
    /// </summary>
    private IQueryable<Domain.Menu.MenuItem> AvailableItems(Guid restaurantId) =>
        _dbContext.MenuItems.Where(item =>
            item.RestaurantId == restaurantId &&
            item.IsActive &&
            item.Category.IsActive);

    /// <summary>
    /// Saves the order, assigning the next readable number for the restaurant.
    ///
    /// The number is derived from the current maximum, which two simultaneous
    /// orders can read identically. The unique index turns that into a failed insert
    /// rather than a duplicate, so the fix is simply to take the next number and try
    /// again. This keeps the readable number correct without a counter table or a
    /// table-wide lock.
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
                // Another order took this number in the meantime. Look again.
                _logger.LogInformation(
                    "Order number {Number} was taken in restaurant {RestaurantId}; retrying.",
                    order.OrderNumber,
                    restaurantId);
            }
        }

        return false;
    }

    /// <summary>
    /// Projects an order, working out the kitchen state so the interface never has
    /// to. Each line reports whether it went to the kitchen, on which ticket, and
    /// whether it may still be changed.
    /// </summary>
    private static OrderResponse ToResponse(Order order, string tableName, string createdBy)
    {
        var unsubmitted = order.Items
            .Where(item => !item.IsSubmittedToKitchen)
            .Sum(item => item.Quantity);

        return new OrderResponse(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.TableId,
            tableName,
            order.Subtotal,
            order.Items.Sum(item => item.Quantity),
            createdBy,
            order.CreatedAtUtc,
            order.UpdatedAtUtc,
            order.IsEditable,
            Convert.ToBase64String(order.RowVersion),
            unsubmitted,
            // Submitting is only meaningful when the order is still open and
            // something is actually waiting.
            order.IsEditable && unsubmitted > 0,
            order.Items
                // Waiting items first: those are the ones the waiter is working on.
                .OrderBy(item => item.IsSubmittedToKitchen)
                .ThenBy(item => item.ItemName)
                .Select(item => new OrderItemResponse(
                    item.Id,
                    item.MenuItemId,
                    item.ItemName,
                    item.UnitPrice,
                    item.Quantity,
                    item.Note,
                    item.LineTotal,
                    item.IsSubmittedToKitchen,
                    item.KitchenTicketItem?.KitchenTicket?.TicketNumber,
                    // Editable needs both: the order still open, and this line not
                    // yet gone to the kitchen.
                    order.IsEditable && !item.IsSubmittedToKitchen))
                .ToList(),
            order.KitchenTickets
                .OrderByDescending(ticket => ticket.TicketNumber)
                .Select(ToTicketResponse)
                .ToList());
    }

    private static KitchenTicketResponse ToTicketResponse(KitchenTicket ticket) =>
        new(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            ticket.Items.Sum(item => item.Quantity),
            ticket.CreatedAtUtc,
            ticket.Items
                .OrderBy(item => item.ItemName)
                .Select(item => new KitchenTicketItemResponse(
                    item.ItemName,
                    item.Quantity,
                    item.Note))
                .ToList());

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
