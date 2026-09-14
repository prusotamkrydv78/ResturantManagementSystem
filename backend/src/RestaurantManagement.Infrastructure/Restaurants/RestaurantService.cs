using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Managers;
using RestaurantManagement.Application.Managers.Dtos;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Application.Restaurants;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Platform;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Restaurants;

/// <summary>
/// Restaurant use cases.
///
/// Assignment rules are not reimplemented here. Creating a restaurant can create or
/// attach its manager in one transaction, but it does that by calling the manager
/// module, which remains the only place those rules live.
/// </summary>
public sealed partial class RestaurantService : IRestaurantService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IManagerService _managerService;
    private readonly IAdminActivityLog _activity;
    private readonly ILogger<RestaurantService> _logger;

    /// <summary>Creates the service.</summary>
    public RestaurantService(
        ApplicationDbContext dbContext,
        IManagerService managerService,
        IAdminActivityLog activity,
        ILogger<RestaurantService> logger)
    {
        _activity = activity;
        _dbContext = dbContext;
        _managerService = managerService;
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

        // The rates a new restaurant starts on come from the platform defaults, and
        // from the entity own constants only when nobody has ever set them. Inherited
        // at creation and then owned by the restaurant: changing the platform default
        // later moves what the next restaurant starts on, never what an existing one
        // is charging, and never what a bill already printed says.
        var defaults = await _dbContext.PlatformSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == PlatformSettings.WellKnownId,
                cancellationToken)
            ?? new PlatformSettings();

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
            VatRate = defaults.DefaultVatRate,
            ServiceChargeRate = defaults.DefaultServiceChargeRate,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var withManager = request.ManagerId is not null || request.CreatesManager;

        // A restaurant with nobody assigned cannot trade, so when the caller named a
        // manager the two have to land together or not at all. Without this a rejected
        // email would leave an unusable restaurant behind and the caller looking at an
        // error, which is the worst of both.
        await using var transaction = withManager
            ? await _dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        _dbContext.Restaurants.Add(restaurant);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (withManager)
        {
            // Delegated rather than reimplemented. Every rule about who may manage what
            // lives in the manager module, and a second copy here would be the one that
            // fell behind. It reads the restaurant inside this transaction, so the row
            // just inserted is visible to it.
            var assignment = request.ManagerId is { } managerId
                ? await _managerService.AssignAsync(managerId, restaurant.Id, cancellationToken)
                : await _managerService.CreateAsync(
                    new CreateManagerRequest
                    {
                        FullName = request.ManagerFullName!,
                        Email = request.ManagerEmail!,
                        Password = request.ManagerPassword!,
                        RestaurantId = restaurant.Id,
                    },
                    cancellationToken);

            if (assignment.IsFailure)
            {
                await transaction!.RollbackAsync(cancellationToken);

                // The manager module's own error, passed straight through: "that email is
                // already in use" is what the caller needs to read, not a restaurant
                // error invented to wrap it.
                return Result.Failure<RestaurantResponse>(assignment.Error!);
            }
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        _logger.LogInformation(
            "Created restaurant {RestaurantId} ({Slug}){Assignment}.",
            restaurant.Id,
            restaurant.Slug,
            withManager ? " with a manager" : " with no manager yet");

        await _activity.RecordAsync(
            AdminActions.RestaurantCreated,
            restaurant.Name,
            restaurant.Id,
            withManager ? "With a manager" : "No manager yet",
            cancellationToken);

        // Re-read so the response carries the manager the transaction just attached.
        return await GetByIdAsync(restaurant.Id, cancellationToken);
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
                restaurant.IsActive,
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

        await _activity.RecordAsync(
            AdminActions.RestaurantUpdated,
            restaurant.Name,
            restaurant.Id,
            cancellationToken: cancellationToken);

        return Result.Success(ToResponse(restaurant, restaurant.Manager));
    }

    /// <inheritdoc />
    public async Task<Result<RestaurantResponse>> SetActiveAsync(
        Guid restaurantId,
        SetRestaurantActiveRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(candidate => candidate.Id == restaurantId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<RestaurantResponse>(RestaurantErrors.NotFound);
        }

        if (restaurant.IsActive == request.IsActive)
        {
            return Result.Success(ToResponse(restaurant, restaurant.Manager));
        }

        restaurant.IsActive = request.IsActive;
        restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Nothing else is touched. The manager keeps the restaurant, the staff keep
        // their accounts, and open orders keep running to the till - suspension is
        // about new business, so unwinding any of that would be doing more than was
        // asked and would strand work already in the kitchen.
        //
        // Counted at Warning when suspending: it stops a business trading, and that is
        // worth finding in a log without knowing to look for it.
        if (request.IsActive)
        {
            _logger.LogInformation(
                "Restaurant {RestaurantId} ({Slug}) is back in service.",
                restaurantId,
                restaurant.Slug);
        }
        else
        {
            _logger.LogWarning(
                "Restaurant {RestaurantId} ({Slug}) suspended. It can take no new orders.",
                restaurantId,
                restaurant.Slug);
        }

        await _activity.RecordAsync(
            request.IsActive
                ? AdminActions.RestaurantRestored
                : AdminActions.RestaurantSuspended,
            restaurant.Name,
            restaurantId,
            cancellationToken: cancellationToken);

        return Result.Success(ToResponse(restaurant, restaurant.Manager));
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
            restaurant.IsActive,
            restaurant.CreatedAtUtc,
            restaurant.UpdatedAtUtc);

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
