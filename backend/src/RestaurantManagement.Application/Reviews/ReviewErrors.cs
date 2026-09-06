using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reviews;

/// <summary>Failures the review module can report.</summary>
public static class ReviewErrors
{
    /// <summary>
    /// The key names no order here.
    ///
    /// One error for a wrong key, a wrong restaurant and an order that never existed,
    /// kept indistinguishable because these routes need no authentication and a
    /// different answer per case would let somebody probe.
    /// </summary>
    public static readonly Error OrderNotFound =
        new("review.order_not_found", "We could not find that order.");

    /// <summary>
    /// The bill has not been settled yet.
    ///
    /// Asking somebody to rate a meal they are still eating is the wrong question, and
    /// a review is meant to describe a finished visit.
    /// </summary>
    public static readonly Error NotSettled =
        new(
            "review.not_settled",
            "You can leave a review once your bill has been settled.");

    /// <summary>
    /// The order was called off, so there is nothing to review.
    ///
    /// Told apart from an unsettled bill deliberately. One is "not yet" and the other is
    /// "never", and asking a table that never got its food to rate the food would be
    /// worse than saying nothing at all.
    /// </summary>
    public static readonly Error Cancelled =
        new(
            "review.cancelled",
            "That order was cancelled, so there is nothing to review. Please speak to a "
            + "member of staff.");

    /// <summary>
    /// A review already exists for this visit.
    ///
    /// Reported rather than overwritten. A second submission is somebody changing their
    /// mind, and quietly replacing the first would mean a restaurant's rating could be
    /// edited after the fact by whoever still held the key.
    /// </summary>
    public static readonly Error AlreadyReviewed =
        new(
            "review.already_reviewed",
            "Thank you - you have already left a review for this visit.");

    /// <summary>The caller manages no restaurant, so there is nothing to read.</summary>
    public static readonly Error NoRestaurantAssigned =
        new(
            "review.no_restaurant",
            "This account does not manage a restaurant yet.");
}
