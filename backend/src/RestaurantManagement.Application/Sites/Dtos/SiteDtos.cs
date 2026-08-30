using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Sites;

namespace RestaurantManagement.Application.Sites.Dtos;

/// <summary>
/// The manager's view of their page: the content, the design, and whether the
/// public can see it.
/// </summary>
/// <param name="Template">The design in use.</param>
/// <param name="Content">Everything editable.</param>
/// <param name="IsPublished">Whether visitors can reach it.</param>
/// <param name="Slug">
/// The restaurant slug the page answers to. Read-only here: it is a platform
/// identifier that guest ordering links are also built from, so only a Super Admin
/// changes it.
/// </param>
/// <param name="UpdatedAtUtc">When the content last changed.</param>
/// <param name="PublishedAtUtc">When it was last made public, if ever.</param>
/// <param name="HasUnpublishedChanges">
/// Whether the page has been edited since it was last published. Answers the one
/// question a manager actually has after saving: is this live?
/// </param>
public sealed record SiteResponse(
    SiteTemplate Template,
    SiteContent Content,
    bool IsPublished,
    string Slug,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? PublishedAtUtc,
    bool HasUnpublishedChanges);

/// <summary>
/// What a visitor is served. Carries no timestamps, no publication state and no
/// identifiers: an unpublished page is a 404, so there is nothing here to leak.
/// </summary>
/// <param name="RestaurantName">The registered name, for the document title.</param>
/// <param name="Template">Which design to draw.</param>
/// <param name="Content">The page itself.</param>
public sealed record PublicSiteResponse(
    string RestaurantName,
    SiteTemplate Template,
    SiteContent Content);

/// <summary>
/// Saves the page.
///
/// The whole content every time rather than a patch per section. A manager saves a
/// form, not a field, and a partial update would have to invent a way to say "this
/// list is now empty" that an absent property cannot express.
/// </summary>
public sealed class SaveSiteRequest
{
    /// <summary>The design to draw it with.</summary>
    [Required]
    public SiteTemplate Template { get; set; }

    /// <summary>Everything editable. Required, but every field inside it may be blank.</summary>
    [Required(ErrorMessage = "The page content is missing.")]
    public SiteContent Content { get; set; } = SiteContent.Empty();
}

/// <summary>Puts the page in front of the public, or takes it back down.</summary>
public sealed class SetSitePublishedRequest
{
    /// <summary>True to publish, false to withdraw.</summary>
    [Required]
    public bool IsPublished { get; set; }
}

/// <summary>One uploaded image, as the picker lists it.</summary>
/// <param name="Id">Identifier, and the last segment of its URL.</param>
/// <param name="Url">Where the page references it. Relative, so it survives a move.</param>
/// <param name="FileName">What it was called when it was uploaded.</param>
/// <param name="ByteCount">Its size.</param>
/// <param name="CreatedAtUtc">When it was uploaded.</param>
public sealed record SiteImageResponse(
    Guid Id,
    string Url,
    string FileName,
    int ByteCount,
    DateTimeOffset CreatedAtUtc);

/// <summary>What one template offers, for the design picker.</summary>
/// <param name="Template">The value to save.</param>
/// <param name="Name">What it is called.</param>
/// <param name="Description">Who it suits.</param>
public sealed record SiteTemplateResponse(
    SiteTemplate Template,
    string Name,
    string Description);
