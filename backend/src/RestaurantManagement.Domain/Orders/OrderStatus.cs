namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// Where an order sits in its lifecycle.
///
/// One beginning and two ends, all of them one way. An order opens, and then either
/// the bill is settled or the order is called off; there is no path back to Open from
/// either, and no state for a partly cancelled order, because nothing in this product
/// cancels part of one.
///
/// Deliberately separate from <see cref="KitchenTicketStatus"/>. An order stays Open
/// while every ticket it produced runs through the kitchen, and neither ending
/// rewrites a ticket: what the kitchen was asked to cook is a record of work that was
/// really done, whatever later became of the order.
/// </summary>
public enum OrderStatus
{
    /// <summary>
    /// Placed by a waiter and sitting on a table. Still editable, still able to send
    /// work to the kitchen, and still unpaid.
    ///
    /// Called Open rather than Draft because the order is real and committed the
    /// moment it is created: the waiter assembles it in the client, so there is no
    /// half-finished server-side state to describe.
    /// </summary>
    Open = 0,

    /// <summary>
    /// Paid and closed by a manager, and the table given back.
    ///
    /// A financial record from here on. Nothing edits a completed order: the waiter
    /// workflow refuses it because only an open order is editable, and there is no
    /// path that reopens one.
    /// </summary>
    Completed = 1,

    /// <summary>
    /// Called off by a manager without payment, and the table given back.
    ///
    /// Not a deletion, and deliberately not a gap in the numbering: the order, its
    /// lines and any kitchen tickets it raised all stay exactly as they were, with
    /// this status recording that no money was taken. A restaurant needs to be able
    /// to ask later why a table produced nothing, and an order that had simply
    /// vanished could not answer.
    /// </summary>
    Cancelled = 2,
}
