using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Sites;
using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Domain.Sites;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Sites;

/// <summary>
/// The restaurant website: one page per restaurant, drawn by one of five designs.
///
/// The manager edits content and picks a design; they cannot change the structure,
/// which is the whole reason this is safe to hand to somebody with no HTML. What
/// arrives here is therefore treated as text to be displayed, not as markup: the
/// only things validated are the ones that stop being text when a browser reads
/// them, which is links and the accent colour.
/// </summary>
public sealed partial class SiteService : ISiteService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<SiteService> _logger;

    /// <summary>
    /// Case-insensitive because the property names in the stored JSON came from a
    /// camel-cased client, and the records here are Pascal-cased.
    /// </summary>
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Creates the service.</summary>
    public SiteService(ApplicationDbContext dbContext, ILogger<SiteService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<SiteResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<SiteResponse>(SiteErrors.NoRestaurantAssigned);
        }

        var site = await LoadOrCreateAsync(restaurant.Value, cancellationToken);

        return Result.Success(ToResponse(site, restaurant.Value.Slug));
    }

    /// <inheritdoc />
    public async Task<Result<SiteResponse>> SaveAsync(
        Guid managerUserId,
        SaveSiteRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<SiteResponse>(SiteErrors.NoRestaurantAssigned);
        }

        // Normalised before validation as well as after reading: a client that omits
        // a section would otherwise store a null the next reader has to survive.
        var content = request.Content.Normalised();

        var invalid = Validate(content);

        if (invalid is not null)
        {
            return Result.Failure<SiteResponse>(invalid);
        }

        var site = await LoadOrCreateAsync(restaurant.Value, cancellationToken);

        site.Template = request.Template;
        site.ContentJson = JsonSerializer.Serialize(content, SerializerOptions);
        site.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} saved the website for restaurant {RestaurantId}.",
            managerUserId,
            restaurant.Value.Id);

        return Result.Success(ToResponse(site, restaurant.Value.Slug));
    }

    /// <inheritdoc />
    public async Task<Result<SiteResponse>> SetPublishedAsync(
        Guid managerUserId,
        SetSitePublishedRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<SiteResponse>(SiteErrors.NoRestaurantAssigned);
        }

        var site = await LoadOrCreateAsync(restaurant.Value, cancellationToken);

        if (site.IsPublished != request.IsPublished)
        {
            site.IsPublished = request.IsPublished;

            // Only moved forward. Taking a page down and putting it back should not
            // read as though the content changed in between, and the manager is shown
            // "published X, edited since" from the pair.
            if (request.IsPublished)
            {
                site.PublishedAtUtc = DateTimeOffset.UtcNow;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Website for restaurant {RestaurantId} is now {State}.",
                restaurant.Value.Id,
                request.IsPublished ? "public" : "withdrawn");
        }

        return Result.Success(ToResponse(site, restaurant.Value.Slug));
    }

    /// <inheritdoc />
    public async Task<Result<PublicSiteResponse>> GetPublishedAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        var normalised = (slug ?? string.Empty).Trim().ToLowerInvariant();

        if (normalised.Length == 0)
        {
            return Result.Failure<PublicSiteResponse>(SiteErrors.NotFound);
        }

        // A suspended restaurant takes its website down with it. Suspension is about
        // stopping a business trading, and a page still inviting bookings would be
        // doing the opposite.
        var row = await _dbContext.RestaurantSites
            .AsNoTracking()
            .Where(site =>
                site.IsPublished &&
                site.Restaurant.IsActive &&
                site.Restaurant.Slug == normalised)
            .Select(site => new
            {
                site.Restaurant.Name,
                site.Template,
                site.ContentJson,
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return Result.Failure<PublicSiteResponse>(SiteErrors.NotFound);
        }

        return Result.Success(new PublicSiteResponse(
            row.Name,
            row.Template,
            Deserialize(row.ContentJson)));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<SiteImageResponse>>> GetImagesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<IReadOnlyList<SiteImageResponse>>(
                SiteErrors.NoRestaurantAssigned);
        }

        // Projected without Content, so listing a gallery does not pull megabytes of
        // image data across the wire to render a list of names.
        var images = await _dbContext.SiteImages
            .AsNoTracking()
            .Where(image => image.RestaurantId == restaurant.Value.Id)
            .OrderByDescending(image => image.CreatedAtUtc)
            .Select(image => new SiteImageResponse(
                image.Id,
                PublicUrlFor(image.Id),
                image.FileName,
                image.ByteCount,
                image.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<SiteImageResponse>>(images);
    }

    /// <inheritdoc />
    public async Task<Result<SiteImageResponse>> AddImageAsync(
        Guid managerUserId,
        string fileName,
        string contentType,
        Stream content,
        long declaredLength,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.NoRestaurantAssigned);
        }

        if (declaredLength <= 0)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageEmpty);
        }

        // Checked before reading, so an oversized upload is refused rather than
        // buffered. The length is checked again after the read, because this one is
        // what the client said.
        if (declaredLength > SiteImageLimits.MaxBytes)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageTooLarge);
        }

        if (!SiteImageLimits.AllowedTypes.ContainsKey(contentType))
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageTypeNotAllowed);
        }

        var held = await _dbContext.SiteImages
            .CountAsync(image => image.RestaurantId == restaurant.Value.Id, cancellationToken);

        if (held >= SiteImageLimits.MaxPerRestaurant)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageLimitReached);
        }

        // Capped at the read as well as before it. A declared length is a claim, and
        // this is the number that decides how many bytes end up in the row.
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);

        if (buffer.Length == 0)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageEmpty);
        }

        if (buffer.Length > SiteImageLimits.MaxBytes)
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageTooLarge);
        }

        var bytes = buffer.ToArray();

        // The declared type is only believed once the bytes agree with it. Without
        // this the whitelist checks a header the uploader wrote.
        if (!LooksLikeImage(bytes, contentType))
        {
            return Result.Failure<SiteImageResponse>(SiteErrors.ImageTypeNotAllowed);
        }

        var site = await LoadOrCreateAsync(restaurant.Value, cancellationToken);

        var image = new SiteImage
        {
            Id = Guid.CreateVersion7(),
            RestaurantSiteId = site.Id,
            RestaurantId = restaurant.Value.Id,
            FileName = SafeFileName(fileName, contentType),
            ContentType = contentType.ToLowerInvariant(),
            ByteCount = bytes.Length,
            Content = bytes,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        _dbContext.SiteImages.Add(image);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} uploaded a {ByteCount} byte image for restaurant {RestaurantId}.",
            managerUserId,
            image.ByteCount,
            restaurant.Value.Id);

        return Result.Success(new SiteImageResponse(
            image.Id,
            PublicUrlFor(image.Id),
            image.FileName,
            image.ByteCount,
            image.CreatedAtUtc));
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteImageAsync(
        Guid managerUserId,
        Guid imageId,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<bool>(SiteErrors.NoRestaurantAssigned);
        }

        // Scoped to the caller's restaurant, so an identifier from somewhere else
        // reports "not found" rather than deleting somebody's photograph.
        var image = await _dbContext.SiteImages
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == imageId &&
                    candidate.RestaurantId == restaurant.Value.Id,
                cancellationToken);

        if (image is null)
        {
            return Result.Failure<bool>(SiteErrors.ImageNotFound);
        }

        _dbContext.SiteImages.Remove(image);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }

    /// <inheritdoc />
    public async Task<Result<(byte[] Content, string ContentType)>> GetImageBytesAsync(
        Guid imageId,
        CancellationToken cancellationToken)
    {
        // Not gated on the site being published. An identifier is a version 7 GUID
        // that nothing enumerates, and gating would mean a manager could not see
        // their own pictures while building the page.
        var image = await _dbContext.SiteImages
            .AsNoTracking()
            .Where(candidate => candidate.Id == imageId)
            .Select(candidate => new { candidate.Content, candidate.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        return image is null
            ? Result.Failure<(byte[], string)>(SiteErrors.ImageNotFound)
            : Result.Success((image.Content, image.ContentType));
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// Finds the restaurant the caller manages. Ownership lives on the restaurant
    /// row, which is the only place it is stored.
    /// </summary>
    private async Task<(Guid Id, string Slug)?> ResolveRestaurantAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(candidate => candidate.ManagerId == managerUserId)
            .Select(candidate => new { candidate.Id, candidate.Slug })
            .FirstOrDefaultAsync(cancellationToken);

        return restaurant is null ? null : (restaurant.Id, restaurant.Slug);
    }

    /// <summary>
    /// The site row, created empty and unpublished if this is the first time anybody
    /// has asked for it.
    /// </summary>
    private async Task<RestaurantSite> LoadOrCreateAsync(
        (Guid Id, string Slug) restaurant,
        CancellationToken cancellationToken)
    {
        var site = await _dbContext.RestaurantSites
            .SingleOrDefaultAsync(
                candidate => candidate.RestaurantId == restaurant.Id,
                cancellationToken);

        if (site is not null)
        {
            return site;
        }

        var now = DateTimeOffset.UtcNow;

        site = new RestaurantSite
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurant.Id,
            Template = SiteTemplate.Aurora,
            ContentJson = JsonSerializer.Serialize(
                SiteContent.Empty(),
                SerializerOptions),
            // Unpublished, so a page nobody has written yet is not on the open
            // internet under the restaurant's name.
            IsPublished = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.RestaurantSites.Add(site);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return site;
    }

    /// <summary>
    /// Parses stored content, falling back to an empty page.
    ///
    /// A stored record is not trusted to match the current shape: it may have been
    /// written by an older build. Anything unreadable renders as an empty page
    /// rather than a five hundred, because a blank website is recoverable by editing
    /// it and an error page is not.
    /// </summary>
    private static SiteContent Deserialize(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return SiteContent.Empty();
        }

        try
        {
            return JsonSerializer.Deserialize<SiteContent>(json, SerializerOptions)
                ?.Normalised()
                ?? SiteContent.Empty();
        }
        catch (JsonException)
        {
            return SiteContent.Empty();
        }
    }

    private static SiteResponse ToResponse(RestaurantSite site, string slug) =>
        new(
            site.Template,
            Deserialize(site.ContentJson),
            site.IsPublished,
            slug,
            site.UpdatedAtUtc,
            site.PublishedAtUtc,
            site.IsPublished &&
                site.PublishedAtUtc is not null &&
                site.UpdatedAtUtc > site.PublishedAtUtc);

    /// <summary>
    /// Where a stored image is served from.
    ///
    /// Relative on purpose. The page is served from whatever host the restaurant is
    /// reached on, and an absolute URL baked in here would break the moment the
    /// platform moved or a subdomain was added.
    /// </summary>
    private static string PublicUrlFor(Guid imageId) =>
        $"/api/public/site-images/{imageId}";

    /// <summary>
    /// Checks the two things on this page that stop being inert text when a browser
    /// reads them: the colour, which is interpolated into a style, and the links,
    /// which a visitor clicks.
    ///
    /// Everything else is deliberately unchecked. It is displayed as text by a React
    /// renderer that escapes it, so there is nothing to sanitise and a filter over it
    /// would only mangle a menu that legitimately mentions an ampersand.
    /// </summary>
    private static Error? Validate(SiteContent content)
    {
        if (!IsValidAccent(content.Theme.Accent))
        {
            return SiteErrors.AccentInvalid;
        }

        var links = new (string Field, string Value)[]
        {
            ("the hero button", content.Hero.PrimaryHref),
            ("the second hero button", content.Hero.SecondaryHref),
            ("the map link", content.Contact.MapUrl),
            ("the booking link", content.Contact.BookingUrl),
            ("the closing button", content.CallToAction.ButtonHref),
            ("the private dining button", content.Events.ButtonHref),
        };

        foreach (var (field, value) in links)
        {
            if (!IsSafeLink(value))
            {
                return SiteErrors.LinkInvalid(field);
            }
        }

        foreach (var link in content.Footer.Links)
        {
            if (!IsSafeLink(link.Url))
            {
                return SiteErrors.LinkInvalid($"the footer link \"{link.Label}\"");
            }
        }

        return null;
    }

    /// <summary>Blank, or a three or six digit hex colour.</summary>
    private static bool IsValidAccent(string accent) =>
        string.IsNullOrWhiteSpace(accent) || AccentPattern().IsMatch(accent.Trim());

    /// <summary>
    /// Blank, a site-relative path, or an absolute URL in a scheme a link may use.
    ///
    /// A whitelist rather than a search for "javascript:", because the blacklist form
    /// of this check has been escaped every way there is: casing, entities,
    /// whitespace inside the scheme. Anything that is not plainly one of these four
    /// is refused.
    /// </summary>
    private static bool IsSafeLink(string url)
    {
        var trimmed = (url ?? string.Empty).Trim();

        if (trimmed.Length == 0)
        {
            return true;
        }

        // A fragment scrolls the page it is already on. It cannot navigate anywhere
        // or carry a scheme, so anything after the hash is inert. Allowed because
        // the designs with anchored navigation need it: a hero button reading "See
        // the menu" points at "#menu" on the same page.
        if (trimmed.StartsWith('#'))
        {
            return true;
        }

        // A relative path stays on this site, so it cannot carry a scheme at all.
        // Guarded against "//evil.example", which is protocol-relative and leaves.
        if (trimmed.StartsWith('/'))
        {
            return !trimmed.StartsWith("//", StringComparison.Ordinal);
        }

        return trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("tel:", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Whether the bytes begin the way the declared type says they should.
    ///
    /// Not a full decode, which would mean an imaging library for a check this
    /// cheap. It is enough to stop a file being stored under a picture's media type
    /// while containing something else.
    /// </summary>
    private static bool LooksLikeImage(byte[] bytes, string contentType)
    {
        if (bytes.Length < 12)
        {
            return false;
        }

        return contentType.ToLowerInvariant() switch
        {
            // SOI marker.
            "image/jpeg" => bytes[0] == 0xFF && bytes[1] == 0xD8,
            // The eight byte PNG signature.
            "image/png" =>
                bytes[0] == 0x89 && bytes[1] == 0x50 &&
                bytes[2] == 0x4E && bytes[3] == 0x47,
            // Both sit in a RIFF or ISO base media container; the brand is at byte 8.
            "image/webp" =>
                bytes[0] == 0x52 && bytes[1] == 0x49 &&
                bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 &&
                bytes[10] == 0x42 && bytes[11] == 0x50,
            "image/avif" =>
                bytes[4] == 0x66 && bytes[5] == 0x74 &&
                bytes[6] == 0x79 && bytes[7] == 0x70,
            _ => false,
        };
    }

    /// <summary>
    /// A display name for the picker, stripped of anything that is not a name.
    ///
    /// Never used to open a file - the bytes are in a column - but it is rendered
    /// back to the manager, so a path is reduced to its last segment and the length
    /// is bounded.
    /// </summary>
    private static string SafeFileName(string fileName, string contentType)
    {
        var name = Path.GetFileName(fileName ?? string.Empty).Trim();

        if (name.Length == 0)
        {
            return $"image{SiteImageLimits.AllowedTypes[contentType]}";
        }

        return name.Length > 128 ? name[^128..] : name;
    }

    [GeneratedRegex(@"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")]
    private static partial Regex AccentPattern();
}
