using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Application.Dashboard.Dtos;

/// <summary>
/// A kind of thing that happened in the restaurant.
///
/// Exists only to shape the activity feed, which is why it lives here rather than in
/// the domain: none of these is a state anything is in. Each one is a timestamp that
/// already existed on an order or a kitchen ticket, named so the interface can say
/// what it was.
/// </summary>
public enum ActivityKind
{
    /// <summary>A waiter opened an order on a table.</summary>
    OrderPlaced = 0,

    /// <summary>A waiter sent lines to the kitchen as a ticket.</summary>
    SentToKitchen = 1,

    /// <summary>The kitchen picked a ticket up.</summary>
    KitchenStarted = 2,

    /// <summary>A ticket reached the pass.</summary>
    KitchenReady = 3,

    /// <summary>A manager took payment and closed an order.</summary>
    OrderCompleted = 4,

    /// <summary>A manager called an order off.</summary>
    OrderCancelled = 5,
}

/// <summary>
/// One thing that happened, with the facts behind it.
///
/// Carries no sentence to display. The interface composes the wording from the kind
/// and these fields, the same way every other response in this product hands over
/// facts rather than copy.
/// </summary>
/// <param name="Kind">What happened.</param>
/// <param name="AtUtc">When.</param>
/// <param name="OrderId">The order involved, so the row can link to it.</param>
/// <param name="OrderNumber">Its readable number.</param>
/// <param name="TableName">Where.</param>
/// <param name="TicketNumber">The kitchen ticket, for the three kitchen kinds.</param>
/// <param name="Amount">What was taken, for a completed order.</param>
/// <param name="Method">How it was paid, for a completed order.</param>
/// <param name="Reason">Why, for a cancelled order.</param>
public sealed record ActivityEntryResponse(
    ActivityKind Kind,
    DateTimeOffset AtUtc,
    Guid OrderId,
    int OrderNumber,
    string TableName,
    int? TicketNumber,
    decimal? Amount,
    PaymentMethod? Method,
    string? Reason);

/// <summary>What came in by one tender, today.</summary>
/// <param name="Method">The tender.</param>
/// <param name="Count">How many bills were settled with it.</param>
/// <param name="Total">What they came to.</param>
public sealed record PaymentMethodTotalResponse(
    PaymentMethod Method,
    int Count,
    decimal Total);

/// <summary>
/// Order activity right now.
///
/// Everything open, and how much of it the manager can act on. Nothing here is a
/// historical figure.
/// </summary>
/// <param name="OpenCount">Orders currently open.</param>
/// <param name="ReadyToSettleCount">
/// Open orders whose kitchen work is finished, so they can be closed now. The same
/// eligibility the billing screen uses.
/// </param>
/// <param name="OpenValue">What the open orders come to, unpaid and outstanding.</param>
/// <param name="OpenItemCount">Units sitting on open orders.</param>
/// <param name="OldestOpenAtUtc">
/// When the longest-running open order was placed. Null when nothing is open; the
/// elapsed time is derived by the client rather than counted here.
/// </param>
public sealed record OrderActivityResponse(
    int OpenCount,
    int ReadyToSettleCount,
    decimal OpenValue,
    int OpenItemCount,
    DateTimeOffset? OldestOpenAtUtc);

/// <summary>
/// The floor right now.
///
/// Occupancy and being in service are separate things, and both are reported: a
/// table can be out of service and therefore neither occupied nor available.
/// </summary>
/// <param name="TotalCount">Every table in the restaurant.</param>
/// <param name="InServiceCount">Tables a waiter may seat.</param>
/// <param name="OccupiedCount">Tables with an order running.</param>
/// <param name="AvailableCount">Tables in service with nothing on them.</param>
/// <param name="OutOfServiceCount">Tables the manager has taken out of service.</param>
/// <param name="SeatsInService">Covers the restaurant can seat right now.</param>
public sealed record FloorResponse(
    int TotalCount,
    int InServiceCount,
    int OccupiedCount,
    int AvailableCount,
    int OutOfServiceCount,
    int SeatsInService);

/// <summary>
/// The kitchen right now, read from ticket status rather than from anything new.
/// </summary>
/// <param name="PendingCount">Tickets sent through and not yet picked up.</param>
/// <param name="PreparingCount">Tickets being cooked.</param>
/// <param name="UnsubmittedItemCount">
/// Units on open orders that no waiter has sent to the kitchen yet. Not kitchen
/// workload, but the workload about to arrive.
/// </param>
/// <param name="OldestPendingAtUtc">
/// When the longest-waiting ticket was sent. Null when nothing is waiting.
/// </param>
public sealed record KitchenLoadResponse(
    int PendingCount,
    int PreparingCount,
    int UnsubmittedItemCount,
    DateTimeOffset? OldestPendingAtUtc);

