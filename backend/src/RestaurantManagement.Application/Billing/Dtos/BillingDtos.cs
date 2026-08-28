using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Application.Billing.Dtos;

/// <summary>
/// One line of a bill, as it was recorded when ordered.
///
/// These are the snapshots the order has carried since it was placed. A menu price
/// change after the fact cannot move them, which is the whole reason the order stores
/// its own copies.
/// </summary>
/// <param name="ItemName">Name at the time of ordering.</param>
/// <param name="UnitPrice">Price at the time of ordering.</param>
/// <param name="Quantity">How many.</param>
/// <param name="Note">The guest instruction, when there was one.</param>
/// <param name="LineTotal">Server-calculated line amount.</param>
/// <param name="IsSubmittedToKitchen">Whether it ever went to the kitchen.</param>
/// <param name="KitchenTicketNumber">The ticket it went out on, if it did.</param>
public sealed record BillingOrderItemResponse(
    string ItemName,
    decimal UnitPrice,
    int Quantity,
    string? Note,
    decimal LineTotal,
    bool IsSubmittedToKitchen,
    int? KitchenTicketNumber);

/// <summary>
/// A kitchen ticket as billing needs to see it: enough to explain why an order is or
/// is not ready to close, and nothing about the cooking itself.
/// </summary>
/// <param name="TicketNumber">The number the kitchen calls out.</param>
/// <param name="Status">Where the ticket is in the kitchen workflow.</param>
/// <param name="ItemCount">How many units went out on it.</param>
/// <param name="CreatedAtUtc">When it was sent.</param>
public sealed record BillingKitchenTicketResponse(
    int TicketNumber,
    KitchenTicketStatus Status,
    int ItemCount,
    DateTimeOffset CreatedAtUtc);

/// <summary>
/// The record that an order was paid for.
///
/// No provider, reference or outcome: nothing was processed, so there is nothing to
/// report the state of.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Amount">What was taken, from the server order total.</param>
/// <param name="Method">How the money arrived.</param>
/// <param name="RecordedByName">The manager who recorded it.</param>
/// <param name="RecordedAtUtc">When it was recorded.</param>
public sealed record PaymentResponse(
    Guid Id,
    decimal Amount,
    PaymentMethod Method,
    string RecordedByName,
    DateTimeOffset RecordedAtUtc);

/// <summary>
/// One order in the billing queue, without its lines.
///
/// Carries the eligibility answer and the counts behind it, so the list can mark
/// what is actionable without a request per row and without recomputing the rule on
/// the client.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="Status">Open, Completed or Cancelled.</param>
/// <param name="TableName">What staff call the table.</param>
/// <param name="Subtotal">Server-calculated sum of the lines.</param>
/// <param name="ItemCount">How many units in total.</param>
/// <param name="PlacedByName">The waiter who took it.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
/// <param name="CompletedAtUtc">When it was paid and closed, if it was.</param>
/// <param name="KitchenTicketCount">How many submissions it produced.</param>
/// <param name="UnfinishedKitchenTicketCount">
/// Tickets not yet at the pass. Zero is what the kitchen rule requires, and the
/// number is sent rather than just the verdict so the reason can be shown.
/// </param>
/// <param name="UnsentItemCount">
/// Lines the kitchen has never been told about. Zero is required before the bill can be
/// settled, and the number is sent rather than just the verdict so a list can say which
/// of the two kitchen conditions is holding an order up: nothing sent, or nothing ready.
/// </param>
/// <param name="CanComplete">Whether it may be paid for and closed now.</param>
/// <param name="Payment">The payment record, once there is one.</param>
/// <param name="Cancellation">Why it was called off, if it was.</param>
public sealed record BillingOrderSummaryResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    string TableName,
    decimal Subtotal,
    int ItemCount,
    string PlacedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    int KitchenTicketCount,
    int UnfinishedKitchenTicketCount,
    int UnsentItemCount,
    bool CanComplete,
    PaymentResponse? Payment,
    CancellationResponse? Cancellation);

