using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Orders;

/// <summary>
/// The waiter ordering workflow.
///
/// Every method takes the authenticated staff identifier and derives the restaurant
/// from it, the same way staff, tables and menu administration do. No method accepts
/// a restaurant identifier, and the caller must be an active waiter: a deactivated
/// account is rejected here as well as at sign in, so an access token issued just
/// before deactivation cannot be used to take orders.
///
/// The reads are purpose-built for ordering rather than reusing the manager
/// administration APIs, so a waiter never sees an inactive table, a hidden category
/// or an unavailable item.
/// </summary>
public interface IOrderService
{
    /// <summary>Restaurant name and counts for the waiter workspace.</summary>
    Task<Result<WaiterContextResponse>> GetContextAsync(
        Guid staffUserId,
        CancellationToken cancellationToken);

    /// <summary>Tables in service, which are the only ones that can take an order.</summary>
    Task<Result<IReadOnlyList<WaiterTableResponse>>> GetTablesAsync(
        Guid staffUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The orderable menu: active categories with their active items. Empty
    /// categories are left out, since there is nothing to order from them.
    /// </summary>
    Task<Result<IReadOnlyList<WaiterMenuCategoryResponse>>> GetMenuAsync(
        Guid staffUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Places an order.
    ///
    /// Every submitted item is validated against the caller own available menu
    /// first, so a single bad line rejects the whole request rather than producing a
    /// partial order. Names and prices are read from the server and stored as
    /// snapshots, and the total is calculated from those snapshots.
    /// </summary>
    Task<Result<OrderResponse>> CreateAsync(
        Guid staffUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken);

    /// <summary>Loads one order placed in the caller restaurant.</summary>
    Task<Result<OrderResponse>> GetByIdAsync(
        Guid staffUserId,
        Guid orderId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Open orders for the caller restaurant, newest first.
    ///
    /// Scoped to the restaurant rather than to the individual waiter: cover is
    /// shared in practice, and whoever is on the floor needs to pick up an open
    /// table. Who placed each order is still recorded and shown, so accountability
    /// is not lost, and no assignment, ownership or shift concept is introduced.
    /// </summary>
    Task<Result<IReadOnlyList<OrderSummaryResponse>>> GetOpenAsync(
        Guid staffUserId,
        int limit,
        CancellationToken cancellationToken);

    /// <summary>
    /// Applies the submitted state to an open order.
    ///
    /// Existing lines keep the name and price they were created with, so changing a
    /// quantity never re-prices history. Newly added items are validated against the
    /// live menu and get their own fresh snapshot. Lines the request leaves out are
    /// removed, an order is never left with nothing on it, and the totals are
    /// recalculated by the server from its own figures.
    /// </summary>
    Task<Result<OrderResponse>> UpdateAsync(
        Guid staffUserId,
        Guid orderId,
        UpdateOrderRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Food that is cooked and waiting for somebody to carry it to a table.
    /// </summary>
    /// <remarks>
    /// Restaurant-wide, like the open order list and for the same reason: whoever is on
    /// the floor takes what is at the pass, and food going cold while its waiter is
    /// busy elsewhere is the problem, not the solution.
    ///
    /// This is what makes the "your food is ready" alert survive a locked phone. The
    /// notification is a courtesy; this is the record, and a waiter who missed the
    /// alert finds the same work here.
    /// </remarks>
    Task<Result<IReadOnlyList<PassTicketResponse>>> GetPassAsync(
        Guid staffUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Records that a waiter took a cooked ticket to the table.
    /// </summary>
    /// <remarks>
    /// The ending the kitchen workflow did not have. A ticket used to reach Ready and
    /// stay there for the rest of the evening, so the next person to look could not tell
    /// whether the plate was still sitting at the pass or had been eaten an hour ago.
    ///
    /// Does not move the ticket's status, which belongs to the kitchen and correctly
    /// still says Ready. What changed is whose hands the plate is in.
    ///
    /// Deliberately does not gate settling the bill. A waiter who forgets to tap this
    /// must not be able to strand a table that wants to pay; the record is worth having
    /// and not worth blocking a sale for.
    /// </remarks>
    Task<Result<PassTicketResponse>> MarkTicketServedAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Records that a waiter has checked a customer's order with the table.
    /// </summary>
    /// <remarks>
    /// The step between a customer ordering and the kitchen hearing about it. An order
    /// placed from a phone reaches the floor rather than the pass, and stays there until
    /// somebody goes to the table, reads it back, adjusts whatever was misunderstood -
    /// through the ordinary update, which is why there is no separate editing here - and
    /// then confirms.
    ///
    /// Confirming does two things and no more: it opens the kitchen, and it closes the
    /// customer's own window to cancel. It does not send anything; the waiter still
    /// decides when the order goes through, because the drinks may want to go now and
    /// the food when the rest of the party arrives.
    ///
    /// A waiter's own order needs none of this. It was confirmed by being taken.
    /// </remarks>
    Task<Result<OrderResponse>> ConfirmAsync(
        Guid staffUserId,
        Guid orderId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Sends every line that has not yet gone to the kitchen out as one ticket.
    ///
    /// Refused outright while the order still needs confirming: a customer's order has
    /// to be agreed with the table before the kitchen starts on it.
    ///
    /// One submission produces one ticket holding those lines, not a ticket per item.
    /// From that point the lines are kitchen history and can no longer be changed or
    /// removed, while the order itself stays open so more can be added and submitted
    /// later.
    ///
    /// Refused when there is nothing waiting. Two waiters submitting the same order
    /// at once cannot both succeed: the second is turned away rather than the kitchen
    /// being told to cook the same food twice.
    /// </summary>
    Task<Result<SubmitToKitchenResponse>> SubmitToKitchenAsync(
        Guid staffUserId,
        Guid orderId,
        CancellationToken cancellationToken);
}
