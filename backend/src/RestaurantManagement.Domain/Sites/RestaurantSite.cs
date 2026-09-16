using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Sites;

/// <summary>
/// The public one-page website belonging to one restaurant.
///
/// One row per restaurant, enforced by the key being the restaurant itself. A
/// restaurant either has a page or does not; there is no second draft and no version
/// history, because a manager editing their own single page is not doing the kind of
/// work that needs branching.
///
/// A DRAFT AND A PUBLISHED COPY, WHICH THE LAST VERSION OF THIS DID NOT HAVE
///
/// The previous design kept one column of content and gated the public read on a
/// boolean. That quietly meant every save on a live page WAS a publish, while the
/// editor told the manager the opposite — somebody fixing a typo at four o'clock put a
/// half-written sentence in front of the public and was shown a banner saying visitors
/// could not see it yet.
///
/// So there are two columns. <see cref="DraftJson"/> is what the editor reads and
/// writes, continuously and without ceremony. <see cref="PublishedJson"/> is a copy
/// taken at the moment Publish is pressed, and it is the only thing a stranger ever
/// sees. Editing a live page is now safe, which is what a manager already believed.
///
/// The design is stored twice for the same reason. Moving a live page from one design
/// to another is an edit like any other, and the public should keep getting the old one
/// until it is published.
///
/// CONTENT IS OPAQUE HERE
///
/// Both columns hold JSON the server never looks inside. Which sections a page has is
/// a decision the templates own and change often; modelling them relationally would
/// mean a migration every time a design wanted a new field, for data no query ever
/// filters on. Nothing searches inside this — it is read whole, by restaurant or by
/// slug, and written whole.
/// </summary>
public class RestaurantSite
{
    /// <summary>
    /// The largest a page's content may be.
    ///
    /// A quarter of a megabyte is many times more prose than any of these designs can
    /// draw, and small enough that a bug in the editor cannot fill a column with an
    /// infinite structure. Pictures are not in here: a page stores the address of an
    /// image, and the bytes live in the media library.
    /// </summary>
    public const int MaxContentBytes = 256 * 1024;

    /// <summary>Primary key, and the foreign key. One page per restaurant, from the key.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>
    /// Which design the draft is built on, as the catalogue names it.
    ///
    /// A string rather than an enum, because the catalogue of designs lives with the
    /// templates that draw them and an enum here would be a second list to keep in
    /// step. The server never renders a page, so it has no reason to know which names
    /// are real; it stores what it is given and hands it back.
    /// </summary>
    public string Design { get; set; } = string.Empty;

    /// <summary>What the manager is working on. Read and written by the editor alone.</summary>
    public string DraftJson { get; set; } = "{}";

    /// <summary>
    /// The copy the public is served, or null if nothing has ever been published.
    ///
    /// Null and <see cref="IsPublished"/> are different states on purpose: a page taken
    /// offline keeps its published copy, so putting it back is one press rather than a
    /// republish of whatever the draft has become since.
    /// </summary>
    public string? PublishedJson { get; set; }

    /// <summary>The design as published, which may lag the draft's.</summary>
    public string? PublishedDesign { get; set; }

    /// <summary>
    /// Whether the page answers to the public.
    ///
    /// Unpublished is the initial state, so a site created the moment a restaurant is
    /// registered is not a half-filled page on the open internet under its name.
    /// </summary>
    public bool IsPublished { get; set; }

    /// <summary>When the record was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the draft last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>When the published copy was last taken, or null if never.</summary>
    public DateTimeOffset? PublishedAtUtc { get; set; }
}