/// <summary>One order in full, as the manager reviews it before settling.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="Status">Open, Completed or Cancelled.</param>
/// <param name="TableName">What staff call the table.</param>
/// <param name="TableCapacity">How many the table seats.</param>
/// <param name="Subtotal">Server-calculated sum of the lines, and the amount due.</param>
/// <param name="ItemCount">How many units in total.</param>
/// <param name="PlacedByName">The waiter who took it.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
/// <param name="CompletedAtUtc">When it was paid and closed, if it was.</param>
/// <param name="UnfinishedKitchenTicketCount">Tickets not yet at the pass.</param>
/// <param name="UnsubmittedItemCount">
/// Units the waiter never sent to the kitchen. Shown for information: it does not
/// block closing, because an order of only drinks legitimately has no ticket at all.
/// </param>
/// <param name="StartedKitchenTicketCount">
/// Tickets the kitchen has already picked up or finished. Does not stop a
/// cancellation; it is what tells the manager what calling the order off throws away.
/// </param>
/// <param name="CanComplete">Whether it may be paid for and closed now.</param>
/// <param name="CanCancel">Whether it may be called off now.</param>
/// <param name="Payment">The payment record, once there is one.</param>
/// <param name="Cancellation">Why it was called off, if it was.</param>
/// <param name="Items">The lines, at the prices they were ordered at.</param>
/// <param name="KitchenTickets">Its submissions, newest first.</param>
public sealed record BillingOrderResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    string TableName,
    int TableCapacity,
    decimal Subtotal,
    int ItemCount,
    string PlacedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    int UnfinishedKitchenTicketCount,
    int UnsubmittedItemCount,
    int StartedKitchenTicketCount,
    bool CanComplete,
    bool CanCancel,
    PaymentResponse? Payment,
    CancellationResponse? Cancellation,
    IReadOnlyList<BillingOrderItemResponse> Items,
    IReadOnlyList<BillingKitchenTicketResponse> KitchenTickets);

/// <summary>
/// Payload for settling an order.
///
/// Carries the method and nothing else. There is deliberately no amount field: the
/// server takes the total from the order it already stored, so a client cannot
/// decide what a table paid. There is no order identifier either, because that is
/// the route.
/// </summary>
public sealed class RecordPaymentRequest
{
    /// <summary>
    /// How the money arrived. Required, and validated against the enum, so an
    /// unrecognised tender is refused rather than stored as a zero.
    /// </summary>
    [Required(ErrorMessage = "Choose how the bill was paid.")]
    [EnumDataType(
        typeof(PaymentMethod),
        ErrorMessage = "Choose cash, card or a digital payment.")]
    public PaymentMethod Method { get; set; }
}

/// <summary>The result of settling an order.</summary>
/// <param name="Payment">The record that was written.</param>
/// <param name="Order">
/// The order as it now stands, closed, so the interface can confirm without asking
/// again.
/// </param>
public sealed record RecordPaymentResponse(
    PaymentResponse Payment,
    BillingOrderResponse Order);

/// <summary>
/// How and why an order was called off.
///
/// A record rather than an absence: the order, its lines and any kitchen tickets it
/// raised all remain, and this explains why no money was taken against them.
/// </summary>
/// <param name="Reason">Why, in the manager own words.</param>
/// <param name="CancelledByName">The manager who called it off.</param>
/// <param name="CancelledAtUtc">When.</param>
public sealed record CancellationResponse(
    string Reason,
    string CancelledByName,
    DateTimeOffset CancelledAtUtc);

/// <summary>
/// Payload for calling an order off.
///
/// The reason and nothing else. A cancellation cannot be silent: an order that
/// produced no money and carries no explanation is the gap this whole state exists
/// to prevent.
/// </summary>
public sealed class CancelOrderRequest
{
    /// <summary>
    /// Why the order is being called off. Free text on purpose: a fixed list would be
    /// guessing at a restaurant vocabulary.
    /// </summary>
    [Required(ErrorMessage = "Give a reason for cancelling this order.")]
    [StringLength(
        200,
        MinimumLength = 3,
        ErrorMessage = "A reason must be between 3 and 200 characters.")]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// One closed order in the history list.
///
/// Deliberately flat and deliberately not aggregated. This answers "what happened to
/// this table" one row at a time; it is not a report, and it carries no totals,
/// averages or groupings of its own.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="Status">Completed or Cancelled.</param>
/// <param name="TableName">What staff call the table.</param>
/// <param name="Subtotal">What the order came to, whether or not it was paid.</param>
/// <param name="ItemCount">How many units were on it.</param>
/// <param name="PlacedByName">The waiter who took it.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
/// <param name="ClosedAtUtc">
/// When it ended, whichever way it ended, so one column sorts the whole history.
/// </param>
/// <param name="KitchenTicketCount">How many submissions it produced.</param>
/// <param name="Payment">The payment record, for a completed order.</param>
/// <param name="Cancellation">The reason, for a cancelled one.</param>
public sealed record OrderHistoryEntryResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    string TableName,
    decimal Subtotal,
    int ItemCount,
    string PlacedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset ClosedAtUtc,
    int KitchenTicketCount,
    PaymentResponse? Payment,
    CancellationResponse? Cancellation);
