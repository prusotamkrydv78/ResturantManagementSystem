using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Floor;
using RestaurantManagement.Application.Floor.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Orders;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Floor;

/// <summary>
/// The live floor overview.
///
/// Everything is derived at the moment of asking from tables, open orders and kitchen
/// tickets that already exist. Nothing is stored and nothing is written: the occupancy
/// this screen reports is the one the order lifecycle set, read back rather than
/// recomputed, so this cannot become a second opinion about which tables are free.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// authenticated caller and every query is filtered by it.
/// </summary>
public sealed class FloorService : IFloorService
{
    private readonly ApplicationDbContext _dbContext;

    /// <summary>Creates the service.</summary>
    public FloorService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<Result<FloorOverviewResponse>> GetForWaiterAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveWaiterRestaurantAsync(staffUserId, cancellationToken);

        return restaurantId is null
            ? Result.Failure<FloorOverviewResponse>(FloorErrors.NotAnActiveWaiter)
            : Result.Success(await BuildAsync(restaurantId.Value, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<FloorOverviewResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveManagerRestaurantAsync(managerUserId, cancellationToken);

        return restaurantId is null
            ? Result.Failure<FloorOverviewResponse>(FloorErrors.NoRestaurantAssigned)
            : Result.Success(await BuildAsync(restaurantId.Value, cancellationToken));
    }

    /* --------------------------------------------------------------- Projection */

    /// <summary>
    /// The floor for one restaurant.
    ///
    /// Written once and shared by both callers. A waiter and a manager ask the same
    /// question of the same room; what differs is what they do with the answer, and
    /// that belongs in the interface rather than in two divergent projections that
    /// could drift.
    /// </summary>
    private async Task<FloorOverviewResponse> BuildAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        // Out of service tables are included. A manager needs to see the whole room,
        // and a waiter hunting for a free table is better told that one is closed than
        // left wondering why it never appears.
        var tables = await _dbContext.RestaurantTables
            .AsNoTracking()
            .Where(table => table.RestaurantId == restaurantId)
            .ToListAsync(cancellationToken);

        var openOrders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                order.Status == OrderStatus.Open)
            .Include(order => order.Items)
                .ThenInclude(item => item.KitchenTicketItem)
            .Include(order => order.KitchenTickets)
            .ToListAsync(cancellationToken);

        // Staff are not a navigation on an order: it records who took it as a value so
        // history survives the account being removed. So the names are looked up.
        var staffIds = openOrders
            .Select(order => order.CreatedByStaffId)
            .Distinct()
            .ToList();

        var names = staffIds.Count == 0
            ? []
            : await _dbContext.Users
                .AsNoTracking()
                .Where(user => staffIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        var byTable = openOrders
            .GroupBy(order => order.TableId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var rows = tables
            // By name, which is the order the room is in. Sorting by state would move
            // a card the moment someone sat down, and staff look for a table by name.
            .OrderBy(table => table.Name, StringComparer.OrdinalIgnoreCase)
            .Select(table => ToTable(
                table,
                byTable.TryGetValue(table.Id, out var orders) ? orders : [],
                names))
            .ToList();

        var inService = rows.Where(row => row.IsActive).ToList();

        return new FloorOverviewResponse(
            DateTimeOffset.UtcNow,
            rows.Count,
            inService.Count,
            inService.Count(row => row.Status == TableStatus.Occupied),
            inService.Count(row => row.Status == TableStatus.Available),
            rows.Count - inService.Count,
            inService.Sum(row => row.Capacity),
            inService
                .Where(row => row.Status == TableStatus.Occupied)
                .Sum(row => row.Capacity),
            rows.Sum(row => row.OpenValue),
            rows.Count(row => row.CanSettle),
            rows);
    }

    private static FloorTableResponse ToTable(
        RestaurantTable table,
        List<Order> openOrders,
        IReadOnlyDictionary<Guid, string> names)
    {
        var tickets = openOrders
            .SelectMany(order => order.KitchenTickets)
            .ToList();

        return new FloorTableResponse(
            table.Id,
            table.Name,
            table.Capacity,
            // Read back, never recomputed. The lifecycle owns this value.
            table.Status,
            table.IsActive,
            openOrders
                .OrderBy(order => order.CreatedAtUtc)
                .Select(order => ToOrder(order, names))
                .ToList(),
            openOrders.Sum(order => order.Subtotal),
            openOrders.Sum(order => order.Items.Sum(item => item.Quantity)),
            openOrders.Count == 0
                ? null
                : openOrders.Min(order => order.CreatedAtUtc),
            tickets.Count(ticket => ticket.Status == KitchenTicketStatus.Pending),
            tickets.Count(ticket => ticket.Status == KitchenTicketStatus.Preparing),
            tickets.Count(ticket => ticket.Status == KitchenTicketStatus.Ready),
            openOrders.Sum(order => order.Items
                .Where(item => item.KitchenTicketItem is null)
                .Sum(item => item.Quantity)),
            openOrders.Any(order => order.CanComplete));
    }

    private static FloorOrderResponse ToOrder(
        Order order,
        IReadOnlyDictionary<Guid, string> names) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Subtotal,
            order.Items.Sum(item => item.Quantity),
            OrderAttribution.PlacedBy(order, names),
            order.CreatedAtUtc,
            order.UnfinishedKitchenTicketCount,
            order.Items
                .Where(item => item.KitchenTicketItem is null)
                .Sum(item => item.Quantity),
            // Asked of the order itself, so the floor, the billing list and the write
            // path all answer eligibility from one place.
            order.CanComplete);

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// Confirms the caller is an active waiter attached to a restaurant, and returns
    /// that restaurant. The active check matters: a token issued moments before the
    /// account was switched off would otherwise keep working until it expired.
    /// </summary>
    private async Task<Guid?> ResolveWaiterRestaurantAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var ids = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == staffUserId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.StaffRole == StaffRole.Waiter &&
                user.RestaurantId != null)
            .Select(user => user.RestaurantId!.Value)
            .ToListAsync(cancellationToken);

        return ids.Count == 0 ? null : ids[0];
    }

    /// <summary>
    /// Confirms the caller manages a restaurant, and returns it. Ownership comes from
    /// the restaurant record rather than from anything the client sent.
    /// </summary>
    private async Task<Guid?> ResolveManagerRestaurantAsync(
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
}
