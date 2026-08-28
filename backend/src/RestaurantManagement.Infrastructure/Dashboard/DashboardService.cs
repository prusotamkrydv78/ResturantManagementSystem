using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Dashboard;
using RestaurantManagement.Application.Dashboard.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Dashboard;

/// <summary>
/// The manager operational overview.
///
/// Every figure is computed from the records themselves at the moment of asking.
/// Nothing is stored, incremented or cached, which is the only way a dashboard stays
/// true: a counter kept alongside the orders it counts eventually disagrees with them,
/// and then the screen is confidently wrong.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// manager who owns it and every query is filtered by it.
/// </summary>
public sealed class DashboardService : IDashboardService
{
    /// <summary>
    /// How many activity rows to return. Enough to see the shift so far at a glance,
    /// and deliberately not enough to be browsed as a log.
    /// </summary>
    private const int ActivityLimit = 25;

    private readonly ApplicationDbContext _dbContext;

    /// <summary>Creates the service.</summary>
    public DashboardService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<Result<ManagerDashboardResponse>> GetAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        // The restaurant itself, not just its identifier: the service day boundary is
        // its own configuration now, so the record has to be loaded to compute it.
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<ManagerDashboardResponse>(
                DashboardErrors.NoRestaurantAssigned);
        }

        var restaurantId = restaurant.Id;
        var now = DateTimeOffset.UtcNow;

        // Asked of the restaurant, so the figures do not move with whoever is looking
        // at them. Previously this came from the viewer browser offset, which meant
        // two managers in different places saw different takings for the same day.
        var dayStart = ServiceDay.Start(now);

        // Open orders, with what the panels need to count. Loaded rather than
        // aggregated in SQL because the same set answers five different questions,
        // and one restaurant worth of open orders is a small set by definition: a
        // floor only has so many tables.
        var openOrders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                order.Status == OrderStatus.Open)
            .Include(order => order.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(order => order.Table)
            .Include(order => order.KitchenTickets)
            .ToListAsync(cancellationToken);

        var tables = await _dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table => table.RestaurantId == restaurantId)
            .Select(table => new
            {
                table.IsActive,
                table.Status,
                table.Capacity,
            })
            .ToListAsync(cancellationToken);

        // Kitchen load is read from ticket status, which stays the kitchen own source
        // of truth. Restaurant-wide rather than per open order, because a ticket
        // outlives nothing here and every one of them is work on the rail.
        var liveTickets = await _dbContext.KitchenTickets
            .AsNoTracking()
            .Where(ticket =>
                ticket.RestaurantId == restaurantId &&
                (ticket.Status == KitchenTicketStatus.Pending ||
                 ticket.Status == KitchenTicketStatus.Preparing))
            .Select(ticket => new { ticket.Status, ticket.CreatedAtUtc })
            .ToListAsync(cancellationToken);

        // Orders that ended today. Counted from the closing timestamps rather than
        // from when they were placed, so a table that opened before midnight and paid
        // after it belongs to the day it was settled on.
        var closedToday = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                ((order.CompletedAtUtc != null && order.CompletedAtUtc >= dayStart) ||
                 (order.CancelledAtUtc != null && order.CancelledAtUtc >= dayStart)))
            .Include(order => order.Table)
            .Include(order => order.Payment)
            .ToListAsync(cancellationToken);

        var availableMenuItems = await _dbContext.MenuItems
            .AsNoTracking()
            .CountAsync(
                item =>
                    item.RestaurantId == restaurantId &&
                    item.IsActive &&
                    item.Category.IsActive,
                cancellationToken);

        // Every ticket raised today, for the activity feed. The three kitchen events
        // all come from timestamps on the ticket itself.
        var ticketsToday = await _dbContext.KitchenTickets
            .AsNoTracking()
            .Where(ticket =>
                ticket.RestaurantId == restaurantId &&
                (ticket.CreatedAtUtc >= dayStart ||
                 ticket.StartedAtUtc >= dayStart ||
                 ticket.ReadyAtUtc >= dayStart))
            .Include(ticket => ticket.Order)
                .ThenInclude(order => order.Table)
            .ToListAsync(cancellationToken);

        var openedToday = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                order.CreatedAtUtc >= dayStart)
            .Include(order => order.Table)
            .ToListAsync(cancellationToken);

        var inService = tables.Where(table => table.IsActive).ToList();

        return Result.Success(new ManagerDashboardResponse(
            now,
            new OrderActivityResponse(
                openOrders.Count,
                openOrders.Count(order => order.CanComplete),
                openOrders.Sum(order => order.Subtotal),
                openOrders.Sum(order => order.Items.Sum(item => item.Quantity)),
                openOrders.Count == 0
                    ? null
                    : openOrders.Min(order => order.CreatedAtUtc)),
            new FloorResponse(
                tables.Count,
                inService.Count,
                inService.Count(table => table.Status == TableStatus.Occupied),
                inService.Count(table => table.Status == TableStatus.Available),
                tables.Count - inService.Count,
                inService.Sum(table => table.Capacity)),
            new KitchenLoadResponse(
                liveTickets.Count(ticket => ticket.Status == KitchenTicketStatus.Pending),
                liveTickets.Count(ticket => ticket.Status == KitchenTicketStatus.Preparing),
                openOrders.Sum(order => order.Items
                    .Where(item => item.KitchenTicketItem is null)
                    .Sum(item => item.Quantity)),
                liveTickets
                    .Where(ticket => ticket.Status == KitchenTicketStatus.Pending)
                    .Select(ticket => (DateTimeOffset?)ticket.CreatedAtUtc)
                    .DefaultIfEmpty(null)
                    .Min()),
            BuildToday(closedToday, dayStart),
            new ReadinessResponse(
                availableMenuItems,
                inService.Count > 0 && availableMenuItems > 0),
            BuildActivity(openedToday, closedToday, ticketsToday, dayStart)));
    }

    /* --------------------------------------------------------------------- Today */

    private static TodayResponse BuildToday(
        IReadOnlyList<Order> closedToday,
        DateTimeOffset dayStart)
    {
        var completed = closedToday
            .Where(order => order.Status == OrderStatus.Completed)
            .ToList();

        var cancelled = closedToday
            .Where(order => order.Status == OrderStatus.Cancelled)
            .ToList();

        var payments = completed
            .Where(order => order.Payment is not null)
            .Select(order => order.Payment!)
            .ToList();

        // Every method is listed even when nothing came in on it, so the breakdown
        // keeps the same shape all day and a zero reads as a zero rather than as a
        // missing row.
        var byMethod = Enum.GetValues<PaymentMethod>()
            .Select(method =>
            {
                var taken = payments.Where(payment => payment.Method == method).ToList();

                return new PaymentMethodTotalResponse(
                    method,
                    taken.Count,
                    taken.Sum(payment => payment.Amount));
            })
            .ToList();

        return new TodayResponse(
            dayStart,
            completed.Count,
            cancelled.Count,
            cancelled.Sum(order => order.Subtotal),
            payments.Sum(payment => payment.Amount),
            payments.Count,
            byMethod);
    }

    /* ------------------------------------------------------------------ Activity */

    /// <summary>
    /// The day so far, newest first.
    ///
    /// Assembled from timestamps that already exist rather than from an event log:
    /// an order records when it was placed, closed or called off, and a ticket
    /// records when it was sent, picked up and finished. Nothing new is written to
    /// produce this, so the feed cannot drift from what actually happened.
    ///
    /// Scoped to today like the rest of the screen. Early in a shift it will be
    /// short, and saying so is more honest than padding it with yesterday.
    /// </summary>
    private static List<ActivityEntryResponse> BuildActivity(
        IReadOnlyList<Order> openedToday,
        IReadOnlyList<Order> closedToday,
        IReadOnlyList<KitchenTicket> ticketsToday,
        DateTimeOffset dayStart)
    {
        var entries = new List<ActivityEntryResponse>();

        foreach (var order in openedToday)
        {
            entries.Add(new ActivityEntryResponse(
                ActivityKind.OrderPlaced,
                order.CreatedAtUtc,
                order.Id,
                order.OrderNumber,
                order.Table.Name,
                null,
                null,
                null,
                null));
        }

        foreach (var ticket in ticketsToday)
        {
            if (ticket.CreatedAtUtc >= dayStart)
            {
                entries.Add(TicketEntry(ActivityKind.SentToKitchen, ticket, ticket.CreatedAtUtc));
            }

            if (ticket.StartedAtUtc is not null && ticket.StartedAtUtc >= dayStart)
            {
                entries.Add(TicketEntry(
                    ActivityKind.KitchenStarted,
                    ticket,
                    ticket.StartedAtUtc.Value));
            }

            if (ticket.ReadyAtUtc is not null && ticket.ReadyAtUtc >= dayStart)
            {
                entries.Add(TicketEntry(
                    ActivityKind.KitchenReady,
                    ticket,
                    ticket.ReadyAtUtc.Value));
            }
        }

        foreach (var order in closedToday)
        {
            if (order.CompletedAtUtc is not null && order.CompletedAtUtc >= dayStart)
            {
                entries.Add(new ActivityEntryResponse(
                    ActivityKind.OrderCompleted,
                    order.CompletedAtUtc.Value,
                    order.Id,
                    order.OrderNumber,
                    order.Table.Name,
                    null,
                    order.Payment?.Amount ?? order.Subtotal,
                    order.Payment?.Method,
                    null));
            }

            if (order.CancelledAtUtc is not null && order.CancelledAtUtc >= dayStart)
            {
                entries.Add(new ActivityEntryResponse(
                    ActivityKind.OrderCancelled,
                    order.CancelledAtUtc.Value,
                    order.Id,
                    order.OrderNumber,
                    order.Table.Name,
                    null,
                    order.Subtotal,
                    null,
                    order.CancellationReason));
            }
        }

        return entries
            .OrderByDescending(entry => entry.AtUtc)
            .Take(ActivityLimit)
            .ToList();
    }

    private static ActivityEntryResponse TicketEntry(
        ActivityKind kind,
        KitchenTicket ticket,
        DateTimeOffset at) =>
        new(
            kind,
            at,
            ticket.OrderId,
            ticket.Order.OrderNumber,
            ticket.Order.Table.Name,
            ticket.TicketNumber,
            null,
            null,
            null);

}
