using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Sites;

/// <summary>
/// The public one-page website belonging to one restaurant.
///
/// One row per restaurant, enforced by a unique index on <see cref="RestaurantId"/>.
/// A restaurant either has a site or does not; there is no second draft and no
/// version history, because a manager editing their own single page is not doing
/// the kind of work that needs branching.
///
/// The content is kept as JSON in one column rather than spread across a table per
/// section. Sections are a presentation decision that the templates own, and
/// modelling them relationally would mean a migration every time a design wanted a
/// new field, for data no query ever filters on. Nothing in the product searches
/// inside this; it is read whole, by slug, and written whole.
/// </summary>
public class RestaurantSite
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this page belongs to. Unique.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>Which design the page is drawn with.</summary>
    public SiteTemplate Template { get; set; } = SiteTemplate.Aurora;

    /// <summary>
    /// The editable content, serialised.
    ///
    /// Held as text rather than as a typed graph so the shape can grow with the
    /// templates. The service is the only thing that reads it, and it parses into a
    /// record with defaults for everything, so a column written by an older build
    /// deserialises into the current shape instead of failing.
    /// </summary>
    public string ContentJson { get; set; } = "{}";

    /// <summary>
    /// Whether the page answers to the public.
    ///
    /// Unpublished is the initial state, so a site created the moment a restaurant is
    /// registered is not a half-filled page on the open internet under the
    /// restaurant's name. The manager decides when it is ready.
    /// </summary>
    public bool IsPublished { get; set; }

    /// <summary>When the record was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the content or the template last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// When it was last made public, or null if it never has been.
    ///
    /// Kept apart from <see cref="UpdatedAtUtc"/> so a manager can be shown whether
    /// what visitors see is what they last saved.
    /// </summary>
    public DateTimeOffset? PublishedAtUtc { get; set; }

    /// <summary>Images uploaded for use on this page.</summary>
    public ICollection<SiteImage> Images { get; } = [];
}
