namespace RestaurantManagement.Application.Realtime;

/// <summary>
/// The names the client listens on.
///
/// Constants rather than literals scattered through the code, because a typo in one of
/// these is a silent failure: the server publishes happily and no screen ever hears it.
/// </summary>
public static class RealtimeEventNames
{
    /// <summary>A customer placed an order and it is waiting to be checked.</summary>
    public const string OrderPlaced = "orderPlaced";

    /// <summary>A waiter agreed a customer's order with the table.</summary>
    public const string OrderConfirmed = "orderConfirmed";

    /// <summary>Lines went through to the kitchen as a ticket.</summary>
    public const string TicketQueued = "ticketQueued";

    /// <summary>The kitchen picked a ticket up.</summary>
    public const string TicketStarted = "ticketStarted";

    /// <summary>Food reached the pass and needs carrying.</summary>
    public const string TicketReady = "ticketReady";

    /// <summary>A waiter took the food to the table.</summary>
    public const string TicketServed = "ticketServed";

    /// <summary>
    /// How far along a customer's own order is, sent to that customer alone.
    ///
    /// One name for all five stages rather than five events. A phone following its own
    /// order wants the latest position, not a taxonomy, and a single handler that reads
    /// the stage is less to get wrong than five that must all be registered.
    /// </summary>
    public const string CustomerOrderUpdate = "customerOrderUpdate";
}

/// <summary>
/// A customer's order arriving on the floor.
/// </summary>
/// <param name="OrderId">So a screen can open it.</param>
/// <param name="OrderNumber">What staff say out loud.</param>
/// <param name="TableName">Where they are sitting, which is what a waiter acts on.</param>
/// <param name="ItemCount">How many units, for a one-line summary.</param>
/// <param name="Subtotal">What it comes to.</param>
public sealed record OrderPlacedEvent(
    Guid OrderId,
    int OrderNumber,
    string TableName,
    int ItemCount,
    decimal Subtotal);

/// <summary>
/// A customer's order having been agreed with the table.
///
/// Sent to the floor rather than to the kitchen. The kitchen has nothing to do yet -
/// confirming opens the door, and a waiter still chooses when the food goes through.
/// What it tells other waiters is that this one is handled, so two people do not walk
/// to the same table.
/// </summary>
/// <param name="OrderId">The order.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="TableName">The table.</param>
/// <param name="ConfirmedByName">Who went over.</param>
public sealed record OrderConfirmedEvent(
    Guid OrderId,
    int OrderNumber,
    string TableName,
    string ConfirmedByName);

/// <summary>
/// A ticket moving through the kitchen, and then off it.
///
/// One shape for queued, started, ready and served, because every one of them answers
/// the same four questions and a screen reacting to them wants the same fields. The
/// event name says which happened.
/// </summary>
/// <param name="TicketId">The ticket.</param>
/// <param name="TicketNumber">What the kitchen calls out.</param>
/// <param name="OrderId">The order behind it, so a waiter can open it.</param>
/// <param name="OrderNumber">Readable order number.</param>
/// <param name="TableName">Where the food is going.</param>
/// <param name="ItemCount">How many units are on it.</param>
public sealed record TicketEvent(
    Guid TicketId,
    int TicketNumber,
    Guid OrderId,
    int OrderNumber,
    string TableName,
    int ItemCount);
