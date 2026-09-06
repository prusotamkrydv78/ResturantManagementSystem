using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Billing;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Orders;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Billing;

/// <summary>
/// Billing and order closure for a restaurant manager.
///
/// Isolation works the way it does everywhere else: the restaurant is derived from
/// the manager who owns it and every read and write is filtered by it, so an order
/// identifier from another restaurant simply does not resolve.
///
/// The eligibility rule is not written here. It lives on the order, which knows
/// whether it is open, whether it has been paid, and whether its kitchen tickets are
/// done; this service loads what that question needs, asks it, and then does the
/// three things that must happen together.
/// </summary>
public sealed class BillingService : IBillingService
{
    /// <summary>
    /// How many recently closed orders to include when asked for history. Enough to
    /// confirm the last few settlements at the counter, and deliberately not enough
    /// to be a report.
    /// </summary>
    private const int CompletedLookback = 20;

    /// <summary>
    /// Hard ceiling on a history request, whatever the caller asks for. There is no
    /// pagination anywhere in this product, so the bound has to live here; it is also
    /// what keeps a history list from quietly becoming a reporting endpoint.
    /// </summary>
    private const int MaxHistory = 200;

    private readonly ApplicationDbContext _dbContext;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<BillingService> _logger;

    /// <summary>Creates the service.</summary>
    public BillingService(
        ApplicationDbContext dbContext,
        IRealtimeNotifier realtime,
        ILogger<BillingService> logger)
    {
        _dbContext = dbContext;
        _realtime = realtime;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<BillingOrderSummaryResponse>>> GetOrdersAsync(
        Guid managerUserId,
        bool includeCompleted,
        CancellationToken cancellationToken)
    {
        var caller = await ResolveSettlerAsync(managerUserId, cancellationToken);
        var restaurantId = caller?.RestaurantId;

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<BillingOrderSummaryResponse>>(
                BillingErrors.NoRestaurantAssigned);
        }

        var open = await OrdersOf(restaurantId.Value)
            .Where(order => order.Status == OrderStatus.Open)
            .OrderBy(order => order.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        // Recently settled, for confirmation at the counter. Cancelled orders are not
        // included: nothing was taken for them, so they belong in history rather than
        // alongside the takings a manager is checking.
        var completed = includeCompleted
            ? await OrdersOf(restaurantId.Value)
                .Where(order => order.Status == OrderStatus.Completed)
                .OrderByDescending(order => order.CompletedAtUtc)
                .Take(CompletedLookback)
                .ToListAsync(cancellationToken)
            : [];

        // Open first and oldest first within it: the table that has been sitting
        // longest is the one somebody is waiting to pay at.
        var names = await NamesFor(
            open.Concat(completed),
            cancellationToken);

        var rows = open
            .Concat(completed)
            .Select(order => ToSummary(order, names))
            .ToList();

        return Result.Success<IReadOnlyList<BillingOrderSummaryResponse>>(rows);
    }

    /// <inheritdoc />
    public async Task<Result<BillingOrderResponse>> GetOrderAsync(
        Guid managerUserId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var caller = await ResolveSettlerAsync(managerUserId, cancellationToken);
        var restaurantId = caller?.RestaurantId;

        if (restaurantId is null)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.NoRestaurantAssigned);
        }

