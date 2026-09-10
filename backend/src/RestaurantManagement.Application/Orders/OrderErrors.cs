using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Orders;

/// <summary>Failures the ordering module can report.</summary>
public static class OrderErrors
{
    /// <summary>
    /// The caller is not a waiter attached to an active restaurant account.
    ///
    /// Covers a deactivated account, a staff member with no restaurant, and a
    /// non-waiter reaching the endpoint, all as one message: none of those need to
    /// be told apart by the client.
    /// </summary>
    public static readonly Error NotAnActiveWaiter =
        new("order.not_an_active_waiter", "This account cannot take orders.");

    /// <summary>
    /// The restaurant is suspended, so no new order may be opened.
    ///
    /// Said plainly rather than folded into <see cref="TableUnavailable"/>: a waiter
    /// standing at a table needs to know the problem is not the table, or they will
    /// try the next one and the one after that.
    ///
    /// Only ever raised when an order starts. Orders already open still take items,
    /// still go to the kitchen and still settle, so suspending during service cannot
    /// strand food or a bill.
    /// </summary>
    public static readonly Error RestaurantSuspended =
        new(
            "order.restaurant_suspended",
            "This restaurant is suspended and cannot take new orders. "
            + "Orders already open can still be completed.");

    /// <summary>
    /// The table does not exist in the caller restaurant, or is not in service.
    /// A table from another restaurant reports the same thing.
    /// </summary>
    public static readonly Error TableUnavailable =
        new("order.table_unavailable", "That table is not available for a new order.");

    /// <summary>An order must have at least one line.</summary>
    public static readonly Error NoItems =
        new("order.no_items", "Add at least one item to the order.");

    /// <summary>
    /// One or more of the submitted items is not on the menu right now. Reported for
    /// the whole request, because the order is never partially created.
    /// </summary>
    public static Error ItemsUnavailable(string detail) =>
        new("order.items_unavailable", detail);

    /// <summary>
    /// No order with that identifier exists in the caller restaurant. An order from
    /// another restaurant reports the same thing, so probing identifiers does not
    /// reveal whether one exists elsewhere.
    /// </summary>
    /// <summary>
    /// The caller is not somebody who works this restaurant's floor.
    ///
    /// Told apart from <see cref="NotAnActiveWaiter"/> because the pass admits the
    /// restaurant's manager as well, and answering a manager with "you are not an
    /// active waiter" would be describing the wrong reason for a refusal they can do
    /// nothing about.
    /// </summary>
    public static readonly Error NotOnTheFloor =
        new(
            "orders.not_on_the_floor",
            "Your account is not set up to work this restaurant's floor.");

    public static readonly Error NotFound =
        new("order.not_found", "The order could not be found.");

    /// <summary>
    /// The order is past the point where a waiter may change it. Only an open order
    /// is editable, and that rule lives on the entity rather than here.
    /// </summary>
    public static readonly Error NotEditable =
        new("order.not_editable", "This order can no longer be changed.");

    /// <summary>
    /// A submitted line does not belong to this order, so the update is refused
    /// rather than partially applied.
    /// </summary>
    public static readonly Error LineNotFound =
        new("order.line_not_found", "One of the lines is no longer part of this order.");

    /// <summary>
    /// Someone else saved the order since it was loaded. Refused rather than
    /// overwriting their change.
    /// </summary>
    public static readonly Error Conflict =
        new(
            "order.conflict",
            "Someone else updated this order. Reload it and apply your change again.");

    /// <summary>
    /// The request tried to change or remove a line that has already gone to the
    /// kitchen. Refused rather than partly applied, so the waiter is told instead of
    /// silently losing the edit.
    /// </summary>
    public static readonly Error SubmittedItemLocked =
        new(
            "order.submitted_item_locked",
            "Items already sent to the kitchen cannot be changed or removed.");

    /// <summary>
    /// The order came from a customer and nobody has confirmed it with them yet.
    ///
    /// Not a validation failure but the workflow working. A customer ordering from
    /// their phone has spoken to nobody, so somebody has to read the order back to the
    /// table before the kitchen starts on it - the number of times a phone order is
    /// almost but not quite what the table meant is the whole reason this step exists.
    /// </summary>
    public static readonly Error NeedsConfirmation =
        new(
            "order.needs_confirmation",
            "Check this order with the table and confirm it before sending it to the "
            + "kitchen.");

    /// <summary>
    /// There was nothing to confirm: the order was not placed by a customer, is no
    /// longer open, or somebody has already confirmed it.
    ///
    /// One message for all three, because a waiter looking at a stale screen wants to
    /// know their tap did nothing, not which of three reasons applied.
    /// </summary>
    public static readonly Error NothingToConfirm =
        new(
            "order.nothing_to_confirm",
            "This order does not need confirming. Reload it to see where it stands.");

    /// <summary>
    /// The ticket cannot be marked as delivered.
    ///
    /// Three ways to get here and one message for all of them: another waiter carried
    /// it, the kitchen never finished it, or the kitchen pulled it back off the pass.
    /// A waiter standing at an empty pass wants to know their tap did nothing, not
    /// which of three reasons applied.
    ///
    /// It no longer tells them to reload. It used to, and by the time anybody read it
    /// the screen had already corrected itself - so the instruction was both wrong and
    /// the only thing on screen suggesting something was broken.
    /// </summary>
    public static readonly Error NotAtPass =
        new(
            "order.not_at_pass",
            "That food is no longer at the pass. It has either gone out already or "
            + "gone back to the kitchen.");

    /// <summary>There is nothing waiting to be sent to the kitchen.</summary>
    public static readonly Error NothingToSubmit =
        new(
            "order.nothing_to_submit",
            "Every item on this order has already been sent to the kitchen.");

    /// <summary>
    /// Someone submitted the same lines first. Reported rather than creating a second
    /// ticket for food the kitchen is already cooking.
    /// </summary>
    public static readonly Error AlreadySubmitted =
        new(
            "order.already_submitted",
            "These items were just sent to the kitchen by someone else. Reload the order.");

    /// <summary>
    /// A readable ticket number could not be reserved despite retrying.
    /// </summary>
    public static readonly Error TicketNumberUnavailable =
        new(
            "order.ticket_number_unavailable",
            "Could not assign a kitchen ticket number just now. Please try again.");

    /// <summary>
    /// A readable order number could not be reserved despite retrying, which means
    /// sustained contention rather than a normal collision.
    /// </summary>
    public static readonly Error NumberUnavailable =
        new(
            "order.number_unavailable",
            "Could not assign an order number just now. Please try again.");
}
