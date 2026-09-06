namespace RestaurantManagement.Application.Realtime;

/// <summary>
/// Telling the screens that already have the app open that something happened.
///
/// An abstraction rather than a direct dependency on the transport, so the services that
/// know when something happened do not have to know how it is delivered. They are also
/// the wrong place to care: an order being placed is a fact about a restaurant, not about
/// a websocket.
///
/// Scoped to a restaurant on every method, and that is not a convenience. A hub is one
/// process serving every restaurant on the platform, so an event without a restaurant
/// would be an event broadcast to all of them - table names, order numbers and totals
/// belonging to somebody else's business.
///
/// Split by audience for the same reason. A chef has no use for a customer's order
/// arriving on the floor, and a waiter has no use for a ticket being picked up; sending
/// everything everywhere and filtering on the client would put both restaurants' work on
/// every phone and call it a UI problem.
///
/// Every method is best-effort. Nothing in this product may fail because a notification
/// could not be delivered: the order is already saved by the time one is sent, the
/// screens all have a way to load the truth for themselves, and a waiter whose phone was
/// asleep must still find the order waiting when they look. Implementations swallow their
/// own failures.
/// </summary>
public interface IRealtimeNotifier
{
    /// <summary>Tells the floor a customer has ordered and nobody has agreed it yet.</summary>
    Task OrderPlacedAsync(
        Guid restaurantId,
        OrderPlacedEvent payload,
        CancellationToken cancellationToken);

    /// <summary>Tells the floor that somebody has been over to a table.</summary>
    Task OrderConfirmedAsync(
        Guid restaurantId,
        OrderConfirmedEvent payload,
        CancellationToken cancellationToken);

    /// <summary>Tells the kitchen there is a new ticket on the rail.</summary>
    Task TicketQueuedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tells the kitchen a ticket has been picked up, so two chefs do not start the
    /// same one.
    /// </summary>
    Task TicketStartedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tells the floor there is food at the pass. The one event a waiter has to act on
    /// rather than merely know about.
    /// </summary>
    Task TicketReadyAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tells the customer their bill has been settled and the visit is over.
    ///
    /// Only the customer. The floor took the payment and watched it happen, so telling
    /// them would be reporting their own action back to them.
    /// </summary>
    Task OrderSettledAsync(
        Guid orderId,
        int orderNumber,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tells the floor that a table wants to pay.
    ///
    /// The floor only. A kitchen has nothing to do about a bill, and the whole point of
    /// splitting these by audience is that a chef's screen stays about food.
    /// </summary>
    Task BillRequestedAsync(
        Guid restaurantId,
        BillRequestedEvent payload,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tells both sides the food has gone to the table: the floor so another waiter
    /// stops seeing it as waiting, and the kitchen so the pass clears.
    /// </summary>
    Task TicketServedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken);
}