/// <summary>
/// What the restaurant has done today.
///
/// A day is not a report. There is no range, no comparison with yesterday and no
/// trend: these are counts and sums for the shift the manager is standing in.
/// </summary>
/// <param name="StartedAtUtc">
/// The instant the day was taken to begin, echoed back so the interface can show
/// which day it is talking about rather than assuming.
/// </param>
/// <param name="CompletedCount">Orders paid for and closed today.</param>
/// <param name="CancelledCount">Orders called off today.</param>
/// <param name="CancelledValue">
/// What the cancelled orders would have come to. Not revenue lost in any accounting
/// sense, which is why it is named for what it is.
/// </param>
/// <param name="PaymentTotal">Everything taken today, across all tenders.</param>
/// <param name="PaymentCount">How many bills were settled.</param>
/// <param name="ByMethod">
/// The same total split by tender, every method listed even at zero, so the shape of
/// the breakdown does not change as the day goes on.
/// </param>
public sealed record TodayResponse(
    DateTimeOffset StartedAtUtc,
    int CompletedCount,
    int CancelledCount,
    decimal CancelledValue,
    decimal PaymentTotal,
    int PaymentCount,
    IReadOnlyList<PaymentMethodTotalResponse> ByMethod);

/// <summary>
/// One service day behind this restaurant.
///
/// Added because the overview could say what the restaurant had taken and never once
/// whether that was good. A total with nothing beside it is a number a manager reads
/// and cannot act on; the same total against the six days before it is a decision
/// about staffing tomorrow.
/// </summary>
/// <param name="LocalDate">The service day.</param>
/// <param name="OrdersPlaced">Orders opened that day, whatever became of them.</param>
/// <param name="Completed">Orders paid for and closed.</param>
/// <param name="Cancelled">Orders called off.</param>
/// <param name="Takings">Everything taken in payments that day.</param>
public sealed record DashboardDayResponse(
    DateOnly LocalDate,
    int OrdersPlaced,
    int Completed,
    int Cancelled,
    decimal Takings);

/// <summary>
/// One hour of the service day now running.
///
/// The shape of a restaurant day is two spikes and a long quiet middle, and which
/// hours those are is the single most useful thing a manager can know about their own
/// room: it decides when people are rota-ed on, when the kitchen preps, and when the
/// floor can be cleaned. The product recorded every timestamp needed to say it and had
/// never said it.
///
/// All twenty-four are sent, the ones still to come included, so a chart has the shape
/// of a whole day from the moment it is opened.
/// </summary>
/// <param name="Hour">Local hour, 0 to 23.</param>
/// <param name="OrdersPlaced">Orders opened in that hour.</param>
/// <param name="Takings">Payments recorded in that hour.</param>
public sealed record DashboardHourResponse(
    int Hour,
    int OrdersPlaced,
    decimal Takings);

/// <summary>
/// Whether the restaurant is set up enough to trade.
///
/// Two facts a manager needs to see when the floor is quiet for the wrong reason: a
/// waiter cannot open an order without a table in service, and cannot add anything
/// to it without something orderable on the menu.
/// </summary>
/// <param name="AvailableMenuItemCount">Items a waiter can actually order.</param>
/// <param name="CanTakeOrders">Whether ordering is possible at all right now.</param>
public sealed record ReadinessResponse(
    int AvailableMenuItemCount,
    bool CanTakeOrders);

/// <summary>
/// The manager operational overview: what is happening in this restaurant right now,
/// plus what it has done today.
///
/// One response for the whole screen, because it is one screen and a dashboard that
/// makes eight requests shows eight different moments. Everything in it is derived
/// from records that already exist; no figure here is stored, and nothing is
/// estimated.
/// </summary>
/// <param name="GeneratedAtUtc">
/// When the server answered. The interface shows this rather than implying the
/// numbers are live to the second.
/// </param>
/// <param name="Orders">Order activity right now.</param>
/// <param name="Floor">Table availability right now.</param>
/// <param name="Kitchen">Kitchen workload right now.</param>
/// <param name="Today">What the restaurant has done today.</param>
/// <param name="Yesterday">
/// The day before, whole, so today can be read as a direction rather than as a
/// number. The same entry that appears second-to-last in <c>Days</c>, handed over
/// separately only so a screen does not have to index into a list to find it.
/// </param>
/// <param name="Days">The last week, oldest first, every day present even at zero.</param>
/// <param name="Hours">Today, hour by hour, all twenty-four.</param>
/// <param name="Readiness">Whether it can trade at all.</param>
/// <param name="Activity">What has happened today, newest first.</param>
public sealed record ManagerDashboardResponse(
    DateTimeOffset GeneratedAtUtc,
    OrderActivityResponse Orders,
    FloorResponse Floor,
    KitchenLoadResponse Kitchen,
    TodayResponse Today,
    DashboardDayResponse Yesterday,
    IReadOnlyList<DashboardDayResponse> Days,
    IReadOnlyList<DashboardHourResponse> Hours,
    ReadinessResponse Readiness,
    IReadOnlyList<ActivityEntryResponse> Activity);
