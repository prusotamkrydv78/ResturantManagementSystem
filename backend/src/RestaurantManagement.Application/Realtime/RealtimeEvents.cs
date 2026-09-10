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

    /// <summary>
    /// A ticket taken back off the pass and put back on the stove.
    ///
    /// Its own name rather than reusing <see cref="TicketStarted"/>, because the two
    /// have different audiences. Starting is kitchen business - it stops a second chef
    /// reaching for the same slip - and telling the floor about it would put a toast on
    /// a waiter's phone for every ticket that gets picked up. A recall is the opposite:
    /// the floor has to hear it, because a plate it was about to fetch has gone.
    /// </summary>
    public const string TicketRecalled = "ticketRecalled";

    /// <summary>A waiter took the food to the table.</summary>
    public const string TicketServed = "ticketServed";

    /// <summary>A table has asked for their bill.</summary>
    public const string BillRequested = "billRequested";

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
/// A table asking to pay.
/// </summary>
/// <param name="OrderId">So a waiter can open it.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="TableName">Where to go. The only thing a waiter navigates by.</param>
/// <param name="Total">
/// What they owe, so the waiter can pick up the card machine knowing the figure rather
/// than walking to the table to find out.
/// </param>
public sealed record BillRequestedEvent(
    Guid OrderId,
    int OrderNumber,
    string TableName,
    decimal Total);

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
/// <param name="WaitingAtPassCount">
/// How many units are cooked and still sitting at the pass.
///
/// Not the same as <paramref name="ItemCount"/>, and the difference is the whole point
/// of per-dish progress. A slip of momo and samosa fires this event when the samosa is
/// done, and telling the floor that three items are waiting when one of them is would
/// send a waiter looking for food that is still on the stove.
/// </param>
/// <param name="IsFullyReady">
/// Whether every dish on the ticket is cooked.
///
/// What separates "some of your food is up" from "your food is up", which is a
/// distinction the customer's phone has to get right: it is the difference between a
/// guest walking over to a pass and a guest being told to expect a plate that is
/// fifteen minutes away.
/// </param>
public sealed record TicketEvent(
    Guid TicketId,
    int TicketNumber,
    Guid OrderId,
    int OrderNumber,
    string TableName,
    int ItemCount,
    int WaitingAtPassCount,
    bool IsFullyReady);
