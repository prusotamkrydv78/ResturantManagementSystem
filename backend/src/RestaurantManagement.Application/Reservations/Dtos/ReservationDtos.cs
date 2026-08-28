using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Reservations;

namespace RestaurantManagement.Application.Reservations.Dtos;

/// <summary>
/// A table held for somebody.
///
/// Carries the eligibility answers rather than the rules behind them, so the screen and
/// the write path cannot disagree about what can be done next.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="CustomerId">Who it is for.</param>
/// <param name="CustomerName">What to call them.</param>
/// <param name="CustomerPhone">How to reach them, if known.</param>
/// <param name="ReservedForUtc">When they are expected.</param>
/// <param name="DurationMinutes">How long the table is held.</param>
/// <param name="EndsAtUtc">When the hold ends.</param>
/// <param name="GuestCount">How many people.</param>
/// <param name="TableId">The table set aside, if one has been.</param>
/// <param name="TableName">What that table is called.</param>
/// <param name="TableCapacity">
/// How many it seats, so a screen can point out a booking larger than the table.
/// </param>
/// <param name="Status">Where the booking sits.</param>
/// <param name="Notes">Anything the guest asked for.</param>
/// <param name="CancellationReason">Why it was called off, when it was.</param>
/// <param name="CanConfirm">Whether it may be agreed.</param>
/// <param name="CanSeat">
/// Whether guests may be shown in. False without a table, since seating nobody anywhere
/// is not a state this product can record.
/// </param>
/// <param name="CanComplete">Whether the sitting may be marked over.</param>
/// <param name="CanCancel">Whether it may be called off.</param>
/// <param name="IsEditable">Whether the details may still change.</param>
/// <param name="CreatedAtUtc">When the booking was taken.</param>
public sealed record ReservationResponse(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    string? CustomerPhone,
    DateTimeOffset ReservedForUtc,
    int DurationMinutes,
    DateTimeOffset EndsAtUtc,
    int GuestCount,
    Guid? TableId,
    string? TableName,
    int? TableCapacity,
    ReservationStatus Status,
    string? Notes,
    string? CancellationReason,
    bool CanConfirm,
    bool CanSeat,
    bool CanComplete,
    bool CanCancel,
    bool IsEditable,
    DateTimeOffset CreatedAtUtc);

/// <summary>
/// The bookings a manager is looking at, with the counts that matter today.
/// </summary>
/// <param name="Reservations">The bookings asked for, soonest first.</param>
/// <param name="TodayCount">Bookings for the restaurant own today.</param>
/// <param name="UpcomingCount">Live bookings still to come.</param>
/// <param name="SeatedCount">Parties currently in.</param>
/// <param name="TodayGuestCount">
/// Covers expected today across bookings that still hold a table. Cancelled ones are
/// left out, because nobody is coming.
/// </param>
public sealed record ReservationBoardResponse(
    IReadOnlyList<ReservationResponse> Reservations,
    int TodayCount,
    int UpcomingCount,
    int SeatedCount,
    int TodayGuestCount);

/// <summary>
/// Payload for taking a booking.
///
/// No restaurant field: it is taken for the restaurant of the authenticated manager,
/// and both the customer and the table must be that restaurant own.
/// </summary>
public sealed class CreateReservationRequest
{
    /// <summary>Who it is for. Must be one of the caller own customers.</summary>
    [Required(ErrorMessage = "Choose the customer.")]
    public Guid CustomerId { get; set; }

    /// <summary>When they are expected, as an instant.</summary>
    [Required(ErrorMessage = "Enter when they are coming.")]
    public DateTimeOffset ReservedForUtc { get; set; }

    /// <summary>How many people.</summary>
    [Range(
        Reservation.MinGuests,
        Reservation.MaxGuests,
        ErrorMessage = "A booking must be for between 1 and 200 guests.")]
    public int GuestCount { get; set; }

    /// <summary>
    /// How long to hold the table. Left out means the usual sitting.
    /// </summary>
    [Range(
        Reservation.MinDurationMinutes,
        Reservation.MaxDurationMinutes,
        ErrorMessage = "A booking must run for between 15 and 480 minutes.")]
    public int? DurationMinutes { get; set; }

    /// <summary>
    /// The table to set aside. Optional: a booking can be taken before anybody decides
    /// where to put it.
    /// </summary>
    public Guid? TableId { get; set; }

    /// <summary>Anything the guest asked for.</summary>
    [StringLength(
        Reservation.MaxNotesLength,
        ErrorMessage = "Notes cannot be longer than 500 characters.")]
    public string? Notes { get; set; }
}

/// <summary>
/// Payload for changing a booking.
///
/// The same fields as taking one, because all of them can legitimately change up until
/// the booking closes. The status is not among them: it moves through its own actions,
/// so an edit cannot skip a step in the lifecycle.
/// </summary>
public sealed class UpdateReservationRequest
{
    /// <summary>When they are expected.</summary>
    [Required(ErrorMessage = "Enter when they are coming.")]
    public DateTimeOffset ReservedForUtc { get; set; }

    /// <summary>How many people.</summary>
    [Range(Reservation.MinGuests, Reservation.MaxGuests)]
    public int GuestCount { get; set; }

    /// <summary>How long to hold the table.</summary>
    [Range(Reservation.MinDurationMinutes, Reservation.MaxDurationMinutes)]
    public int? DurationMinutes { get; set; }

    /// <summary>The table to set aside, or none.</summary>
    public Guid? TableId { get; set; }

    /// <summary>Anything the guest asked for.</summary>
    [StringLength(Reservation.MaxNotesLength)]
    public string? Notes { get; set; }
}

/// <summary>
/// Payload for seating a booking.
///
/// Carries a table so a guest who arrives before one was chosen can still be shown in,
/// and so a party moved to a different table on arrival is recorded where they actually
/// sat. Left out means the table already on the booking.
/// </summary>
public sealed class SeatReservationRequest
{
    /// <summary>The table they were actually shown to.</summary>
    public Guid? TableId { get; set; }
}

/// <summary>Payload for calling a booking off.</summary>
public sealed class CancelReservationRequest
{
    /// <summary>
    /// Why. Optional, unlike an order cancellation: a booking that never happened costs
    /// nothing and often has no reason worth recording beyond the guest changing plans.
    /// </summary>
    [StringLength(
        Reservation.MaxNotesLength,
        ErrorMessage = "A reason cannot be longer than 500 characters.")]
    public string? Reason { get; set; }
}