        var order = await OrdersOf(restaurantId.Value)
            .Where(candidate => candidate.Id == orderId)
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.OrderNotFound);
        }

        var names = await NamesFor([order], cancellationToken);

        return Result.Success(ToDetail(order, names));
    }

    /// <inheritdoc />
    public async Task<Result<RecordPaymentResponse>> RecordPaymentAsync(
        Guid managerUserId,
        Guid orderId,
        RecordPaymentRequest request,
        CancellationToken cancellationToken)
    {
        // A waiter or a manager. Whoever is standing at the table takes the money, and
        // the name recorded against the payment is theirs.
        var manager = await ResolveSettlerAsync(managerUserId, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<RecordPaymentResponse>(BillingErrors.NoRestaurantAssigned);
        }

        var restaurantId = manager.Value.RestaurantId;

        var order = await TrackedOrder(restaurantId, orderId)
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return Result.Failure<RecordPaymentResponse>(BillingErrors.OrderNotFound);
        }

        // Reported apart so the manager is told which thing stopped them, rather
        // than one blanket refusal covering three different situations.
        //
        // Fully paid, not merely "has a payment". A half-settled bill is still owed
        // money and must still accept the other half.
        if (order.IsPaid)
        {
            return Result.Failure<RecordPaymentResponse>(BillingErrors.AlreadyPaid);
        }

        if (order.Status != OrderStatus.Open)
        {
            return Result.Failure<RecordPaymentResponse>(BillingErrors.AlreadyCompleted);
        }

        // Before the kitchen-ready check, because it is the earlier failure in the
        // order lifecycle and the fix is somebody else job: the waiter has to send it
        // through, whereas an unfinished ticket only needs waiting for.
        if (order.UnsentItemCount > 0)
        {
            return Result.Failure<RecordPaymentResponse>(
                BillingErrors.NotSentToKitchen(order.UnsentItemCount));
        }

        if (order.UnfinishedKitchenTicketCount > 0)
        {
            return Result.Failure<RecordPaymentResponse>(
                BillingErrors.KitchenNotReady(order.UnfinishedKitchenTicketCount));
        }

        var now = DateTimeOffset.UtcNow;

        // Null means "the rest of it", which is the ordinary case and keeps a single
        // payment from having to echo a figure the server already knows.
        var amount = request.Amount ?? order.AmountOutstanding;

        // The one number a request may name, bounded on both sides. It cannot invent a
        // total or reduce one - only say how much of a figure the server calculated was
        // handed over. Overpaying is refused rather than quietly recorded, because
        // change given at a counter is not revenue and a bill that reads as overpaid
        // hides a mistake somebody needs to fix.
        if (amount <= 0m)
        {
            return Result.Failure<RecordPaymentResponse>(BillingErrors.AmountNotPositive);
        }

        if (amount > order.AmountOutstanding)
        {
            return Result.Failure<RecordPaymentResponse>(
                BillingErrors.AmountExceedsOutstanding(order.AmountOutstanding));
        }

        var payment = new Payment
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId,
            OrderId = order.Id,
            Amount = amount,
            Method = request.Method,
            RecordedByUserId = managerUserId,
            RecordedAtUtc = now,
        };

        // Added to the navigation first, and this ordering is the reverse of what it
        // used to be. The order now closes because it is paid rather than in spite of
        // it, so the payment has to be visible to the order before it is asked whether
        // the bill is settled.
        order.Payments.Add(payment);
        _dbContext.Payments.Add(payment);

        // Only when the bill is actually covered. A part payment leaves the order open
        // and the table occupied, which is the whole point: the party is still sitting
        // there and still owes money.
        var settled = order.TryComplete(now);

        if (settled)
        {
            await ReleaseTableAsync(order, now, cancellationToken);
        }

        // One transaction over all three writes. A single SaveChanges is already
        // atomic, but the table release depends on a query taken just before it, so
        // the explicit boundary covers the decision as well as the writes.
        await using var transaction =
            await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The order moved under us. Its row version is what separates two
            // managers who both passed the checks above.
            await transaction.RollbackAsync(cancellationToken);

            _logger.LogInformation(
                "Order {OrderId} was updated by someone else while manager {ManagerId} was settling it.",
                orderId,
                managerUserId);

            return Result.Failure<RecordPaymentResponse>(BillingErrors.Conflict);
        }
        _logger.LogInformation(
            settled
                ? "Manager {ManagerId} closed order {OrderNumber} with a {Method} payment of {Amount}; nothing outstanding."
                : "Manager {ManagerId} took a {Method} part payment of {Amount} against order {OrderNumber}; {Outstanding} still owed.",
            managerUserId,
            order.OrderNumber,
            payment.Method,
            payment.Amount,
            order.AmountOutstanding);

        // Only once the bill is actually covered. A part payment leaves the visit
        // running, and telling a phone it is over while the table still owes money
        // would end the page on a meal that has not finished.
        if (settled)
        {
            await _realtime.OrderSettledAsync(
                order.Id,
                order.OrderNumber,
                cancellationToken);
        }

        var names = new Dictionary<Guid, string>
        {
            [managerUserId] = manager.Value.FullName,
        };

        var placedBy = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == order.CreatedByStaffId)
            .Select(user => user.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        if (placedBy is not null && order.CreatedByStaffId is not null)
        {
            names[order.CreatedByStaffId.Value] = placedBy;
        }

        return Result.Success(new RecordPaymentResponse(
            ToPayment(payment, names),
            ToDetail(order, names)));
    }

    /// <inheritdoc />
    public async Task<Result<BillingOrderResponse>> CancelOrderAsync(
        Guid managerUserId,
        Guid orderId,
        CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        var manager = await ResolveManagerAsync(managerUserId, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.NoRestaurantAssigned);
        }

        var order = await TrackedOrder(manager.Value.RestaurantId, orderId)
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.OrderNotFound);
        }

        // Reported apart so the manager learns which thing stopped them. Paid is
        // checked first because it is the one with no way back: there is no refund in
        // this product, so a settled order can never be called off.
        if (order.IsPaid)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.PaidCannotCancel);
        }

        if (order.Status != OrderStatus.Open)
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.NotOpen);
        }

        var now = DateTimeOffset.UtcNow;

        // Trimmed here rather than trusting the request shape, so what is stored is
        // the text a person would read back.
        if (!order.TryCancel(managerUserId, request.Reason.Trim(), now))
        {
            return Result.Failure<BillingOrderResponse>(BillingErrors.NotOpen);
        }

        await ReleaseTableAsync(order, now, cancellationToken);

        // The same transaction boundary as settling, for the same reason: the table
        // release depends on a query taken just before the write, so the decision
        // belongs inside it. Nothing is deleted in here; the order lines and every
        // kitchen ticket are left exactly as they were.
        await using var transaction =
            await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);

            _logger.LogInformation(
                "Order {OrderId} was updated by someone else while manager {ManagerId} was cancelling it.",
                orderId,
                managerUserId);

            return Result.Failure<BillingOrderResponse>(BillingErrors.Conflict);
        }

        // Warning rather than information on purpose: a table that produced no money,
        // especially one the kitchen had already started cooking for, is something a
        // restaurant will want to be able to find later.
        _logger.LogWarning(
            "Manager {ManagerId} cancelled order {OrderNumber} worth {Subtotal} with " +
            "{StartedTickets} kitchen ticket(s) already started. Reason: {Reason}",
            managerUserId,
            order.OrderNumber,
            order.Subtotal,
            order.StartedKitchenTicketCount,
            order.CancellationReason);

        // The other ending, and the one that was silent. Without this a guest sits
        // watching a live timeline for food that is never coming - worse than the
        // settled case it mirrors, because at least a paid bill ends happily.
        await _realtime.OrderCancelledAsync(
            order.Id,
            order.OrderNumber,
            cancellationToken);

        var names = await NamesFor([order], cancellationToken);

        return Result.Success(ToDetail(order, names));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<OrderHistoryEntryResponse>>> GetHistoryAsync(
        Guid managerUserId,
        OrderStatus? status,
        int limit,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<OrderHistoryEntryResponse>>(
                BillingErrors.NoRestaurantAssigned);
        }

        var query = OrdersOf(restaurantId.Value)
            .Where(order => order.Status != OrderStatus.Open);

        // Filtering for Open asks history for something it does not hold, so it is
        // read as no filter rather than quietly returning an empty list.
        if (status is not null && status != OrderStatus.Open)
        {
            query = query.Where(order => order.Status == status.Value);
        }

        var orders = await query.ToListAsync(cancellationToken);

        var names = await NamesFor(orders, cancellationToken);

        // Sorted on when the order ended rather than on either timestamp alone: the
        // two outcomes stamp different columns, and sorting by one of them would
        // interleave the other wrongly. Done in memory because the set is bounded.
        var rows = orders
            .OrderByDescending(ClosedAt)
            .Take(Math.Clamp(limit, 1, MaxHistory))
            .Select(order => ToHistoryEntry(order, names))
            .ToList();

        return Result.Success<IReadOnlyList<OrderHistoryEntryResponse>>(rows);
    }

    /// <inheritdoc />
    public async Task<Result<ReceiptResponse>> GetReceiptAsync(
        Guid managerUserId,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var caller = await ResolveSettlerAsync(managerUserId, cancellationToken);
        var restaurantId = caller?.RestaurantId;

        if (restaurantId is null)
        {
            return Result.Failure<ReceiptResponse>(BillingErrors.NoRestaurantAssigned);
        }

        // The restaurant travels with the order because a receipt has to say who took
        // the money, and that is on the restaurant rather than the order.
        var order = await _dbContext.Orders
            .AsNoTracking()
            .Where(candidate =>
                candidate.Id == orderId && candidate.RestaurantId == restaurantId.Value)
            .Include(candidate => candidate.Items)
            .Include(candidate => candidate.Table)
            .Include(candidate => candidate.Restaurant)
            .Include(candidate => candidate.Payments)
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return Result.Failure<ReceiptResponse>(BillingErrors.OrderNotFound);
        }

        // Both conditions, not either: a receipt describes money that was taken, so it
        // needs the payment, and it describes a closed bill, so it needs the order to
        // have ended that way. Neither on its own is enough to print.
        if (order.Status != OrderStatus.Completed || order.Payments.Count == 0)
        {
            return Result.Failure<ReceiptResponse>(BillingErrors.NoReceipt);
        }

        var names = await NamesFor([order], cancellationToken);

        // The last one, which is the one that closed the bill. A split bill has several
        // and the receipt is printed at the end, so the time and the person on it should
        // be the moment the table actually finished paying.
        var payment = order.Payments.OrderBy(row => row.RecordedAtUtc).Last();

        return Result.Success(new ReceiptResponse(
            order.Restaurant.Name,
            order.Restaurant.AddressLine,
            order.Restaurant.City,
            order.Restaurant.Country,
            order.Restaurant.ContactPhone,
            order.Restaurant.ContactEmail,
            order.OrderNumber,
            order.Table.Name,
            OrderAttribution.PlacedBy(order, names),
            order.CreatedAtUtc,
            order.CompletedAtUtc ?? payment.RecordedAtUtc,
            order.Items
                .OrderBy(item => item.ItemName)
                .Select(item => new ReceiptLineResponse(
                    item.ItemName,
                    item.Quantity,
                    item.UnitPrice,
                    item.LineTotal,
                    item.Note))
                .ToList(),
            order.Items.Sum(item => item.Quantity),
            order.Subtotal,
            payment.Method,
            payment.Amount,
            payment.RecordedAtUtc,
            names.TryGetValue(payment.RecordedByUserId, out var recordedBy)
                ? recordedBy
                : "Unknown"));
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// One order in one restaurant, tracked, with everything the eligibility rules
    /// read.
    ///
    /// The kitchen tickets and the payment are loaded deliberately: the questions on
    /// the order walk both navigations, and an unloaded one would read as "nothing to
    /// wait for" and "not paid". Shared by settling and cancelling, so the two cannot
    /// end up deciding from different amounts of information.
    /// </summary>
    private IQueryable<Order> TrackedOrder(Guid restaurantId, Guid orderId) =>
        _dbContext.Orders
            .Where(candidate =>
                candidate.Id == orderId && candidate.RestaurantId == restaurantId)
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.KitchenTicketItem)
                    .ThenInclude(ticketItem => ticketItem!.KitchenTicket)
            .Include(candidate => candidate.Table)
            .Include(candidate => candidate.KitchenTickets)
                .ThenInclude(ticket => ticket.Items)
            .Include(candidate => candidate.Payments);

    /// <summary>
    /// When an order ended, whichever way it ended. One value to sort a mixed history
    /// by, since the two outcomes stamp different columns.
    /// </summary>
    private static DateTimeOffset ClosedAt(Order order) =>
        order.CompletedAtUtc ?? order.CancelledAtUtc ?? order.UpdatedAtUtc;

    /// <summary>
    /// Gives the table back, unless something else is still running on it.
    ///
    /// Automatic, and the only thing in the product that moves a table off Occupied.
    /// The check for another open order matters: two parties can share a table over
    /// an evening, and releasing it while one of them is still eating would tell the
    /// floor it was free.
    /// </summary>
    private async Task ReleaseTableAsync(
        Order order,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var stillBusy = await _dbContext.Orders
            .AnyAsync(
                candidate =>
                    candidate.TableId == order.TableId &&
                    candidate.Id != order.Id &&
                    candidate.Status == OrderStatus.Open,
                cancellationToken);

        if (stillBusy)
        {
            return;
        }

        // Tracked, so the change rides the same transaction as the payment.
        var table = await _dbContext.RestaurantTables
            .SingleOrDefaultAsync(
                candidate => candidate.Id == order.TableId,
                cancellationToken);

        if (table is null || table.Status == TableStatus.Available)
        {
            return;
        }

        // Availability only. Whether the table is in service at all is the manager
        // decision and is left exactly as it was.
        table.Status = TableStatus.Available;
        table.UpdatedAtUtc = now;
    }

    /// <summary>
    /// Whether the failure came from the unique index that holds one payment per
    /// order, rather than from anything else that could fail on the same save.
    /// </summary>
    private static bool IsDuplicatePayment(DbUpdateException exception) =>
        exception.InnerException?.Message.Contains(
            "IX_Payments_OrderId",
            StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>
    /// The orders of one restaurant with everything billing reads, and nothing else.
    ///
    /// The restaurant filter is part of the query rather than a check afterwards, so
    /// there is no path that finds an order first and decides about it second.
    /// </summary>
    private IQueryable<Order> OrdersOf(Guid restaurantId) =>
        _dbContext.Orders
            .AsNoTracking()
            .Where(order => order.RestaurantId == restaurantId)
            .Include(order => order.Items)
                .ThenInclude(item => item.KitchenTicketItem)
                    .ThenInclude(ticketItem => ticketItem!.KitchenTicket)
            .Include(order => order.Table)
            .Include(order => order.KitchenTickets)
                .ThenInclude(ticket => ticket.Items)
            .Include(order => order.Payments);

    /// <summary>
    /// Display names for everyone referenced by a set of orders, in one query.
    ///
    /// Staff are not a navigation on an order, deliberately: the order records who
    /// took it as a value so history survives an account being removed. That means
    /// the names are looked up rather than joined.
    /// </summary>
    private async Task<Dictionary<Guid, string>> NamesFor(
        IEnumerable<Order> orders,
        CancellationToken cancellationToken)
    {
        var ids = orders
            .SelectMany(order => new[]
            {
                order.CreatedByStaffId,
                order.Payments.Select(payment => (Guid?)payment.RecordedByUserId).FirstOrDefault(),
                order.CancelledByUserId,
            })
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return [];
        }

        var rows = await _dbContext.Users
            .AsNoTracking()
            .Where(user => ids.Contains(user.Id))
            .Select(user => new { user.Id, user.FullName })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(row => row.Id, row => row.FullName);
    }

    /// <summary>
    /// Confirms the caller manages a restaurant, and returns it. Ownership comes from
    /// the restaurant record rather than from anything the client sent.
    ///
    /// Manager only, and used by the two operations that stay theirs: calling an order
    /// off, and the takings history.
    /// </summary>
    private async Task<Guid?> ResolveRestaurantIdAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var ids = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => restaurant.Id)
            .ToListAsync(cancellationToken);

        return ids.Count == 0 ? null : ids[0];
    }

    /// <summary>
    /// The restaurant of somebody who may settle a bill, and their name for the record.
    ///
    /// A manager or a waiter, because the person taking the money is whoever is standing
    /// at the table. Two queries rather than one join over a union: the shapes are
    /// genuinely different - a manager is named by the restaurant, a waiter carries it -
    /// and the manager case answers first because they are the smaller set.
    ///
    /// The active check on the staff side matters. A token issued moments before an
    /// account was switched off would otherwise still take payments.
    /// </summary>
    private async Task<(Guid RestaurantId, string FullName)?> ResolveSettlerAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var manager = await ResolveManagerAsync(userId, cancellationToken);

        if (manager is not null)
        {
            return manager;
        }

        var waiters = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == userId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.StaffRole == StaffRole.Waiter &&
                user.RestaurantId != null)
            .Select(user => new { RestaurantId = user.RestaurantId!.Value, user.FullName })
            .ToListAsync(cancellationToken);

        return waiters.Count == 0
            ? null
            : (waiters[0].RestaurantId, waiters[0].FullName);
    }

    /// <summary>
    /// The same resolution, plus the name to record against the payment. Fetched
    /// together because a settlement needs both and one query is enough.
    /// </summary>
    private async Task<(Guid RestaurantId, string FullName)?> ResolveManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Join(
                _dbContext.Users,
                restaurant => restaurant.ManagerId,
                user => user.Id,
                (restaurant, user) => new { restaurant.Id, user.FullName })
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : (rows[0].Id, rows[0].FullName);
    }

    /* ------------------------------------------------------------------- Mapping */

    private static PaymentResponse ToPayment(
        Payment payment,
        IReadOnlyDictionary<Guid, string> names) =>
        new(
            payment.Id,
            payment.Amount,
            payment.Method,
            names.TryGetValue(payment.RecordedByUserId, out var name) ? name : "Unknown",
            payment.RecordedAtUtc);

    /// <summary>
    /// The cancellation block, or null when the order was not cancelled.
    ///
    /// Reads the three columns together, which the schema guarantees are either all
    /// present or all absent, so a half-built block cannot be produced here.
    /// </summary>
    private static CancellationResponse? ToCancellation(
        Order order,
        IReadOnlyDictionary<Guid, string> names)
    {
        if (order.CancelledAtUtc is null || order.CancellationReason is null)
        {
            return null;
        }

        var cancelledBy = order.CancelledByUserId is not null
            && names.TryGetValue(order.CancelledByUserId.Value, out var name)
                ? name
                : "Unknown";

        return new CancellationResponse(
            order.CancellationReason,
            cancelledBy,
            order.CancelledAtUtc.Value);
    }

    private static OrderHistoryEntryResponse ToHistoryEntry(
        Order order,
        IReadOnlyDictionary<Guid, string> names) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.Table.Name,
            order.Subtotal,
            order.DiscountAmount,
            order.ServiceChargeAmount,
            order.VatAmount,
            order.Total,
            order.AmountPaid,
            order.AmountOutstanding,
            order.Items.Sum(item => item.Quantity),
            OrderAttribution.PlacedBy(order, names),
            order.CreatedAtUtc,
            ClosedAt(order),
            order.KitchenTickets.Count,
            order.Payments
                .OrderBy(payment => payment.RecordedAtUtc)
                .Select(payment => ToPayment(payment, names))
                .ToList(),
            ToCancellation(order, names));

    private static BillingOrderSummaryResponse ToSummary(
        Order order,
        IReadOnlyDictionary<Guid, string> names) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.Table.Name,
            order.Subtotal,
            order.DiscountAmount,
            order.ServiceChargeAmount,
            order.VatAmount,
            order.Total,
            order.AmountPaid,
            order.AmountOutstanding,
            order.Items.Sum(item => item.Quantity),
            OrderAttribution.PlacedBy(order, names),
            order.CreatedAtUtc,
            order.CompletedAtUtc,
            order.KitchenTickets.Count,
            order.UnfinishedKitchenTicketCount,
            order.UnsentItemCount,
            order.CanSettle,
            order.BillRequestedAtUtc,
            order.Payments
                .OrderBy(payment => payment.RecordedAtUtc)
                .Select(payment => ToPayment(payment, names))
                .ToList(),
            ToCancellation(order, names));

    private static BillingOrderResponse ToDetail(
        Order order,
        IReadOnlyDictionary<Guid, string> names) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.Table.Name,
            order.Table.Capacity,
            order.Subtotal,
            order.DiscountAmount,
            order.ServiceChargeAmount,
            order.VatAmount,
            order.Total,
            order.AmountPaid,
            order.AmountOutstanding,
            order.Items.Sum(item => item.Quantity),
            OrderAttribution.PlacedBy(order, names),
            order.CreatedAtUtc,
            order.CompletedAtUtc,
            order.UnfinishedKitchenTicketCount,
            order.Items
                .Where(item => item.KitchenTicketItem is null)
                .Sum(item => item.Quantity),
            order.StartedKitchenTicketCount,
            order.CanSettle,
            order.BillRequestedAtUtc,
            order.CanCancel,
            order.Payments
                .OrderBy(payment => payment.RecordedAtUtc)
                .Select(payment => ToPayment(payment, names))
                .ToList(),
            ToCancellation(order, names),
            order.Items
                .OrderBy(item => item.ItemName)
                .Select(item => new BillingOrderItemResponse(
                    item.ItemName,
                    item.UnitPrice,
                    item.Quantity,
                    item.Note,
                    item.LineTotal,
                    item.KitchenTicketItem is not null,
                    item.KitchenTicketItem?.KitchenTicket.TicketNumber))
                .ToList(),
            order.KitchenTickets
                .OrderByDescending(ticket => ticket.CreatedAtUtc)
                .Select(ticket => new BillingKitchenTicketResponse(
                    ticket.TicketNumber,
                    ticket.Status,
                    ticket.Items.Sum(item => item.Quantity),
                    ticket.CreatedAtUtc))
                .ToList());
}
