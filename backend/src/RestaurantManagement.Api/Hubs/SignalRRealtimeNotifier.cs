using Microsoft.AspNetCore.SignalR;
using RestaurantManagement.Application.Realtime;

namespace RestaurantManagement.Api.Hubs;

/// <summary>
/// Delivers realtime events over SignalR.
///
/// Lives in the API rather than in Infrastructure because it is a transport detail of
/// how this application is hosted, and because SignalR's hub context only exists here.
/// The services that raise these events depend on the interface and never learn that a
/// websocket was involved.
///
/// Every method swallows its own failures, and that is the whole design of this class.
/// A notification is a courtesy on top of work that is already committed: the order is
/// saved, the ticket is on the rail, the food is at the pass. If a hub is unreachable
/// the correct outcome is a screen that finds out twenty seconds later by polling - not
/// a waiter told their order failed, and certainly not a rolled back sale.
///
/// Most of these events also reach the customer whose order it is, on a different hub and
/// in a different shape. That fan-out lives here rather than at the call sites for one
/// reason worth stating: what a customer may be told is a security question, and putting
/// it in one place means it is decided once. The staff payloads carry a waiter's name and
/// a table; the customer's carries a stage and their own order number. A call site that
/// had to remember to translate would eventually forget.
/// </summary>
public sealed class SignalRRealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<OperationsHub> _hub;
    private readonly IHubContext<CustomerHub> _customerHub;
    private readonly ILogger<SignalRRealtimeNotifier> _logger;

    /// <summary>Creates the notifier.</summary>
    public SignalRRealtimeNotifier(
        IHubContext<OperationsHub> hub,
        IHubContext<CustomerHub> customerHub,
        ILogger<SignalRRealtimeNotifier> logger)
    {
        _hub = hub;
        _customerHub = customerHub;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task OrderPlacedAsync(
        Guid restaurantId,
        OrderPlacedEvent payload,
        CancellationToken cancellationToken) =>
        SendAsync(
            OperationsHub.FloorGroup(restaurantId),
            RealtimeEventNames.OrderPlaced,
            payload,
            cancellationToken);

    /// <inheritdoc />
    public async Task OrderConfirmedAsync(
        Guid restaurantId,
        OrderConfirmedEvent payload,
        CancellationToken cancellationToken)
    {
        await SendAsync(
            OperationsHub.FloorGroup(restaurantId),
            RealtimeEventNames.OrderConfirmed,
            payload,
            cancellationToken);

        // The customer hears this one without the waiter's name. Who came over is a
        // fact about the restaurant's staff; that somebody did is what the guest wants.
        await TellCustomerAsync(
            payload.OrderId,
            new CustomerOrderUpdate(payload.OrderNumber, CustomerOrderStage.Confirmed),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task TicketQueuedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken)
    {
        await SendAsync(
            OperationsHub.KitchenGroup(restaurantId),
            RealtimeEventNames.TicketQueued,
            payload,
            cancellationToken);

        await TellCustomerAsync(
            payload.OrderId,
            new CustomerOrderUpdate(payload.OrderNumber, CustomerOrderStage.WithKitchen),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task TicketStartedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken)
    {
        await SendAsync(
            OperationsHub.KitchenGroup(restaurantId),
            RealtimeEventNames.TicketStarted,
            payload,
            cancellationToken);

        await TellCustomerAsync(
            payload.OrderId,
            new CustomerOrderUpdate(payload.OrderNumber, CustomerOrderStage.BeingPrepared),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task TicketReadyAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken)
    {
        await SendAsync(
            OperationsHub.FloorGroup(restaurantId),
            RealtimeEventNames.TicketReady,
            payload,
            cancellationToken);

        await TellCustomerAsync(
            payload.OrderId,
            new CustomerOrderUpdate(payload.OrderNumber, CustomerOrderStage.Ready),
            cancellationToken);
    }

    /// <inheritdoc />
    public Task BillRequestedAsync(
        Guid restaurantId,
        BillRequestedEvent payload,
        CancellationToken cancellationToken) =>
        SendAsync(
            OperationsHub.FloorGroup(restaurantId),
            RealtimeEventNames.BillRequested,
            payload,
            cancellationToken);

    /// <inheritdoc />
    public async Task TicketServedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken)
    {
        // Both sides. The floor so another waiter stops seeing food as waiting, and the
        // kitchen so its pass count clears without a reload.
        await SendAsync(
            OperationsHub.FloorGroup(restaurantId),
            RealtimeEventNames.TicketServed,
            payload,
            cancellationToken);

        await SendAsync(
            OperationsHub.KitchenGroup(restaurantId),
            RealtimeEventNames.TicketServed,
            payload,
            cancellationToken);

        await TellCustomerAsync(
            payload.OrderId,
            new CustomerOrderUpdate(payload.OrderNumber, CustomerOrderStage.Served),
            cancellationToken);
    }

    /// <summary>
    /// Tells the customer following this order how far along it is.
    ///
    /// A no-op for every order nobody is following, which is most of them: the group is
    /// named after the order, and only a connection that presented that order's key is
    /// in it. An order a waiter typed has no customer watching and costs one send to an
    /// empty group.
    /// </summary>
    private Task TellCustomerAsync(
        Guid orderId,
        CustomerOrderUpdate update,
        CancellationToken cancellationToken) =>
        SendAsync(
            _customerHub.Clients,
            CustomerHub.OrderGroup(orderId),
            RealtimeEventNames.CustomerOrderUpdate,
            update,
            cancellationToken);

    /// <summary>
    /// Sends one event to one group, and never lets a failure escape.
    ///
    /// Logged at warning rather than swallowed silently: nothing breaks, but a hub that
    /// has stopped delivering is worth being able to find in a log when somebody reports
    /// that their screen went quiet.
    /// </summary>
    private async Task SendAsync(
        string group,
        string eventName,
        object payload,
        CancellationToken cancellationToken)
    {
        await SendAsync(_hub.Clients, group, eventName, payload, cancellationToken);
    }

    /// <summary>
    /// Sends one event to one group on a named hub, and never lets a failure escape.
    /// </summary>
    private async Task SendAsync(
        IHubClients clients,
        string group,
        string eventName,
        object payload,
        CancellationToken cancellationToken)
    {
        try
        {
            await clients.Group(group).SendAsync(eventName, payload, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Could not deliver realtime event {EventName} to {Group}.",
                eventName,
                group);
        }
    }
}
