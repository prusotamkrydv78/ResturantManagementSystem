using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reservations;

/// <summary>Failures the reservation module can report.</summary>
public static class ReservationErrors
{
    /// <summary>The caller manages no restaurant, so there is no book to keep.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("reservation.no_restaurant", "No restaurant is assigned to this account yet.");

    /// <summary>
    /// No booking with that identifier exists in the caller restaurant. One from
    /// another restaurant reports the same thing.
    /// </summary>
    public static readonly Error NotFound =
        new("reservation.not_found", "That reservation could not be found.");

    /// <summary>
    /// The customer named is not one of the caller own, which reports the same as one
    /// that does not exist.
    /// </summary>
    public static readonly Error CustomerNotFound =
        new("reservation.customer_not_found", "That customer could not be found.");

    /// <summary>
    /// The table named is not one of the caller own, or is not in service.
    ///
    /// Both report the same thing: a table out of service cannot be promised to anybody,
    /// and one belonging elsewhere must not be distinguishable from one that is missing.
    /// </summary>
    public static readonly Error TableUnavailable =
        new(
            "reservation.table_unavailable",
            "That table is not available to reserve.");

    /// <summary>
    /// Another live booking already holds that table over part of the same period.
    ///
    /// Names the clash so a manager can go and look at it rather than guessing which of
    /// their bookings is in the way.
    /// </summary>
    public static Error TableAlreadyHeld(string tableName, string customerName) =>
        new(
            "reservation.table_already_held",
            $"{tableName} is already held for {customerName} over part of that time.");

    /// <summary>
    /// The booking is not in a state the requested step can follow.
    ///
    /// Covers confirming something already confirmed, seating something finished, and
    /// completing something nobody sat down at. All are conflicts with where the booking
    /// has got to rather than malformed requests.
    /// </summary>
    public static readonly Error WrongStatus =
        new(
            "reservation.wrong_status",
            "This reservation has already moved past that point.");

    /// <summary>
    /// Seating was asked for with no table decided.
    ///
    /// Reported apart from the general status refusal, because the fix is different:
    /// choose a table, rather than accept that the booking has moved on.
    /// </summary>
    public static readonly Error SeatingNeedsTable =
        new(
            "reservation.seating_needs_table",
            "Choose the table they are being shown to before seating them.");

    /// <summary>
    /// A closed booking cannot be edited. It is a record of what happened.
    /// </summary>
    public static readonly Error NotEditable =
        new(
            "reservation.not_editable",
            "This reservation is finished and can no longer be changed.");

    /// <summary>
    /// Somebody else moved the booking between it being read and written. Refused rather
    /// than undoing their change.
    /// </summary>
    public static readonly Error Conflict =
        new(
            "reservation.conflict",
            "Someone else just updated this reservation. Reload it and try again.");
}
