using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.PublicSite;
using RestaurantManagement.Application.PublicSite.Dtos;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Reservations;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.PublicSite;

/// <summary>
/// The website's booking form and its reviews, for strangers.
///
/// A booking request is written the way a manager's own booking is - a pending
/// reservation with no table, and a customer matched on phone number - so it appears
/// in the reservations book beside every other and is confirmed the same way. Nothing
/// here can choose a table, a duration or a status; those stay with the restaurant.
/// </summary>
public sealed class PublicSiteService : IPublicSiteService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PublicSiteService> _logger;

    /// <summary>Creates the service.</summary>
    /// <param name="dbContext">The database.</param>
    /// <param name="logger">Where requests are recorded.</param>
    public PublicSiteService(ApplicationDbContext dbContext, ILogger<PublicSiteService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<PublicBookingResponse>> RequestBookingAsync(
        string slug,
        PublicBookingRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await FindAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicBookingResponse>(PublicSiteErrors.NotFound);
        }

        var now = DateTimeOffset.UtcNow;

        if (request.ReservedForUtc < now + PublicBookingLimits.MinimumNotice ||
            request.ReservedForUtc > now + PublicBookingLimits.Horizon)
        {
            return Result.Failure<PublicBookingResponse>(PublicSiteErrors.TimeOutOfRange);
        }

        var name = request.Name.Trim();
        var phone = request.Phone.Trim();

        // Matched on phone number, which is unique within a restaurant, so a regular
        // booking online is the regular already on the books rather than a second them.
        var customerId = await _dbContext.Customers
            .Where(customer => customer.RestaurantId == restaurant.Value.Id && customer.Phone == phone)
            .Select(customer => (Guid?)customer.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (customerId is null)
        {
            var customer = new Customer
            {
                Id = Guid.CreateVersion7(),
                RestaurantId = restaurant.Value.Id,
                Name = name,
                Phone = phone,
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };

            _dbContext.Customers.Add(customer);
            customerId = customer.Id;
        }

        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        var reservation = new Reservation
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurant.Value.Id,
            CustomerId = customerId.Value,
            ReservedForUtc = request.ReservedForUtc,
            DurationMinutes = Reservation.DefaultDurationMinutes,
            GuestCount = request.GuestCount,
            Status = ReservationStatus.Pending,
            // Marked as coming from the website, so whoever confirms it knows to call.
            Notes = notes is null ? "Booked on the website." : $"Booked on the website. {notes}",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.Reservations.Add(reservation);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Website booking {ReservationId} requested at restaurant {RestaurantId} for {Guests} at {When}.",
            reservation.Id,
            restaurant.Value.Id,
            reservation.GuestCount,
            reservation.ReservedForUtc);

        return Result.Success(new PublicBookingResponse(
            reservation.Id,
            restaurant.Value.Name,
            reservation.ReservedForUtc,
            reservation.GuestCount));
    }

    /// <inheritdoc />
    public async Task<Result<PublicReviewsResponse>> GetReviewsAsync(
        string slug,
        int limit,
        CancellationToken cancellationToken)
    {
        var restaurant = await FindAsync(slug, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PublicReviewsResponse>(PublicSiteErrors.NotFound);
        }

        var reviews = _dbContext.Reviews
            .AsNoTracking()
            .Where(review => review.RestaurantId == restaurant.Value.Id);

        var count = await reviews.CountAsync(cancellationToken);
        double? average = count == 0
            ? null
            : Math.Round(await reviews.AverageAsync(review => (double)review.Rating, cancellationToken), 1);

        var commented = await reviews
            .Where(review => review.Comment != null && review.Comment != "")
            .OrderByDescending(review => review.SubmittedAtUtc)
            .Take(Math.Clamp(limit, 1, 20))
            .Select(review => new PublicReviewItem(review.Rating, review.Comment!, review.SubmittedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success(new PublicReviewsResponse(average, count, commented));
    }

    /// <summary>A trading restaurant at this address, by slug or subdomain.</summary>
    private async Task<(Guid Id, string Name)?> FindAsync(string slug, CancellationToken cancellationToken)
    {
        var normalised = (slug ?? string.Empty).Trim().ToLowerInvariant();

        if (normalised.Length == 0)
        {
            return null;
        }

        var row = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant =>
                restaurant.IsActive &&
                (restaurant.Slug == normalised || restaurant.Subdomain == normalised))
            .Select(restaurant => new { restaurant.Id, restaurant.Name })
            .SingleOrDefaultAsync(cancellationToken);

        return row is null ? null : (row.Id, row.Name);
    }
}
