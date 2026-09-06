using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Reviews;

/// <summary>
/// What a table thought, once they had paid.
///
/// Tied to an order, and that is the whole design. Anybody can leave a review on the
/// open internet; only somebody holding the key to a settled order at this restaurant
/// can leave one here, because they were the ones sitting at the table. It is not
/// moderation - it is the review being evidence of a meal rather than an opinion from
/// nowhere.
///
/// One per order, enforced by the schema. A party leaves one view of one visit, and a
/// second submission is a customer changing their mind rather than a second opinion; the
/// service refuses it and says so.
///
/// Anonymous, like everything else on the customer side of this product. There is no
/// account to attach and no name asked for: a guest at the end of a meal is being asked
/// for two taps, and the price of those taps must not be handing over their identity.
/// What it does carry is which order it came from, so a manager reading a poor score can
/// see what that table actually ate and who served them.
/// </summary>
public class Review
{
    /// <summary>Longest comment accepted.</summary>
    public const int MaxCommentLength = 1000;

    /// <summary>Lowest score on any of the scales.</summary>
    public const int MinRating = 1;

    /// <summary>Highest score on any of the scales.</summary>
    public const int MaxRating = 5;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant being reviewed.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>
    /// The order this review is about.
    ///
    /// Required, and unique. It is what makes the review evidence of a visit, and it is
    /// what lets a manager reading "two stars" find out what that table was served.
    /// </summary>
    public Guid OrderId { get; set; }

    /// <summary>Navigation to the order.</summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// How the visit was, overall, from one to five.
    ///
    /// The only required score. A guest who has just paid and wants to leave is being
    /// asked for one tap; the two below are there for somebody who wants to be more
    /// specific, and demanding all three is how a review form gets abandoned.
    /// </summary>
    public int Rating { get; set; }

    /// <summary>The food, from one to five, or null if they did not say.</summary>
    public int? FoodRating { get; set; }

    /// <summary>
    /// The service, from one to five, or null if they did not say.
    ///
    /// Kept apart from the food because they are different people's work and a
    /// restaurant fixes them in different ways. An average of the two would tell a
    /// manager that something was wrong and not what.
    /// </summary>
    public int? ServiceRating { get; set; }

    /// <summary>
    /// What they wrote, or null.
    ///
    /// Free text and optional. The scores are what can be counted; this is the part that
    /// says why, and it is the only place in this product where a customer's own words
    /// are stored - so it is bounded, and it is never rendered as anything but text.
    /// </summary>
    public string? Comment { get; set; }

    /// <summary>When it was left.</summary>
    public DateTimeOffset SubmittedAtUtc { get; set; }
}
