namespace RestaurantManagement.Domain.Sites;

/// <summary>
/// One photograph a manager uploaded for their page.
///
/// The bytes live in the database rather than on disk or in an object store. That is
/// a deliberate trade for where this runs: the application host has an ephemeral
/// filesystem that a redeploy wipes, and an object store would mean an account, a
/// key and a bill for something a restaurant uses a dozen times. The database is the
/// one piece of storage this product already has that survives a deployment.
///
/// It is not free. These rows are large next to everything else in the schema, they
/// are served through the application rather than a CDN, and every read costs a
/// round trip to a remote database. The limits in
/// <see cref="SiteImageLimits"/> exist to keep that bounded, and the response is
/// cached hard by the browser because the bytes behind an identifier never change:
/// a replacement is a new row with a new identifier, never an edit to this one.
/// </summary>
public class SiteImage
{
    /// <summary>Primary key. Also the public URL segment the page is served from.</summary>
    public Guid Id { get; set; }

    /// <summary>The site these bytes belong to.</summary>
    public Guid RestaurantSiteId { get; set; }

    /// <summary>Navigation to the owning site.</summary>
    public RestaurantSite RestaurantSite { get; set; } = null!;

    /// <summary>
    /// The restaurant, denormalised from the site.
    ///
    /// Carried here so an upload can be counted and authorised without loading the
    /// site, and so a manager can never reach another restaurant's bytes by
    /// guessing an identifier.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The name the file had on the manager's machine, for the picker.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// The media type served back.
    ///
    /// Stored from a checked whitelist rather than from what the browser claimed, so
    /// nothing here can be used to serve a document the browser would execute.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a listing need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When it was uploaded.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }
}

/// <summary>
/// What an upload has to stay inside.
///
/// Here rather than in the service because the same numbers are quoted back to the
/// manager in a refusal, and a limit the message disagrees with is worse than no
/// message.
/// </summary>
public static class SiteImageLimits
{
    /// <summary>The largest single upload, in bytes.</summary>
    public const int MaxBytes = 3 * 1024 * 1024;

    /// <summary>How many images one restaurant may keep.</summary>
    public const int MaxPerRestaurant = 30;

    /// <summary>
    /// The media types accepted, and the extension each is stored under.
    ///
    /// A whitelist, so anything not named here is refused rather than being trusted
    /// because it looked plausible. SVG is deliberately absent: it is a document
    /// that can carry script, and it would be served from the same origin as the
    /// page.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["image/avif"] = ".avif",
        };
}
