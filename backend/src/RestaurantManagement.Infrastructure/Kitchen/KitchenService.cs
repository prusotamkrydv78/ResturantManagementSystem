using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Kitchen;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Application.Kitchen.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Kitchen;

/// <summary>
/// The chef kitchen workflow.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// authenticated chef and every read and write is filtered by it, so a ticket
/// identifier from another restaurant simply does not resolve.
///
/// The transition rules themselves are not here. They live on the ticket, which
/// decides what may follow what and stamps the matching timestamp; this service
/// resolves the caller, finds the ticket, asks it to move, and translates a refusal
/// into an error the API can report.
/// </summary>
public sealed class KitchenService : IKitchenService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IRealtimeNotifier _realtime;
    private readonly ILogger<KitchenService> _logger;

    /// <summary>Creates the service.</summary>
    public KitchenService(
        ApplicationDbContext dbContext,
        IRealtimeNotifier realtime,
        ILogger<KitchenService> logger)
    {
        _dbContext = dbContext;
        _realtime = realtime;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<KitchenTicketResponse>>> GetQueueAsync(
        Guid staffUserId,
        KitchenTicketStatus? status,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveChefRestaurantAsync(staffUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<KitchenTicketResponse>>(
                KitchenErrors.NotAnActiveChef);
        }

        var query = _dbContext.KitchenTickets
            .AsNoTracking()
            .Where(ticket => ticket.RestaurantId == restaurantId.Value);

        if (status is null)
        {
            // The default is live work. A Ready ticket is done as far as this phase
            // goes, and leaving it on the rail would push real work off the screen.
            query = query.Where(ticket =>
                ticket.Status == KitchenTicketStatus.Pending ||
                ticket.Status == KitchenTicketStatus.Preparing);
        }
        else
        {
            query = query.Where(ticket => ticket.Status == status.Value);
        }

        var tickets = await query
            .Include(ticket => ticket.Order)
                .ThenInclude(order => order.Table)
            .Include(ticket => ticket.Items)
            .ToListAsync(cancellationToken);

        // Sorted in memory rather than in SQL. A kitchen rail holds live work for one
        // restaurant, so this is a handful of rows, and expressing the grouping here
        // keeps it readable instead of hiding it in a translated CASE.
        var ordered = tickets
            .OrderBy(WorkRank)
            .ThenBy(ticket => ticket.CreatedAtUtc)
            .Select(ToResponse)
            .ToList();

        return Result.Success<IReadOnlyList<KitchenTicketResponse>>(ordered);
    }

    /// <inheritdoc />
    public async Task<Result<KitchenTicketResponse>> GetByIdAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveChefRestaurantAsync(staffUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<KitchenTicketResponse>(KitchenErrors.NotAnActiveChef);
        }

        var ticket = await FindTicket(restaurantId.Value, ticketId)
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);

        return ticket is null
            ? Result.Failure<KitchenTicketResponse>(KitchenErrors.NotFound)
            : Result.Success(ToResponse(ticket));
    }

    /// <inheritdoc />
    public Task<Result<KitchenTicketResponse>> StartAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            staffUserId,
            ticketId,
            (ticket, now) => ticket.TryStart(now),
            KitchenErrors.NotPending,
            "started",
            // Told to the rest of the kitchen, so a second chef does not reach for a
            // ticket somebody is already cooking.
            (realtime, restaurantId, payload, token) =>
                realtime.TicketStartedAsync(restaurantId, payload, token),
            cancellationToken);

    /// <inheritdoc />
    public Task<Result<KitchenTicketResponse>> MarkReadyAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            staffUserId,
            ticketId,
            (ticket, now) => ticket.TryMarkReady(now),
            KitchenErrors.NotPreparing,
            "marked ready",
            // Told to the floor, not the kitchen. This is the one kitchen event
            // somebody else has to act on: there is a plate at the pass going cold
            // until a waiter carries it.
            (realtime, restaurantId, payload, token) =>
                realtime.TicketReadyAsync(restaurantId, payload, token),
            cancellationToken);

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// The shared shape of both status operations: resolve the chef, find the ticket
    /// in their restaurant, ask the ticket to move, save.
    ///
    /// Written once because the two operations differ only in which method they call
    /// and which refusal they report. A single endpoint taking a target status was
    /// deliberately not built: the workflow has two steps, and naming them keeps
    /// arbitrary status strings out of the API altogether.
    /// </summary>
    private async Task<Result<KitchenTicketResponse>> TransitionAsync(
        Guid staffUserId,
        Guid ticketId,
        Func<KitchenTicket, DateTimeOffset, bool> transition,
        Error refusal,
        string action,
        Func<IRealtimeNotifier, Guid, TicketEvent, CancellationToken, Task> announce,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveChefRestaurantAsync(staffUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<KitchenTicketResponse>(KitchenErrors.NotAnActiveChef);
        }

        // Tracked, because this one is going to be written.
        var ticket = await FindTicket(restaurantId.Value, ticketId)
            .SingleOrDefaultAsync(cancellationToken);

        if (ticket is null)
        {
            return Result.Failure<KitchenTicketResponse>(KitchenErrors.NotFound);
        }

        if (!transition(ticket, DateTimeOffset.UtcNow))
        {
            return Result.Failure<KitchenTicketResponse>(refusal);
        }

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Both chefs read the ticket in the same state and both passed the check
            // above; the row version is what separates them. The loser is told to
            // reload rather than being handed a success it did not cause.
            _logger.LogInformation(
                "Kitchen ticket {TicketId} was moved by someone else while chef {StaffId} was acting on it.",
                ticketId,
                staffUserId);

            return Result.Failure<KitchenTicketResponse>(KitchenErrors.Conflict);
        }

        _logger.LogInformation(
            "Chef {StaffId} {Action} kitchen ticket {TicketNumber}.",
            staffUserId,
            action,
            ticket.TicketNumber);

        // After the save, never before. An announcement about work that then failed to
        // commit would put food on a screen that does not exist.
        await announce(
            _realtime,
            restaurantId.Value,
            new TicketEvent(
                ticket.Id,
                ticket.TicketNumber,
                ticket.OrderId,
                ticket.Order.OrderNumber,
                ticket.Order.Table.Name,
                ticket.Items.Sum(item => item.Quantity)),
            cancellationToken);

        return Result.Success(ToResponse(ticket));
    }

    /// <summary>
    /// One ticket in one restaurant, with everything the kitchen screen needs.
    ///
    /// The restaurant filter is part of the lookup rather than a check afterwards, so
    /// there is no path that finds a ticket first and decides about it second.
    /// </summary>
    private IQueryable<KitchenTicket> FindTicket(Guid restaurantId, Guid ticketId) =>
        _dbContext.KitchenTickets
            .Where(ticket =>
                ticket.Id == ticketId && ticket.RestaurantId == restaurantId)
            .Include(ticket => ticket.Order)
                .ThenInclude(order => order.Table)
            .Include(ticket => ticket.Items);

    /// <summary>
    /// Confirms the caller is an active chef attached to a restaurant, and returns
    /// that restaurant.
    ///
    /// The active check matters: an access token issued moments before the account
    /// was switched off would otherwise keep working until it expired. There is no
    /// chef assignment on a ticket, so any active chef in the restaurant can work
    /// the whole queue, which is how a kitchen actually runs.
    /// </summary>
    private async Task<Guid?> ResolveChefRestaurantAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == staffUserId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.StaffRole == StaffRole.Chef &&
                user.RestaurantId != null)
            .Select(user => user.RestaurantId!.Value)
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }

    /// <summary>
    /// Where a ticket belongs on the rail. What is already being cooked comes first,
    /// because someone is standing over it.
    /// </summary>
    private static int WorkRank(KitchenTicket ticket) => ticket.Status switch
    {
        KitchenTicketStatus.Preparing => 0,
        KitchenTicketStatus.Pending => 1,
        _ => 2,
    };

    private static KitchenTicketResponse ToResponse(KitchenTicket ticket) =>
        new(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            ticket.Order.OrderNumber,
            ticket.Order.Table.Name,
            ticket.Items.Sum(item => item.Quantity),
            ticket.CreatedAtUtc,
            ticket.StartedAtUtc,
            ticket.ReadyAtUtc,
            ticket.ServedAtUtc,
            ticket.Items
                .OrderBy(item => item.ItemName)
                .Select(item => new KitchenTicketItemResponse(
                    item.ItemName,
                    item.Quantity,
                    item.Note))
                .ToList());
}
