using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Application.Floor.Dtos;

/// <summary>
/// One open order sitting on a table.
///
/// Enough to recognise it and act on it, and nothing more: the floor overview is a
/// way into an order, not a second place to read one. The lines, the prices and the
/// kitchen tickets stay on the screens that own them.
/// </summary>
/// <param name="Id">Identifier, so a card can link straight to the order.</param>
/// <param name="OrderNumber">The number staff say out loud.</param>
/// <param name="Subtotal">Server-calculated running total.</param>
/// <param name="ItemCount">Units on it.</param>
/// <param name="PlacedByName">The waiter who took it.</param>
/// <param name="CreatedAtUtc">
/// When it was opened. The elapsed time is derived by the client, so nothing counts
/// in the database and no timer has to be kept in step.
/// </param>
/// <param name="UnfinishedKitchenTicketCount">
/// Tickets on it that have not reached the pass. Zero is what closing requires.
/// </param>
/// <param name="UnsubmittedItemCount">Units the waiter has not sent yet.</param>
/// <param name="CanComplete">
/// Whether it may be paid for and closed now. The same eligibility the billing
/// screen uses, decided in the same place, so the floor cannot disagree with it.
/// </param>
public sealed record FloorOrderResponse(
    Guid Id,
    int OrderNumber,
    decimal Subtotal,
    int ItemCount,
    string PlacedByName,
    DateTimeOffset CreatedAtUtc,
    int UnfinishedKitchenTicketCount,
    int UnsubmittedItemCount,
    bool CanComplete);

/// <summary>
/// One table, and what is happening at it right now.
///
/// Carries the stored occupancy and the open orders side by side rather than deriving
/// one from the other. The lifecycle that sets <paramref name="Status"/> stays
/// authoritative and nothing here writes to it; showing both means the two can be
/// read together instead of this becoming a second opinion about occupancy.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What staff and guests call it.</param>
/// <param name="Capacity">How many it seats.</param>
/// <param name="Status">Stored occupancy, owned by the ordering lifecycle.</param>
/// <param name="IsActive">
/// Whether it is in service. Separate from occupancy: a table out of service is
/// neither occupied nor available for seating.
/// </param>
/// <param name="OpenOrders">The open orders on it, oldest first. Usually one.</param>
/// <param name="OpenValue">What those orders come to together.</param>
/// <param name="OpenItemCount">Units across them.</param>
/// <param name="SeatedSinceUtc">
/// When the earliest open order was placed, which is how long the table has been
/// working. Null when nothing is open on it.
/// </param>
/// <param name="PendingTicketCount">Its tickets waiting for the kitchen.</param>
/// <param name="PreparingTicketCount">Its tickets being cooked.</param>
/// <param name="ReadyTicketCount">Its tickets waiting at the pass.</param>
/// <param name="UnsubmittedItemCount">Units on it not yet sent to the kitchen.</param>
/// <param name="CanSettle">
/// Whether any open order on it can be closed now, so a manager can see at a glance
/// where money is waiting to be taken.
/// </param>
public sealed record FloorTableResponse(
    Guid Id,
    string Name,
    int Capacity,
    TableStatus Status,
    bool IsActive,
    IReadOnlyList<FloorOrderResponse> OpenOrders,
    decimal OpenValue,
    int OpenItemCount,
    DateTimeOffset? SeatedSinceUtc,
    int PendingTicketCount,
    int PreparingTicketCount,
    int ReadyTicketCount,
    int UnsubmittedItemCount,
    bool CanSettle);

/// <summary>
/// The floor right now: every table, and what is on it.
///
/// One response for the whole screen, for the same reason the manager dashboard is
/// one response: a floor assembled from several requests shows several moments and
/// then contradicts itself about which table is free.
///
/// Read only. This module writes nothing at all, and deliberately offers no way to
/// set occupancy: that belongs to the order lifecycle, and a second route to it would
/// be a way for the floor to start lying.
/// </summary>
/// <param name="GeneratedAtUtc">
/// When the server answered, so the screen can say how fresh it is instead of
/// implying it is live to the second.
/// </param>
/// <param name="TotalCount">Every table in the restaurant.</param>
/// <param name="InServiceCount">Tables that can be seated.</param>
/// <param name="OccupiedCount">Tables in service with an order running.</param>
/// <param name="AvailableCount">Tables in service with nothing on them.</param>
/// <param name="OutOfServiceCount">Tables taken out of service.</param>
/// <param name="SeatsInService">Covers the restaurant can seat right now.</param>
/// <param name="SeatsOccupied">Covers at tables currently working.</param>
/// <param name="OpenValue">What everything open on the floor comes to.</param>
/// <param name="ReadyToSettleCount">Tables with an order that can be closed now.</param>
/// <param name="Tables">
/// Every table, ordered by name, which is the order the room is in. Sorting by state
/// instead would move a card the moment someone sat down, and staff look for a table
/// by its name.
/// </param>
public sealed record FloorOverviewResponse(
    DateTimeOffset GeneratedAtUtc,
    int TotalCount,
    int InServiceCount,
    int OccupiedCount,
    int AvailableCount,
    int OutOfServiceCount,
    int SeatsInService,
    int SeatsOccupied,
    decimal OpenValue,
    int ReadyToSettleCount,
    IReadOnlyList<FloorTableResponse> Tables);
