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
