using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Billing;

/// <summary>Failures the billing module can report.</summary>
public static class BillingErrors
{
    /// <summary>
    /// The caller manages no restaurant, so there is nothing for them to bill. The
    /// same message covers an account that never had one and one whose restaurant
    /// was reassigned.
    /// </summary>
    public static readonly Error NoRestaurantAssigned =
        new(
            "billing.no_restaurant",
            "No restaurant is assigned to this account yet.");

    /// <summary>
    /// No order with that identifier exists in the caller restaurant. An order from
    /// another restaurant reports the same thing, so probing identifiers never
    /// reveals that one exists elsewhere.
    /// </summary>
    public static readonly Error OrderNotFound =
        new("billing.order_not_found", "That order could not be found.");

    /// <summary>
    /// The order is already closed. Reported rather than treated as success, because
    /// a second confirmation would suggest a second payment was taken.
    /// </summary>
    public static readonly Error AlreadyCompleted =
        new(
            "billing.already_completed",
            "This order has already been paid for and closed.");

    /// <summary>
    /// A payment already exists against this order. Distinct from the above so a
    /// half-written state, which the schema prevents, would still report honestly.
    /// </summary>
    public static readonly Error AlreadyPaid =
        new(
            "billing.already_paid",
            "A payment has already been recorded for this order.");

    /// <summary>
    /// Some of the order has never been sent to the kitchen.
    ///
    /// Refused rather than warned about. Food the kitchen was never asked to cook was
    /// never made and never served, so billing for it records revenue against nothing.
    /// The waiter has to send it through first, which is also what puts the ingredients
    /// against the order in the stock ledger.
    ///
    /// About lines rather than tickets on purpose: requiring merely that some ticket
    /// exists would let three lines be billed after only one had gone through.
    /// </summary>
    public static Error NotSentToKitchen(int unsent) =>
        new(
            "billing.not_sent_to_kitchen",
            unsent == 1
                ? "One item on this order has never been sent to the kitchen. Ask the waiter to send it through before settling."
                : $"{unsent} items on this order have never been sent to the kitchen. Ask the waiter to send them through before settling.");

    /// <summary>
    /// The kitchen has not finished. The count is folded into the message so the
    /// manager is told what to wait for rather than just being refused.
    /// </summary>
    public static Error KitchenNotReady(int unfinished) =>
        new(
            "billing.kitchen_not_ready",
            unfinished == 1
                ? "One kitchen ticket on this order is not ready yet."
                : $"{unfinished} kitchen tickets on this order are not ready yet.");

    /// <summary>
    /// The order has already ended, one way or the other, so there is nothing left to
    /// call off.
    /// </summary>
    public static readonly Error NotOpen =
        new(
            "billing.order_not_open",
            "This order is already closed and cannot be cancelled.");

    /// <summary>
    /// A payment exists, so the order cannot be called off.
    ///
    /// There is no refund in this product. Cancelling a paid order would leave a
    /// record saying money was taken for something that never happened, which is worse
    /// than refusing.
    /// </summary>
    public static readonly Error PaidCannotCancel =
        new(
            "billing.paid_cannot_cancel",
            "This order has been paid for and cannot be cancelled.");

    /// <summary>
    /// There is no receipt for this order, because no money was taken for it.
    ///
    /// An open order has not been paid and a cancelled one never will be. Producing a
    /// document for either would be stating that a table settled a bill it did not,
    /// which is the one thing a receipt must never do.
    /// </summary>
    public static readonly Error NoReceipt =
        new(
            "billing.no_receipt",
            "This order has no receipt: it has not been paid for.");

    /// <summary>
    /// Someone else changed the order between it being read and written. Refused
    /// rather than closing an order that moved underneath.
    /// </summary>
    public static readonly Error Conflict =
        new(
            "billing.conflict",
            "This order was just updated by someone else. Reload it and try again.");
}
