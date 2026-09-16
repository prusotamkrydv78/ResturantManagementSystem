using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Sites;
using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Domain.Sites;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Sites;

/// <summary>
/// A restaurant's public page.
///
/// The content passes through this service without being understood. It arrives as
/// JSON, it is measured, it is stored as text, and it is handed back as JSON — nothing
/// here parses it into a shape, because the shape belongs to the templates and changes
/// whenever a design does. The only thing this file knows about a page is how big it
/// is allowed to be.
/// </summary>
public sealed class SiteService : ISiteService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<SiteService> _logger;

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

        var site = await LoadOrCreateAsync(restaurant.Value.Id, cancellationToken);

        return Result.Success(ToResponse(site, restaurant.Value.Slug));
    }

    /// <inheritdoc />
    public async Task<Result<SiteResponse>> SaveDraftAsync(
        Guid managerUserId,
        SaveSiteDraftRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<SiteResponse>(SiteErrors.NoRestaurantAssigned);
        }

        var design = (request.Design ?? string.Empty).Trim();

        if (design.Length == 0 || design.Length > 40)
        {
            return Result.Failure<SiteResponse>(SiteErrors.DesignMissing);
        }

        var json = Serialise(request.Content);

        // Measured in bytes rather than characters, because that is what the column
        // holds and what a limit is for.
        if (Encoding.UTF8.GetByteCount(json) > RestaurantSite.MaxContentBytes)
        {
            return Result.Failure<SiteResponse>(
                SiteErrors.ContentTooLarge(RestaurantSite.MaxContentBytes));
        }

        var site = await LoadOrCreateAsync(restaurant.Value.Id, cancellationToken);

        site.Design = design;
        site.DraftJson = json;
        site.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

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

        var site = await LoadOrCreateAsync(restaurant.Value.Id, cancellationToken);

        if (request.IsPublished)
        {
            // The copy is taken here and nowhere else. This one line is what makes
            // editing a live page safe: everything the manager has typed since the last
            // press has been going into the draft, and none of it has been public.
            site.PublishedJson = site.DraftJson;
            site.PublishedDesign = site.Design;
            site.PublishedAtUtc = DateTimeOffset.UtcNow;
            site.IsPublished = true;
        }
        else
        {
            // Withdrawn, not erased. The published copy stays so putting the page back
            // is one press rather than a republish of a draft that has moved on.
            site.IsPublished = false;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Website for restaurant {RestaurantId} is now {State}.",
            restaurant.Value.Id,
            request.IsPublished ? "public" : "withdrawn");

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
                site.PublishedJson != null &&
                site.Restaurant.IsActive &&
                site.Restaurant.Slug == normalised)
            .Select(site => new
            {
                site.Restaurant.Name,
                site.PublishedDesign,
                site.PublishedJson,
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return Result.Failure<PublicSiteResponse>(SiteErrors.NotFound);
        }

        return Result.Success(new PublicSiteResponse(
            row.Name,
            row.PublishedDesign ?? string.Empty,
            Parse(row.PublishedJson)));
    }

    /// <summary>
    /// The record, created empty the first time anybody asks.
    ///
    /// Created on read rather than when a restaurant is registered, so a restaurant
    /// that never opens this screen never has a row. The draft starts as an empty
    /// object and the editor fills it; the server has no opinion about what a page
    /// should contain.
    /// </summary>
    private async Task<RestaurantSite> LoadOrCreateAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var site = await _dbContext.RestaurantSites
            .SingleOrDefaultAsync(row => row.RestaurantId == restaurantId, cancellationToken);

        if (site is not null)
        {
            return site;
        }

        var now = DateTimeOffset.UtcNow;

        site = new RestaurantSite
        {
            RestaurantId = restaurantId,
            Design = string.Empty,
            DraftJson = "{}",
            IsPublished = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.RestaurantSites.Add(site);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return site;
    }

    private static SiteResponse ToResponse(RestaurantSite site, string slug) =>
        new(
            site.Design,
            Parse(site.DraftJson),
            site.IsPublished,
            // What this actually means: the draft has moved since the copy was taken.
            // It is not "the public cannot see your work" — the public has never seen
            // the draft, which is the point of there being two columns.
            site.PublishedAtUtc is not null && site.UpdatedAtUtc > site.PublishedAtUtc,
            slug,
            site.UpdatedAtUtc,
            site.PublishedAtUtc);

    /// <summary>
    /// The content as text.
    ///
    /// Anything that is not an object is stored as an empty one. A page is a record of
    /// sections; a bare array or a number arriving here is a bug in a caller, and
    /// keeping it would only move the failure to whichever template read it back.
    /// </summary>
    private static string Serialise(JsonElement content) =>
        content.ValueKind == JsonValueKind.Object ? content.GetRawText() : "{}";

    /// <summary>
    /// The stored text as JSON.
    ///
    /// A column written by an older build, or by hand, still has to come back as
    /// something a template can read rather than take the request down.
    /// </summary>
    private static JsonElement Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return JsonDocument.Parse("{}").RootElement.Clone();
        }

        try
        {
            return JsonDocument.Parse(json).RootElement.Clone();
        }
        catch (JsonException)
        {
            return JsonDocument.Parse("{}").RootElement.Clone();
        }
    }

    /// <summary>
    /// Which restaurant this manager runs, with its slug.
    ///
    /// Read from <c>Restaurant.ManagerId</c> rather than from the account's own
    /// restaurant column: that column is what a member of staff belongs to, and a
    /// manager is attached the other way round.
    /// </summary>
    private async Task<(Guid Id, string Slug)?> ResolveRestaurantAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var row = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => new { restaurant.Id, restaurant.Slug })
            .SingleOrDefaultAsync(cancellationToken);

        return row is null ? null : (row.Id, row.Slug);
    }
}
