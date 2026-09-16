using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Media;

/// <summary>
/// One picture a restaurant has uploaded, held in a library rather than against a thing.
///
/// HOW THIS DIFFERS FROM THE OTHER IMAGE TABLES
///
/// <see cref="Menu.MenuItemImage"/>, <see cref="Inventory.InventoryItemImage"/> and the
/// rest are one row per owner: a dish has a photograph, and replacing it overwrites
/// that row. This is the other shape. A restaurant's website needs a hero, four dishes,
/// a gallery and a portrait of the kitchen, the same picture may appear in two of those
/// places at once, and none of them owns it. So the picture is the record, and whatever
/// uses it stores its URL.
///
/// That also means a row is immutable once written. A replacement is a new upload with
/// a new identifier, which is why there is no version stamp here: the other tables need
/// one because their URL outlives their bytes, and this one's does not.
///
/// The bytes live in the database, the same trade the rest of the product makes: the
/// application host has an ephemeral filesystem that a redeploy wipes. It is not free,
/// which is what the two limits below bound.
/// </summary>
public class RestaurantMedia
{
    /// <summary>
    /// The largest single picture.
    ///
    /// Larger than a menu photograph's two megabytes, because these are used
    /// full-bleed across a hero rather than in a card, and a hero cropped from two
    /// megabytes is visibly soft on a large screen.
    /// </summary>
    public const int MaxBytes = 4 * 1024 * 1024;

    /// <summary>
    /// How many one restaurant may hold.
    ///
    /// A ceiling rather than a quota anybody is meant to reach: four designs with a
    /// gallery each is perhaps thirty pictures, and sixty leaves room to keep last
    /// year's before deleting them. It exists so one restaurant cannot fill the
    /// database, and the editor shows the count so it is never met by surprise.
    /// </summary>
    public const int MaxPerRestaurant = 60;

    /// <summary>
    /// Where a picture is served from.
    ///
    /// Relative on purpose. The page is served from whatever host the restaurant is
    /// reached on, and an absolute URL baked in here would break the moment the
    /// platform moved or gained a subdomain.
    /// </summary>
    public static string UrlFor(Guid id) => $"/api/media/{id}";

    /// <summary>Primary key. Version 7, so the library sorts by when it was added.</summary>
    public Guid Id { get; set; }

    /// <summary>Which restaurant owns it.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>
    /// The media type served back.
    ///
    /// Stored from the checked whitelist rather than from what the browser claimed, so
    /// nothing here can be used to serve a document the browser would execute. These
    /// pictures are loaded by strangers on a public page, which is the case that
    /// matters.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// What the manager called it, cleaned up.
    ///
    /// Never used to open anything - the bytes are in a column - but it is the only
    /// way a person tells two photographs apart in a grid of thumbnails.
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a total need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When it was uploaded.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }
}
