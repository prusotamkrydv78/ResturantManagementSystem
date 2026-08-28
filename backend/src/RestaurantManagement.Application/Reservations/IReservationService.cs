using RestaurantManagement.Application.Reservations.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reservations;

/// <summary>
/// Tables held for people at times.
///
/// Every method takes the authenticated manager and derives the restaurant from them.
/// No method accepts a restaurant identifier, and both the customer and the table on a
/// booking must be that restaurant own.
///
/// This is not a second occupancy system, and the distinction matters. A booking says a
/// table is <em>intended</em> for somebody later; whether it is occupied <em>now</em> is
/// decided entirely by whether an order is running on it. Nothing here writes table
/// status, including seating, because two systems both claiming to know whether a table
/// is free is how a floor gets double-booked.
/// </summary>
public interface IReservationService
{
    /// <summary>
    /// The bookings a manager is looking at, with the counts that matter today.
    ///
    /// Without a date this is today and everything still to come, which is the question
    /// somebody actually has. A date asks for that day in the restaurant own calendar.
    /// </summary>
    Task<Result<ReservationBoardResponse>> GetBoardAsync(
        Guid managerUserId,
        DateOnly? onDate,
        bool includeClosed,
        CancellationToken cancellationToken);

    /// <summary>One booking.</summary>
    Task<Result<ReservationResponse>> GetReservationAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Takes a booking.
    ///
    /// A table is optional, because a booking can be taken before anybody decides where
    /// to put it. When one is named it must be free over the whole period, or the
    /// booking is refused with the clash named.
    /// </summary>
    Task<Result<ReservationResponse>> CreateAsync(
        Guid managerUserId,
        CreateReservationRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Changes a booking.
    ///
    /// Everything except the customer and the status, both of which have their own
    /// route: the status moves through its own actions so an edit cannot skip a step.
    /// Clash detection runs again, since moving a time is how most clashes appear.
    /// </summary>
    Task<Result<ReservationResponse>> UpdateAsync(
        Guid managerUserId,
        Guid reservationId,
        UpdateReservationRequest request,
        CancellationToken cancellationToken);

    /// <summary>Agrees a pending booking with the guest.</summary>
    Task<Result<ReservationResponse>> ConfirmAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Shows the guests to their table.
    ///
    /// Accepts a table so a party moved on arrival is recorded where they actually sat,
    /// and so a guest arriving before a table was chosen can still be seated. Does not
    /// touch table occupancy: the waiter opening an order does that.
    /// </summary>
    Task<Result<ReservationResponse>> SeatAsync(
        Guid managerUserId,
        Guid reservationId,
        SeatReservationRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Marks a sitting as over, which releases the hold on the table for later bookings.
    /// </summary>
    Task<Result<ReservationResponse>> CompleteAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken);

    /// <summary>Calls a booking off, which frees the table it was holding.</summary>
    Task<Result<ReservationResponse>> CancelAsync(
        Guid managerUserId,
        Guid reservationId,
        CancelReservationRequest request,
        CancellationToken cancellationToken);
}
