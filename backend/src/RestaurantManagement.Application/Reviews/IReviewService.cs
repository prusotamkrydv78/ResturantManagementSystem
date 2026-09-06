using RestaurantManagement.Application.Reviews.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reviews;

/// <summary>
/// What tables thought of their visit.
///
/// Two audiences and two different questions, which is why this is one service and not
/// two: a customer leaving one, and a manager reading them.
///
/// The customer half is anonymous, like everything else on that side of the product.
/// What stands in for authorisation is the key handed back when their order was placed -
/// so a review can only come from somebody who actually ate here, without anybody having
/// to sign in or be moderated.
/// </summary>
public interface IReviewService
{
    /// <summary>
    /// Records what a customer thought of their visit.
    /// </summary>
    /// <remarks>
    /// Only for an order that has been paid. Asking before the bill is settled would be
    /// asking somebody to rate a meal they are still eating, and the whole point of
    /// tying a review to an order is that it describes a finished visit.
    ///
    /// One per order. A second submission is somebody changing their mind rather than a
    /// second opinion, and it is refused and said so - the schema holds the same rule,
    /// because two taps in quick succession can both pass an application check.
    ///
    /// Refused for an order that was called off. There is nothing to review, and asking
    /// a table that never got its food to rate the food would be worse than silence.
    /// </remarks>
    Task<Result<ReviewResponse>> SubmitAsync(
        string slug,
        SubmitReviewRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// The reviews a restaurant has received, newest first, with their averages.
    /// </summary>
    /// <remarks>
    /// Derived from the authenticated manager rather than from anything the client sent,
    /// the same way every other manager read is. Bounded by a caller limit rather than
    /// paged, matching every other list in this product.
    ///
    /// The averages are calculated over every review rather than over the page returned,
    /// because a mean of the five most recent is not the restaurant's rating.
    /// </remarks>
    Task<Result<ReviewSummaryResponse>> GetForRestaurantAsync(
        Guid managerUserId,
        int limit,
        CancellationToken cancellationToken);
}
