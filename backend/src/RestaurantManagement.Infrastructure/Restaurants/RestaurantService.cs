using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Restaurants;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Restaurants;

/// <summary>
/// Restaurant use cases. Manager assignment is not handled here: it lives in the
/// manager module so the rules exist in exactly one place.
/// </summary>
public sealed partial class RestaurantService : IRestaurantService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RestaurantService> _logger;

    /// <summary>Creates the service.</summary>
    public RestaurantService(
        ApplicationDbContext dbContext,
        ILogger<RestaurantService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> CreateAsync(
        CreateRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? CreateSlug(request.Name)
            : request.Slug.Trim().ToLowerInvariant();

        if (string.IsNullOrEmpty(slug))
        {
            return Result.Failure<RestaurantResponse>(RestaurantErrors.SlugTaken);
        }

        var slugTaken = await _dbContext.Restaurants
            .AnyAsync(restaurant => restaurant.Slug == slug, cancellationToken);

        if (slugTaken)
        {
            return Result.Failure<RestaurantResponse>(RestaurantErrors.SlugTaken);
        }

        var now = DateTimeOffset.UtcNow;

        var restaurant = new Restaurant
        {
            Id = Guid.CreateVersion7(),
            Name = request.Name.Trim(),
            Slug = slug,
            ContactEmail = Normalise(request.ContactEmail),
            ContactPhone = Normalise(request.ContactPhone),
            AddressLine = Normalise(request.AddressLine),
            City = Normalise(request.City),
            Country = Normalise(request.Country),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _dbContext.Restaurants.Add(restaurant);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created restaurant {RestaurantId} ({Slug}).",
            restaurant.Id,
            restaurant.Slug);

        return Result.Success(ToResponse(restaurant, manager: null));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<RestaurantSummaryResponse>>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var restaurants = await _dbContext.Restaurants
            .AsNoTracking()
            .OrderBy(restaurant => restaurant.Name)
            .Select(restaurant => new RestaurantSummaryResponse(
                restaurant.Id,
                restaurant.Name,
                restaurant.Slug,
                restaurant.City,
                restaurant.ManagerId,
                restaurant.Manager == null ? null : restaurant.Manager.FullName,
                restaurant.Manager == null ? null : restaurant.Manager.Email,
                restaurant.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<RestaurantSummaryResponse>>(restaurants);
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> GetByIdAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(candidate => candidate.Id == restaurantId, cancellationToken);

        return restaurant is null
            ? Result.Failure<RestaurantResponse>(RestaurantErrors.NotFound)
            : Result.Success(ToResponse(restaurant, restaurant.Manager));
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> UpdateAsync(
        Guid restaurantId,
        UpdateRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(candidate => candidate.Id == restaurantId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<RestaurantResponse>(RestaurantErrors.NotFound);
        }

        // A null slug means "leave it", which is not the same as an empty one. Only a
        // value that actually differs is validated, so re-saving the current slug
        // cannot fail against the restaurant own row.
        if (!string.IsNullOrWhiteSpace(request.Slug))
        {
            var slug = request.Slug.Trim().ToLowerInvariant();

            if (slug != restaurant.Slug)
            {
                var slugTaken = await _dbContext.Restaurants.AnyAsync(
                    candidate => candidate.Slug == slug && candidate.Id != restaurantId,
                    cancellationToken);

                if (slugTaken)
                {
                    return Result.Failure<RestaurantResponse>(RestaurantErrors.SlugTaken);
                }

                restaurant.Slug = slug;
            }
        }

        restaurant.Name = request.Name.Trim();
        restaurant.ContactEmail = Normalise(request.ContactEmail);
        restaurant.ContactPhone = Normalise(request.ContactPhone);
        restaurant.AddressLine = Normalise(request.AddressLine);
        restaurant.City = Normalise(request.City);
        restaurant.Country = Normalise(request.Country);
        restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Updated restaurant {RestaurantId}.", restaurant.Id);

        return Result.Success(ToResponse(restaurant, restaurant.Manager));
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants.SingleOrDefaultAsync(
            candidate => candidate.Id == restaurantId,
            cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<bool>(RestaurantErrors.NotFound);
        }

        // Orders first and on their own, because the answer is different: a restaurant
        // that has traded is never deletable, however much else is cleared away.
        var hasTraded = await _dbContext.Orders.AnyAsync(
            order => order.RestaurantId == restaurantId,
            cancellationToken);

        if (hasTraded)
        {
            return Result.Failure<bool>(RestaurantErrors.HasTraded);
        }

        // Everything the database would refuse the delete on anyway, checked here so
        // the caller gets a sentence instead of a foreign key violation. The menu is
        // absent from this list on purpose: it cascades, and a menu cannot mean
        // anything without the restaurant it belongs to.
        var hasSetupData =
            await _dbContext.RestaurantTables.AnyAsync(
                table => table.RestaurantId == restaurantId, cancellationToken)
            || await _dbContext.Users.AnyAsync(
                user => user.RestaurantId == restaurantId, cancellationToken)
            || await _dbContext.InventoryItems.AnyAsync(
                item => item.RestaurantId == restaurantId, cancellationToken)
            || await _dbContext.Customers.AnyAsync(
                customer => customer.RestaurantId == restaurantId, cancellationToken)
            || await _dbContext.Reservations.AnyAsync(
                reservation => reservation.RestaurantId == restaurantId, cancellationToken);

        if (hasSetupData)
        {
            return Result.Failure<bool>(RestaurantErrors.HasSetupData);
        }

        // Clear ownership before removing the row. The manager account outlives the
        // restaurant and simply becomes unassigned, which is a state the product
        // already understands.
        restaurant.ManagerId = null;

        _dbContext.Restaurants.Remove(restaurant);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Deleted restaurant {RestaurantId} ({Slug}).",
            restaurantId,
            restaurant.Slug);

        return Result.Success(true);
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        // Ownership is read from the database using the caller identity. No
        // restaurant identifier is accepted from the request, so there is nothing a
        // manager could change to reach a restaurant that is not theirs.
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        return restaurant is null
            ? Result.Failure<RestaurantResponse>(RestaurantErrors.NoRestaurantAssigned)
            : Result.Success(ToResponse(restaurant, restaurant.Manager));
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> UpdateForManagerAsync(
        Guid managerUserId,
        UpdateMyRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        // The restaurant is located by ownership, not by an identifier from the
        // request. There is no code path here that could load a different one.
        var restaurant = await _dbContext.Restaurants
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<RestaurantResponse>(RestaurantErrors.NoRestaurantAssigned);
        }

        // Only these fields are assigned. Slug, ManagerId, Id and the created
        // timestamp are never touched by a manager edit.
        restaurant.Name = request.Name.Trim();
        restaurant.AddressLine = Normalise(request.AddressLine);
        restaurant.City = Normalise(request.City);
        restaurant.Country = Normalise(request.Country);
        restaurant.ContactEmail = Normalise(request.ContactEmail);
        restaurant.ContactPhone = Normalise(request.ContactPhone);
        restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} updated restaurant {RestaurantId}.",
            managerUserId,
            restaurant.Id);

        return Result.Success(ToResponse(restaurant, restaurant.Manager));
    }

    private static RestaurantResponse ToResponse(Restaurant restaurant, ApplicationUser? manager) =>
        new(
            restaurant.Id,
            restaurant.Name,
            restaurant.Slug,
            restaurant.ContactEmail,
            restaurant.ContactPhone,
            restaurant.AddressLine,
            restaurant.City,
            restaurant.Country,
            manager is null
                ? null
                : new RestaurantManagerDto(
                    manager.Id,
                    manager.FullName,
                    manager.Email ?? string.Empty),
            restaurant.CreatedAtUtc,
            restaurant.UpdatedAtUtc);

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <inheritdoc />
    public async Task<Result<RestaurantSettingsResponse>> GetSettingsAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        return restaurant is null
            ? Result.Failure<RestaurantSettingsResponse>(
                RestaurantErrors.NoRestaurantAssigned)
            : Result.Success(ToSettings(restaurant));
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantSettingsResponse>> UpdateSettingsAsync(
        Guid managerUserId,
        UpdateRestaurantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<RestaurantSettingsResponse>(
                RestaurantErrors.NoRestaurantAssigned);
        }

        var zoneId = request.TimeZoneId.Trim();

        // Checked against the zone database rather than against a pattern. A
        // well-formed identifier nothing recognises would pass a regular expression
        // and then be silently replaced by UTC on every day calculation afterwards.
        if (!TryFindZone(zoneId, out var zone))
        {
            return Result.Failure<RestaurantSettingsResponse>(
                RestaurantErrors.UnknownTimeZone);
        }

        restaurant.TimeZoneId = zone.Id;
        restaurant.DayStartHour = request.DayStartHour;
        restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} set restaurant {RestaurantId} to {TimeZoneId} " +
            "with a service day starting at {DayStartHour}.",
            managerUserId,
            restaurant.Id,
            restaurant.TimeZoneId,
            restaurant.DayStartHour);

        return Result.Success(ToSettings(restaurant));
    }

    /// <inheritdoc />
    public Task<Result<IReadOnlyList<TimeZoneOptionResponse>>> GetTimeZonesAsync(
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var zones = TimeZoneInfo.GetSystemTimeZones()
            .Select(zone => new TimeZoneOptionResponse(
                zone.Id,
                zone.DisplayName,
                (int)zone.GetUtcOffset(now).TotalMinutes))
            // By offset then name, so a manager scanning for their own region finds it
            // near the others that keep the same time.
            .OrderBy(option => option.CurrentUtcOffsetMinutes)
            .ThenBy(option => option.Id, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Task.FromResult(
            Result.Success<IReadOnlyList<TimeZoneOptionResponse>>(zones));
    }

    /// <summary>
    /// Whether this machine knows the identifier, and the zone if it does.
    ///
    /// Wrapped because the lookup signals an unknown zone by throwing, and an unknown
    /// zone here is an ordinary validation failure rather than an exceptional event.
    /// </summary>
    private static bool TryFindZone(string id, out TimeZoneInfo zone)
    {
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (Exception exception) when (
            exception is TimeZoneNotFoundException
                or InvalidTimeZoneException
                or ArgumentException)
        {
            zone = TimeZoneInfo.Utc;
            return false;
        }
    }

    /// <summary>
    /// The settings, plus what they currently amount to.
    ///
    /// The offset and the day boundary are derived here rather than stored, so they
    /// cannot go stale against the zone rules or against the clock.
    /// </summary>
    private static RestaurantSettingsResponse ToSettings(Restaurant restaurant)
    {
        var now = DateTimeOffset.UtcNow;
        var zone = restaurant.ResolveTimeZone();

        return new RestaurantSettingsResponse(
            restaurant.TimeZoneId,
            zone.DisplayName,
            (int)zone.GetUtcOffset(now).TotalMinutes,
            restaurant.DayStartHour,
            restaurant.ServiceDayStart(now));
    }

    /// <summary>
    /// Builds a URL-friendly slug from a name. Collisions are reported to the caller
    /// rather than silently suffixed, so the resulting slug is never a surprise.
    /// </summary>
    private static string CreateSlug(string name)
    {
        var lowered = name.Trim().ToLowerInvariant();
        var builder = new StringBuilder(lowered.Length);

        foreach (var character in lowered)
        {
            builder.Append(char.IsAsciiLetterOrDigit(character) ? character : '-');
        }

        return HyphenRuns().Replace(builder.ToString(), "-").Trim('-');
    }

    [GeneratedRegex("-{2,}")]
    private static partial Regex HyphenRuns();
}
