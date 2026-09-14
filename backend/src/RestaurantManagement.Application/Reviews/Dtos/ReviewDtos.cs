using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Reviews;

namespace RestaurantManagement.Application.Reviews.Dtos;

/// <summary>
/// What a customer is submitting.
///
/// Carries the key rather than an order identifier, for the same reason every other
/// customer request does: the key is the only thing that stands for "this was my meal",
/// and it travels in a body rather than a path so it stays out of server logs.
/// </summary>
public sealed class SubmitReviewRequest
{
    /// <summary>The key handed back when the order was placed.</summary>
    [Required(ErrorMessage = "We could not find that order.")]
    public string OrderKey { get; set; } = string.Empty;

    /// <summary>
    /// How the visit was overall. The only score that is required.
    /// </summary>
    [Range(
        Review.MinRating,
        Review.MaxRating,
        ErrorMessage = "Choose a rating from one to five.")]
    public int Rating { get; set; }

    /// <summary>The food, or null if they did not say.</summary>
    [Range(
        Review.MinRating,
        Review.MaxRating,
        ErrorMessage = "A food rating must be from one to five.")]
    public int? FoodRating { get; set; }

    /// <summary>The service, or null if they did not say.</summary>
    [Range(
        Review.MinRating,
        Review.MaxRating,
        ErrorMessage = "A service rating must be from one to five.")]
    public int? ServiceRating { get; set; }

    /// <summary>Anything they want to add. Optional.</summary>
    [StringLength(
        Review.MaxCommentLength,
        ErrorMessage = "A comment cannot be longer than 1000 characters.")]
    public string? Comment { get; set; }
}

/// <summary>
/// A review as its author sees it back.
///
/// Returned so the page can show what was submitted rather than what was typed - the
/// difference being that this came from the restaurant, so a reload still shows it.
/// </summary>
/// <param name="Rating">How the visit was overall.</param>
/// <param name="FoodRating">The food, or null.</param>
/// <param name="ServiceRating">The service, or null.</param>
/// <param name="Comment">What they wrote, or null.</param>
/// <param name="SubmittedAtUtc">When it was left.</param>
public sealed record ReviewResponse(
    int Rating,
    int? FoodRating,
    int? ServiceRating,
    string? Comment,
    DateTimeOffset SubmittedAtUtc);

/// <summary>
/// A review as the restaurant reads it.
///
/// Carries the order it came from, which is the point of tying the two together: a
/// manager looking at a poor score can see what that table was served and who served
/// them. It carries nothing about who the customer was, because nothing is recorded.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Rating">How the visit was overall.</param>
/// <param name="FoodRating">The food, or null.</param>
/// <param name="ServiceRating">The service, or null.</param>
/// <param name="Comment">What they wrote, or null.</param>
/// <param name="SubmittedAtUtc">When it was left.</param>
/// <param name="OrderId">The order behind it, so a manager can open it.</param>
/// <param name="OrderNumber">Readable order number.</param>
/// <param name="TableName">Where they sat.</param>
/// <param name="ServedByName">
/// The member of staff on the order, or null for one a customer placed themselves and
/// nobody has been recorded against.
/// </param>
public sealed record RestaurantReviewResponse(
    Guid Id,
    int Rating,
    int? FoodRating,
    int? ServiceRating,
    string? Comment,
    DateTimeOffset SubmittedAtUtc,
    Guid OrderId,
    int OrderNumber,
    string TableName,
    string? ServedByName);

/// <summary>
/// The reviews a restaurant has, and what they add up to.
///
/// The averages come back with the list rather than being worked out on the client,
/// because a page showing five of two hundred reviews cannot average the two hundred -
/// and two screens each doing their own arithmetic is two answers to one question.
/// </summary>
/// <param name="Reviews">The reviews themselves, newest first.</param>
/// <param name="Count">How many there are in total.</param>
/// <param name="AverageRating">
/// The mean overall score, or null when there are no reviews. Null rather than zero:
/// nobody has rated this restaurant nothing.
/// </param>
/// <param name="AverageFoodRating">The mean food score, over those who gave one.</param>
/// <param name="AverageServiceRating">The mean service score, over those who gave one.</param>
/// <param name="WithCommentCount">
/// How many left words as well as a score, over every review rather than over the page.
/// </param>
/// <param name="Distribution">Five buckets, one per score, always all five.</param>
/// <param name="Recent">The last thirty days.</param>
/// <param name="Previous">The thirty days before those, to read the last thirty against.</param>
/// <param name="ByServer">
/// The members of staff carrying the most reviewed orders, heaviest first.
/// </param>
public sealed record ReviewSummaryResponse(
    IReadOnlyList<RestaurantReviewResponse> Reviews,
    int Count,
    decimal? AverageRating,
    decimal? AverageFoodRating,
    decimal? AverageServiceRating,
    int WithCommentCount,
    IReadOnlyList<ReviewBucketResponse> Distribution,
    ReviewPeriodResponse Recent,
    ReviewPeriodResponse Previous,
    IReadOnlyList<ReviewServerResponse> ByServer);

/// <summary>
/// How many tables gave a particular score.
///
/// The shape a mean throws away. Four point zero is every table saying four, or half of
/// them delighted and half of them furious, and a manager needs to know which.
/// </summary>
/// <param name="Rating">One through five.</param>
/// <param name="Count">How many said it. Present at zero.</param>
public sealed record ReviewBucketResponse(int Rating, int Count);

/// <summary>
/// A stretch of time as a count and a mean.
///
/// Thin on purpose: the comparison period only ever appears on screen as a direction.
/// </summary>
/// <param name="Count">Reviews left in the period.</param>
/// <param name="AverageRating">
/// The mean over them, or null when nobody reviewed. Null rather than zero, so a quiet
/// month does not read as a month of one-star visits.
/// </param>
public sealed record ReviewPeriodResponse(int Count, decimal? AverageRating);

/// <summary>
/// How the tables one member of staff took scored.
///
/// This is the point of holding the staff member against the order rather than against
/// the review: a run of poor scores on one section is the thing a manager can act on,
/// and no single review ever shows it. Orders a customer placed themselves have nobody
/// to name and are left out rather than pooled under a stand-in.
/// </summary>
/// <param name="StaffId">Who.</param>
/// <param name="Name">Their name at the time of reading.</param>
/// <param name="Count">Reviewed orders they took.</param>
/// <param name="AverageRating">The mean overall score across them.</param>
public sealed record ReviewServerResponse(
    Guid StaffId,
    string Name,
    int Count,
    decimal AverageRating);
