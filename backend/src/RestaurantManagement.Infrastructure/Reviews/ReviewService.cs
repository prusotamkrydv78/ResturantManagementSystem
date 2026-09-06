using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Reviews;
using RestaurantManagement.Application.Reviews.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Reviews;
using RestaurantManagement.Infrastructure.Orders;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Reviews;

/// <summary>
/// What tables thought of their visit.
///
/// The customer half is authorised by the key from their own order, which is the same
/// claim the rest of the customer side runs on: unguessable, handed out once, and
/// naming exactly one visit. That is what makes a review here evidence of a meal rather
/// than an opinion from nowhere, without asking a guest to sign in or hand over a name.
/// </summary>
public sealed class ReviewService : IReviewService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<ReviewService> _logger;

    /// <summary>Creates the service.</summary>
    public ReviewService(ApplicationDbContext dbContext, ILogger<ReviewService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<ReviewResponse>> SubmitAsync(
        string slug,
        SubmitReviewRequest request,
        CancellationToken cancellationToken)
    {
        var normalised = (slug ?? string.Empty).Trim().ToLowerInvariant();
        var key = string.IsNullOrWhiteSpace(request.OrderKey)
            ? null
            : request.OrderKey.Trim();

        if (normalised.Length == 0 || key is null)
        {
            return Result.Failure<ReviewResponse>(ReviewErrors.OrderNotFound);
        }

        // The whole permission is in this clause. Scoped to the restaurant in the URL as
        // well as to the key, so a key can never leave a review against somebody else.
        var order = await _dbContext.Orders
            .AsNoTracking()
            .Where(candidate =>
                candidate.PublicOrderKey == key &&
                candidate.Restaurant.Slug == normalised &&
                candidate.Restaurant.IsActive)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.RestaurantId,
                candidate.Status,
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
        {
            return Result.Failure<ReviewResponse>(ReviewErrors.OrderNotFound);
        }

        // Told apart on purpose: one is "not yet", the other is "never".
        if (order.Status == OrderStatus.Cancelled)
        {
            return Result.Failure<ReviewResponse>(ReviewErrors.Cancelled);
        }

        if (order.Status != OrderStatus.Completed)
        {
            return Result.Failure<ReviewResponse>(ReviewErrors.NotSettled);
        }

        var existing = await _dbContext.Reviews
            .AsNoTracking()
            .Where(review => review.OrderId == order.Id)
            .Select(review => new ReviewResponse(
                review.Rating,
                review.FoodRating,
                review.ServiceRating,
                review.Comment,
                review.SubmittedAtUtc))
            .SingleOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            return Result.Failure<ReviewResponse>(ReviewErrors.AlreadyReviewed);
        }

        var now = DateTimeOffset.UtcNow;

        var review = new Review
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = order.RestaurantId,
            OrderId = order.Id,
            Rating = request.Rating,
            FoodRating = request.FoodRating,
            ServiceRating = request.ServiceRating,
            // Trimmed here rather than trusted, and an empty box stored as nothing
            // rather than as an empty string - a comment that exists and says nothing
            // would show up on a manager's screen as a blank quotation.
            Comment = string.IsNullOrWhiteSpace(request.Comment)
                ? null
                : request.Comment.Trim(),
            SubmittedAtUtc = now,
        };

        _dbContext.Reviews.Add(review);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateReview(exception))
        {
            // The unique index caught a second review. This is the case the check above
            // cannot hold on its own, because two taps can both read "none yet" before
            // either writes - which is exactly what a double tap on a phone produces.
            _logger.LogInformation(
                "A second review for order {OrderId} was refused by the database.",
                order.Id);

            return Result.Failure<ReviewResponse>(ReviewErrors.AlreadyReviewed);
        }

        _logger.LogInformation(
            "Order {OrderId} was reviewed: {Rating} overall, food {Food}, service {Service}.",
            order.Id,
            review.Rating,
            review.FoodRating,
            review.ServiceRating);

        return Result.Success(new ReviewResponse(
            review.Rating,
            review.FoodRating,
            review.ServiceRating,
            review.Comment,
            review.SubmittedAtUtc));
    }

    /// <inheritdoc />
    public async Task<Result<ReviewSummaryResponse>> GetForRestaurantAsync(
        Guid managerUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        var restaurantId = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => (Guid?)restaurant.Id)
            .SingleOrDefaultAsync(cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<ReviewSummaryResponse>(ReviewErrors.NoRestaurantAssigned);
        }

        var mine = _dbContext.Reviews
            .AsNoTracking()
            .Where(review => review.RestaurantId == restaurantId.Value);

        // Over every review, not over the page below. A mean of the five most recent is
        // not the restaurant's rating, and it would move every time somebody reloaded.
        //
        // Averaged in the database rather than in memory, so a restaurant with two
        // thousand reviews does not load two thousand rows to divide by two thousand.
        var totals = await mine
            .GroupBy(review => 1)
            .Select(group => new
            {
                Count = group.Count(),
                Rating = (decimal?)group.Average(review => (decimal)review.Rating),
                Food = group
                    .Where(review => review.FoodRating != null)
                    .Average(review => (decimal?)review.FoodRating),
                Service = group
                    .Where(review => review.ServiceRating != null)
                    .Average(review => (decimal?)review.ServiceRating),
            })
            .SingleOrDefaultAsync(cancellationToken);

        var reviews = await mine
            .OrderByDescending(review => review.SubmittedAtUtc)
            .Take(Math.Clamp(limit, 1, 200))
            .Select(review => new RestaurantReviewResponse(
                review.Id,
                review.Rating,
                review.FoodRating,
                review.ServiceRating,
                review.Comment,
                review.SubmittedAtUtc,
                review.OrderId,
                review.Order.OrderNumber,
                review.Order.Table.Name,
                // Written out rather than through the shared helper, because this runs
                // in SQL. Null for an order a customer placed themselves, where there is
                // genuinely nobody to name.
                review.Order.CreatedByStaffId == null
                    ? null
                    : _dbContext.Users
                        .Where(user => user.Id == review.Order.CreatedByStaffId)
                        .Select(user => user.FullName)
                        .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        return Result.Success(new ReviewSummaryResponse(
            reviews,
            totals?.Count ?? 0,
            Round(totals?.Rating),
            Round(totals?.Food),
            Round(totals?.Service)));
    }

    /// <summary>
    /// To one decimal place, which is how a rating is read.
    ///
    /// Four point three, not four point two eight five seven. The extra digits are
    /// arithmetic rather than information, and they make two restaurants look different
    /// when nobody could tell them apart.
    /// </summary>
    private static decimal? Round(decimal? value) =>
        value is null ? null : Math.Round(value.Value, 1, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Whether a failed save was the unique index on the order refusing a second review.
    ///
    /// Matched on the SQL Server error numbers for a duplicate key rather than on the
    /// message, which is localised and would stop matching on a differently configured
    /// server.
    /// </summary>
    private static bool IsDuplicateReview(DbUpdateException exception) =>
        exception.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
        sql.Number is 2601 or 2627;
}
