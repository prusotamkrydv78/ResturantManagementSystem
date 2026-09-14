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
        var restaurantId = await ResolveKitchenRestaurantAsync(staffUserId, cancellationToken);

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
        else if (status.Value == KitchenTicketStatus.Ready)
        {
            // Asked for the pass, not for the evening's history. A Ready ticket that a
            // waiter has carried is finished with as far as any screen is concerned,
            // and including it would grow this list all night and bury the plates that
            // are actually sitting there.
            query = query.Where(ticket =>
                ticket.Status == KitchenTicketStatus.Ready &&
                ticket.ServedAtUtc == null);
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
        var restaurantId = await ResolveKitchenRestaurantAsync(staffUserId, cancellationToken);

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

    /// <inheritdoc />
    public Task<Result<KitchenTicketResponse>> MarkItemReadyAsync(
        Guid staffUserId,
        Guid ticketId,
        Guid itemId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            staffUserId,
            ticketId,
            (ticket, now) => ticket.TryMarkItemReady(itemId, now),
            KitchenErrors.NotCookable,
            "marked a dish ready on",
            // Told to the floor either way, and deliberately on every tick rather than
            // only on the last one. One cooked dish is a plate at the pass going cold,
            // which is work for a waiter whether or not the rest of the slip is done.
            (realtime, restaurantId, payload, token) =>
                realtime.TicketReadyAsync(restaurantId, payload, token),
            cancellationToken);

    /// <inheritdoc />
    public Task<Result<KitchenTicketResponse>> RecallItemAsync(
        Guid staffUserId,
        Guid ticketId,
        Guid itemId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            staffUserId,
            ticketId,
            (ticket, now) => ticket.TryRecallItem(itemId, now),
            KitchenErrors.NotRecallable,
            "recalled a dish on",
            // The recall announcement, same as pulling a whole slip back.
            //
            // This said start, and start reaches the kitchen group alone - so unticking
            // a single dish left the pass showing a plate that had gone back on the
            // stove. The whole-ticket path had already been fixed and this one had not,
            // which made the bug look intermittent: recalling a slip worked and
            // unticking a dish on it did not, and the two are the same gesture to
            // anybody using the screen.
            (realtime, restaurantId, payload, token) =>
                realtime.TicketRecalledAsync(restaurantId, payload, token),
            cancellationToken);

    /// <inheritdoc />
    public Task<Result<KitchenTicketResponse>> RecallAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            staffUserId,
            ticketId,
            (ticket, now) => ticket.TryRecall(now),
            KitchenErrors.NotRecallable,
            "recalled",
            // Its own announcement, reaching the floor as well as the kitchen. It used
            // to go out as a start, which only ever reached the kitchen group - so the
            // pass kept showing a plate that had gone back on the stove until its next
            // poll, and a waiter could walk over to fetch nothing.
            (realtime, restaurantId, payload, token) =>
                realtime.TicketRecalledAsync(restaurantId, payload, token),
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
        var restaurantId = await ResolveKitchenRestaurantAsync(staffUserId, cancellationToken);

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
                ticket.Items.Sum(item => item.Quantity),
                ticket.Items
                    .Where(item => item.IsWaitingAtPass)
                    .Sum(item => item.Quantity),
                ticket.Items.All(item => item.IsReady)),
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
    /// Confirms the caller may work this kitchen, and returns their restaurant.
    ///
    /// An active chef, or the restaurant's manager. The manager half is the fix for a
    /// screen the person answerable for the room could not open - the policy explains
    /// why - and it has to be here as well as on the policy, because the policy reads a
    /// token and this reads the account. An access token issued moments before an
    /// account was switched off would otherwise keep working until it expired.
    ///
    /// There is no chef assignment on a ticket, so anybody who gets this far can work
    /// the whole queue, which is how a kitchen actually runs.
    /// </summary>
    private async Task<Guid?> ResolveKitchenRestaurantAsync(
        Guid staffUserId,
        CancellationToken cancellationToken)
    {
        // A manager and a chef belong to a restaurant in two different places, and
        // this used to look in only one of them.
        //
        // Staff carry RestaurantId on the account. A manager does not: ownership is a
        // single foreign key the other way round, Restaurant.ManagerId, so a manager
        // account has a null RestaurantId and always will. When the policy above was
        // widened to let managers work the rail, this query was left asking for a
        // column that is never set for them - so the API accepted the request and then
        // refused it, with a message saying the account could not work the kitchen.
        var rows = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == staffUserId && user.IsActive)
            .Select(user => new
            {
                user.PlatformRole,
                user.StaffRole,
                StaffRestaurantId = user.RestaurantId,
                ManagedRestaurantId = _dbContext.Restaurants
                    .Where(restaurant => restaurant.ManagerId == user.Id)
                    .Select(restaurant => (Guid?)restaurant.Id)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            return null;
        }

        var account = rows[0];

        return account.PlatformRole switch
        {
            PlatformRole.RestaurantManager => account.ManagedRestaurantId,
            PlatformRole.Staff when account.StaffRole == StaffRole.Chef =>
                account.StaffRestaurantId,
            _ => null,
        };
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
            ticket.ReadyItemCount,
            ticket.CreatedAtUtc,
            ticket.StartedAtUtc,
            ticket.ReadyAtUtc,
            ticket.ServedAtUtc,
            // In the order the waiter sent them, which for a Version 7 identifier is
            // the order they were created in.
            //
            // They were alphabetical, which is the one ordering no kitchen uses: it
            // scrambles what the waiter wrote down, splits a course, and puts the
            // starters somewhere in the middle. A chef reading a ticket top to bottom
            // should be reading the same sequence the floor read out.
            ticket.Items
                .OrderBy(item => item.Id)
                .Select(item => new KitchenTicketItemResponse(
                    item.Id,
                    item.ItemName,
                    item.Quantity,
                    item.Note,
                    item.Course,
                    item.ReadyAtUtc,
                    item.ServedAtUtc))
                .ToList());
}
