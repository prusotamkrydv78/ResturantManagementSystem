using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Application.Reports.Dtos;

/// <summary>What came in by one tender over the range asked for.</summary>
/// <param name="Method">The tender.</param>
/// <param name="Count">How many bills were settled with it.</param>
/// <param name="Total">What they came to.</param>
public sealed record MethodTotalResponse(PaymentMethod Method, int Count, decimal Total);

/// <summary>
/// One order that ended, listed rather than aggregated.
///
/// Enough to recognise it and open its receipt, and no more: a report is a set of
/// figures with the rows behind them, not a second billing screen.
/// </summary>
/// <param name="Id">Identifier, so a row can link to the order or its receipt.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="TableName">Where it was served.</param>
/// <param name="Amount">
/// What was taken for a completed order, or what a cancelled one would have come to.
/// Which of the two it is, is decided by the list the row appears in.
/// </param>
/// <param name="ItemCount">Units on it.</param>
/// <param name="ClosedAtUtc">When it ended.</param>
/// <param name="Method">How it was paid. Null for a cancellation.</param>
/// <param name="Reason">Why it was called off. Null for a payment.</param>
public sealed record ReportOrderResponse(
    Guid Id,
    int OrderNumber,
    string TableName,
    decimal Amount,
    int ItemCount,
    DateTimeOffset ClosedAtUtc,
    PaymentMethod? Method,
    string? Reason);

/// <summary>
/// What a restaurant did over a range of its own days.
///
/// Deliberately thin. It answers how much came in, how it came in, and what did not
/// come in at all, with the rows behind each figure. There is no tax, no cost, no
/// margin and no comparison with another period, because none of those exist in this
/// product and a report that implied them would be inventing them.
///
/// The two money figures are kept apart on purpose. Payments are money that arrived;
/// cancelled value is money that did not, and it is never added to anything.
/// </summary>
/// <param name="FromLocalDate">First day covered, in the restaurant own calendar.</param>
/// <param name="ToLocalDate">Last day covered, inclusive.</param>
/// <param name="RangeStartUtc">The instant the range opened.</param>
/// <param name="RangeEndUtc">
/// The instant it closes, exclusive. Sent so the boundaries are auditable rather than
/// implied: a manager can see exactly what was counted.
/// </param>
/// <param name="DayCount">How many service days the range covers.</param>
/// <param name="CompletedCount">Orders paid for and closed in the range.</param>
/// <param name="CancelledCount">Orders called off in the range.</param>
/// <param name="PaymentTotal">Everything taken, across all tenders.</param>
/// <param name="PaymentCount">How many bills were settled.</param>
/// <param name="CancelledValue">
/// What the cancelled orders would have come to. Not revenue, not lost revenue in any
/// accounting sense, and never folded into the total.
/// </param>
/// <param name="AverageOrderValue">
/// Payment total divided by the number of payments, or zero when there were none.
/// Computed here so every screen shows the same figure rather than each dividing for
/// itself.
/// </param>
/// <param name="ByMethod">
/// The same total split by tender, every method listed even at zero so the shape does
/// not change with the range.
/// </param>
/// <param name="Completed">The completed orders, newest first.</param>
/// <param name="Cancelled">The cancelled orders, newest first.</param>
public sealed record ReportSummaryResponse(
    DateOnly FromLocalDate,
    DateOnly ToLocalDate,
    DateTimeOffset RangeStartUtc,
    DateTimeOffset RangeEndUtc,
    int DayCount,
    int CompletedCount,
    int CancelledCount,
    decimal PaymentTotal,
    int PaymentCount,
    decimal CancelledValue,
    decimal AverageOrderValue,
    IReadOnlyList<MethodTotalResponse> ByMethod,
    IReadOnlyList<ReportOrderResponse> Completed,
    IReadOnlyList<ReportOrderResponse> Cancelled);
