using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Media;
using RestaurantManagement.Application.Media.Dtos;
using RestaurantManagement.Domain.Media;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Media;

/// <summary>
/// A restaurant's picture library.
///
/// The bytes are never loaded unless somebody asked for exactly those bytes. Listing
/// the library projects to everything except <see cref="RestaurantMedia.Content"/>, so
/// a manager opening a grid of sixty thumbnails is not pulling two hundred megabytes
/// through the application to render sixty names. That projection is the whole reason
/// the picture is a row of its own rather than columns on something else, and it is
/// the easiest thing in this file to undo by accident.
/// </summary>
public sealed class MediaService : IMediaService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<MediaService> _logger;

    /// <summary>Creates the service.</summary>
    public MediaService(ApplicationDbContext dbContext, ILogger<MediaService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<MediaLibraryResponse>> GetLibraryAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MediaLibraryResponse>(MediaErrors.NoRestaurantAssigned);
        }

        var items = await _dbContext.RestaurantMedia
            .AsNoTracking()
            .Where(media => media.RestaurantId == restaurantId.Value)
            .OrderByDescending(media => media.CreatedAtUtc)
            .Select(media => new MediaResponse(
                media.Id,
                // Composed in the projection rather than after it, so the shape of the
                // address is decided by the domain and never by a caller.
                RestaurantMedia.UrlFor(media.Id),
                media.FileName,
                media.ContentType,
                media.ByteCount,
                media.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success(new MediaLibraryResponse(
            items,
            items.Count,
            RestaurantMedia.MaxPerRestaurant,
            items.Sum(item => (long)item.ByteCount)));
    }

    /// <inheritdoc />
    public async Task<Result<MediaResponse>> AddAsync(
        Guid managerUserId,
        string fileName,
        string contentType,
        Stream content,
        long declaredLength,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MediaResponse>(MediaErrors.NoRestaurantAssigned);
        }

        if (declaredLength <= 0)
        {
            return Result.Failure<MediaResponse>(MediaErrors.Empty);
        }

        // Checked before reading, so an oversized upload is refused without being
        // pulled into memory first.
        if (declaredLength > RestaurantMedia.MaxBytes)
        {
            return Result.Failure<MediaResponse>(
                MediaErrors.TooLarge(RestaurantMedia.MaxBytes));
        }

        if (!ImageMedia.AllowedTypes.ContainsKey(contentType))
        {
            return Result.Failure<MediaResponse>(MediaErrors.TypeNotAllowed);
        }

        var held = await _dbContext.RestaurantMedia
            .CountAsync(media => media.RestaurantId == restaurantId.Value, cancellationToken);

        if (held >= RestaurantMedia.MaxPerRestaurant)
        {
            return Result.Failure<MediaResponse>(
                MediaErrors.LimitReached(RestaurantMedia.MaxPerRestaurant));
        }

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        // The declared length was a claim. This is what actually arrived, and it is the
        // one the limit has to hold against.
        if (bytes.Length == 0)
        {
            return Result.Failure<MediaResponse>(MediaErrors.Empty);
        }

        if (bytes.Length > RestaurantMedia.MaxBytes)
        {
            return Result.Failure<MediaResponse>(
                MediaErrors.TooLarge(RestaurantMedia.MaxBytes));
        }

        // The declared type was also a claim. These bytes are served back from this
        // origin to strangers, so what they actually begin with decides.
        if (!ImageMedia.LooksLikeImage(bytes, contentType))
        {
            return Result.Failure<MediaResponse>(MediaErrors.TypeNotAllowed);
        }

        var media = new RestaurantMedia
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            ContentType = contentType,
            FileName = ImageMedia.SafeFileName(fileName, contentType),
            ByteCount = bytes.Length,
            Content = bytes,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        _dbContext.RestaurantMedia.Add(media);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Restaurant {RestaurantId} added picture {MediaId} ({ByteCount} bytes).",
            restaurantId.Value,
            media.Id,
            media.ByteCount);

        return Result.Success(new MediaResponse(
            media.Id,
            RestaurantMedia.UrlFor(media.Id),
            media.FileName,
            media.ContentType,
            media.ByteCount,
            media.CreatedAtUtc));
    }

    /// <inheritdoc />
    public async Task<Result<bool>> RemoveAsync(
        Guid managerUserId,
        Guid id,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<bool>(MediaErrors.NoRestaurantAssigned);
        }

        // Scoped to the restaurant in the same clause as the identifier, so a manager
        // guessing an id belonging to somebody else gets "not found" rather than a
        // deletion.
        var removed = await _dbContext.RestaurantMedia
            .Where(media => media.Id == id && media.RestaurantId == restaurantId.Value)
            .ExecuteDeleteAsync(cancellationToken);

        if (removed == 0)
        {
            return Result.Failure<bool>(MediaErrors.NotFound);
        }

        _logger.LogInformation(
            "Restaurant {RestaurantId} removed picture {MediaId}.",
            restaurantId.Value,
            id);

        return Result.Success(true);
    }

    /// <inheritdoc />
    public async Task<Result<(byte[] Content, string ContentType)>> GetBytesAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var row = await _dbContext.RestaurantMedia
            .AsNoTracking()
            .Where(media => media.Id == id)
            .Select(media => new { media.Content, media.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        return row is null
            ? Result.Failure<(byte[], string)>(MediaErrors.NotFound)
            : Result.Success((row.Content, row.ContentType));
    }

    /// <summary>
    /// Which restaurant this manager runs, or nothing.
    ///
    /// Read from <c>Restaurant.ManagerId</c> rather than from the account's own
    /// restaurant column: that column is what a member of staff belongs to, and a
    /// manager is attached the other way round.
    /// </summary>
    private async Task<Guid?> ResolveRestaurantAsync(
        Guid managerUserId,
        CancellationToken cancellationToken) =>
        await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => (Guid?)restaurant.Id)
            .SingleOrDefaultAsync(cancellationToken);
}
