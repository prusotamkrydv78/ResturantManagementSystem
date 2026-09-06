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
public sealed record ReviewSummaryResponse(
    IReadOnlyList<RestaurantReviewResponse> Reviews,
    int Count,
    decimal? AverageRating,
    decimal? AverageFoodRating,
    decimal? AverageServiceRating);
