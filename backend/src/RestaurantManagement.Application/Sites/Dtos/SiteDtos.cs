using System.Text.Json;
using System.Text.Json.Serialization;

namespace RestaurantManagement.Application.Sites.Dtos;

/// <summary>
/// A restaurant's page, as its manager reads it.
///
/// The content travels as a <see cref="JsonElement"/> and is never parsed into a shape
/// on the way past. Which sections a page has belongs to the templates, and a typed
/// record here would be a second description of it — one that has to be changed, and
/// deployed, every time a design wants another field.
/// </summary>
/// <param name="Design">Which design the draft is built on.</param>
/// <param name="Content">The draft, whole.</param>
/// <param name="IsPublished">Whether the public can reach it.</param>
/// <param name="HasUnpublishedChanges">Whether the draft has moved since the last publish.</param>
/// <param name="Slug">Where it lives. Read-only here; only a platform admin changes it.</param>
/// <param name="UpdatedAtUtc">When the draft last changed.</param>
/// <param name="PublishedAtUtc">When it was last published, or null.</param>
public sealed record SiteResponse(
    string Design,
    JsonElement Content,
    bool IsPublished,
    bool HasUnpublishedChanges,
    string Slug,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? PublishedAtUtc);

/// <summary>
/// What a visitor is served.
///
/// Carries no publication state at all: an unpublished page is not a page with a flag
/// on it, it is a 404. Nothing here says when it was written or whether a newer draft
/// exists, because none of that is a stranger's business.
/// </summary>
/// <remarks>
/// The contact details are here rather than left to a second request, because every
/// design prints them: a restaurant page with no address and no telephone number is
/// not a restaurant page. They are also the least private facts a business holds — a
/// restaurant that did not want its address known would not have a website — so there
/// is nothing to weigh against putting them on an open endpoint.
/// </remarks>
/// <param name="RestaurantName">The name, so a design need not be told it separately.</param>
/// <param name="Design">Which design to draw it with.</param>
/// <param name="Content">The published copy, whole.</param>
/// <param name="AddressLine">Street address, or null.</param>
/// <param name="City">Town or city, or null.</param>
/// <param name="Country">Country, or null.</param>
/// <param name="ContactPhone">Telephone number, or null.</param>
/// <param name="ContactEmail">Email address, or null.</param>
/// <param name="Slug">
/// The restaurant's slug, so the page can reach its live menu, its ordering, its booking
/// form and its reviews - which are keyed by slug - whichever address it was opened on.
/// </param>
public sealed record PublicSiteResponse(
    string RestaurantName,
    string Design,
    JsonElement Content,
    string? AddressLine,
    string? City,
    string? Country,
    string? ContactPhone,
    string? ContactEmail,
    string Slug);

/// <summary>Saves the draft. Replaces it whole; there is no partial write.</summary>
public sealed class SaveSiteDraftRequest
{
    /// <summary>Which design the draft is built on.</summary>
    public string Design { get; set; } = string.Empty;

    /// <summary>The whole content record.</summary>
    [JsonPropertyName("content")]
    public JsonElement Content { get; set; }
}

/// <summary>Puts the page in front of the public, or takes it back down.</summary>
public sealed class SetSitePublishedRequest
{
    /// <summary>True to publish the current draft, false to withdraw the page.</summary>
    public bool IsPublished { get; set; }
}
