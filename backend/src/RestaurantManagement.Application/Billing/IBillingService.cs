using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Billing;

/// <summary>
/// Billing and order closure for a restaurant manager.
///
/// Every method takes the authenticated manager identifier and derives the restaurant
/// from it, the same way every other manager module does. No method accepts a
/// restaurant identifier, and no method accepts an amount: what a table owes is
/// already stored, so letting a client name a figure would make the total advisory.
///
/// Purpose-built for the counter rather than reusing the waiter endpoints. A waiter
/// assembles an order; a manager reviews a finished one and closes it. The two need
/// different fields and different rules, and sharing a surface would mean one of them
/// carrying the other permissions.
/// </summary>
public interface IBillingService
{
    /// <summary>
    /// Orders for the caller restaurant, newest first.
    ///
    /// Open orders by default, which is the queue at the counter. Recently completed
    /// ones can be included so a manager can confirm what was just settled; that is
    /// a short lookback for the workflow, not a report.
    /// </summary>
    Task<Result<IReadOnlyList<BillingOrderSummaryResponse>>> GetOrdersAsync(
        Guid managerUserId,
        bool includeCompleted,
        CancellationToken cancellationToken);

    /// <summary>
    /// One order in full, with its lines at the prices they were ordered at, its
    /// kitchen tickets, its payment if it has one, and whether it may be closed.
    /// </summary>
    Task<Result<BillingOrderResponse>> GetOrderAsync(
        Guid managerUserId,
        Guid orderId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Records the payment, closes the order, and gives the table back.
    ///
    /// Deliberately one operation and one transaction. An order closed with no
    /// payment against it, and a payment recorded against an order still open, are
    /// both states this product must never hold, so neither is reachable on its own.
    /// The table follows the same transaction: if anything refuses, the table stays
    /// occupied.
    ///
    /// The amount is read from the stored order total. The request carries only the
    /// method.
    ///
    /// Refused when the order is already closed, already paid, or still has kitchen
    /// work running. Two managers settling the same order at once cannot both
    /// succeed: the loser is told rather than a second payment being written.
    /// </summary>
    Task<Result<RecordPaymentResponse>> RecordPaymentAsync(
        Guid managerUserId,
        Guid orderId,
        RecordPaymentRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Calls an order off without payment, and gives the table back.
    ///
    /// The other ending, and the same shape as settling: one operation, one
    /// transaction, and the table released inside it so a refusal leaves the table
    /// occupied.
    ///
    /// Nothing is deleted. The order keeps its number, its lines keep their snapshots,
    /// and any kitchen tickets keep their own status: they record work the kitchen
    /// really did, and the order ending badly does not make that untrue. What changes
    /// is the order status, plus who called it off and why.
    ///
    /// Refused for an order that has already ended, and for one that has been paid,
    /// since there is no refund to undo the payment with. Deliberately not refused for
    /// an order the kitchen is still cooking: waiting for food nobody will pay for
    /// would strand the order open with no way out.
    /// </summary>
    Task<Result<BillingOrderResponse>> CancelOrderAsync(
        Guid managerUserId,
        Guid orderId,
        CancelOrderRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Orders that have ended, newest first, however they ended.
    ///
    /// A history list and not a report: one row per order with its outcome, and no
    /// totals, groupings or averages. Bounded by a caller limit rather than paged,
    /// which matches every other list in this product.
    /// </summary>
    Task<Result<IReadOnlyList<OrderHistoryEntryResponse>>> GetHistoryAsync(
        Guid managerUserId,
        OrderStatus? status,
        int limit,
        CancellationToken cancellationToken);

    /// <summary>
    /// The receipt for an order that was paid for.
    ///
    /// Assembled from records that already exist rather than stored, so asking twice
    /// produces the same document instead of a second one. Refused for an order that
    /// is still open or was cancelled: no money was taken, so there is nothing to
    /// give a receipt for, and issuing one anyway would state that a bill was settled
    /// when it was not.
    /// </summary>
    Task<Result<ReceiptResponse>> GetReceiptAsync(
        Guid managerUserId,
        Guid orderId,
        CancellationToken cancellationToken);
}
