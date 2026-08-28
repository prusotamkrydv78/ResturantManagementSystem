using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Reservations;

/// <summary>Where a booking sits in its life.</summary>
public enum ReservationStatus
{
    /// <summary>Taken but not yet confirmed. May not have a table.</summary>
    Pending = 0,

    /// <summary>Agreed with the guest. A table has been set aside.</summary>
    Confirmed = 1,

    /// <summary>The guests have arrived and been shown to the table.</summary>
    Seated = 2,

    /// <summary>They have been and gone.</summary>
    Completed = 3,

    /// <summary>Called off, whoever called it off.</summary>
    Cancelled = 4,
}

/// <summary>
/// A table held for somebody at a time.
///
/// Deliberately not a second occupancy system. A reservation says a table is
/// <em>intended</em> for someone later; whether a table is occupied <em>now</em> is
/// decided entirely by whether an order is running on it, exactly as before. Seating a
/// booking does not touch table status, and never will: two systems both claiming to
/// know whether a table is free is how a floor ends up double-booked.
///
/// Carries no deposit, no waitlist position and no reminder. None of those exist here.
/// </summary>
public class Reservation
{
    /// <summary>Longest note accepted.</summary>
    public const int MaxNotesLength = 500;

    /// <summary>Fewest guests a booking can be for.</summary>
    public const int MinGuests = 1;

    /// <summary>Most guests a single booking can be for.</summary>
    public const int MaxGuests = 200;

    /// <summary>
    /// How long a table is held by default, in minutes.
    ///
    /// A booking needs a length for "overlapping" to mean anything, and the spec for
    /// this feature gives a time but not a duration, so one had to be chosen. Ninety
    /// minutes is a normal sitting and it is stored per booking rather than assumed
    /// globally, so a long lunch can be recorded as one.
    /// </summary>
    public const int DefaultDurationMinutes = 90;

    /// <summary>Shortest booking length accepted.</summary>
    public const int MinDurationMinutes = 15;

    /// <summary>Longest booking length accepted.</summary>
    public const int MaxDurationMinutes = 480;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant holding the table.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>Who it is for.</summary>
    public Guid CustomerId { get; set; }

    /// <summary>Navigation to the customer.</summary>
    public Customer Customer { get; set; } = null!;

    /// <summary>
    /// When they are expected, as a UTC instant.
    ///
    /// Stored as an instant rather than a local time so it cannot drift when the
    /// restaurant timezone changes. The screens read it in the restaurant own zone.
    /// </summary>
    public DateTimeOffset ReservedForUtc { get; set; }

    /// <summary>How long the table is held for.</summary>
    public int DurationMinutes { get; set; } = DefaultDurationMinutes;

    /// <summary>How many people.</summary>
    public int GuestCount { get; set; }

    /// <summary>
    /// The table set aside, once one has been.
    ///
    /// Optional until confirmed, because a booking can be taken before anybody decides
    /// where to put it. Required to seat, since showing guests to no table in particular
    /// is not something the system can record.
    /// </summary>
    public Guid? TableId { get; set; }

    /// <summary>Navigation to the table.</summary>
    public RestaurantTable? Table { get; set; }

    /// <summary>Where the booking sits.</summary>
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    /// <summary>Anything the guest asked for.</summary>
    public string? Notes { get; set; }

    /// <summary>Why it was called off, when it was.</summary>
    public string? CancellationReason { get; set; }

    /// <summary>When the booking was taken.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When it last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// Row version, used for optimistic concurrency.
    ///
    /// Two people confirming or seating the same booking at once is realistic on a busy
    /// service, and this makes the second one fail loudly rather than silently undoing
    /// the first.
    /// </summary>
    public byte[] RowVersion { get; set; } = [];

    /// <summary>When the held period ends.</summary>
    public DateTimeOffset EndsAtUtc => ReservedForUtc.AddMinutes(DurationMinutes);

    /// <summary>
    /// Whether the booking still holds a table.
    ///
    /// Completed and cancelled bookings do not, which is what stops a finished sitting
    /// blocking the same table for the next one.
    /// </summary>
    public bool HoldsTable =>
        Status is ReservationStatus.Pending
            or ReservationStatus.Confirmed
            or ReservationStatus.Seated;

    /// <summary>Whether the booking has reached an end it cannot leave.</summary>
    public bool IsClosed =>
        Status is ReservationStatus.Completed or ReservationStatus.Cancelled;

    /// <summary>Whether it may be confirmed.</summary>
    public bool CanConfirm => Status == ReservationStatus.Pending;

    /// <summary>
    /// Whether guests may be shown to their table.
    ///
    /// From either Pending or Confirmed, because a guest who walks in early should not
    /// have to be confirmed first for the sake of the state machine.
    /// </summary>
    public bool CanSeat =>
        Status is ReservationStatus.Pending or ReservationStatus.Confirmed;

    /// <summary>Whether it may be marked as finished.</summary>
    public bool CanComplete => Status == ReservationStatus.Seated;

    /// <summary>Whether it may be called off.</summary>
    public bool CanCancel => !IsClosed;

    /// <summary>
    /// Whether the details may still be edited.
    ///
    /// A closed booking is a record of what happened, so it is left alone.
    /// </summary>
    public bool IsEditable => !IsClosed;

    /// <summary>Agrees the booking with the guest.</summary>
    public bool TryConfirm(DateTimeOffset now)
    {
        if (!CanConfirm)
        {
            return false;
        }

        Status = ReservationStatus.Confirmed;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Shows the guests to their table.
    ///
    /// Requires a table, because seating nobody anywhere is not a state worth recording.
    /// Deliberately does not touch that table occupancy: an order does that, and letting
    /// this do it too would give the floor two answers to the same question.
    /// </summary>
    public bool TrySeat(DateTimeOffset now)
    {
        if (!CanSeat || TableId is null)
        {
            return false;
        }

        Status = ReservationStatus.Seated;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>Marks the sitting as over, which releases the hold on the table.</summary>
    public bool TryComplete(DateTimeOffset now)
    {
        if (!CanComplete)
        {
            return false;
        }

        Status = ReservationStatus.Completed;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Calls the booking off.
    ///
    /// Records the reason with the status, so a cancelled booking always says why rather
    /// than leaving a gap somebody has to guess at later.
    /// </summary>
    public bool TryCancel(string? reason, DateTimeOffset now)
    {
        if (!CanCancel)
        {
            return false;
        }

        Status = ReservationStatus.Cancelled;
        CancellationReason = reason;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Whether this booking and another want the same table at an overlapping time.
    ///
    /// Half-open on both sides, so a booking ending exactly when the next begins is not
    /// a clash: a table freed at eight is available at eight. Only bookings that still
    /// hold a table can clash, which is why a cancelled one never blocks anything.
    /// </summary>
    public bool ClashesWith(Reservation other) =>
        Id != other.Id &&
        TableId is not null &&
        TableId == other.TableId &&
        HoldsTable &&
        other.HoldsTable &&
        ReservedForUtc < other.EndsAtUtc &&
        other.ReservedForUtc < EndsAtUtc;
}
