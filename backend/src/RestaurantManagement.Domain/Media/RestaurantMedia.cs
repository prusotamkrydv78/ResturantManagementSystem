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
    /// The largest thumbnail that will be accepted.
    ///
    /// Two hundred kilobytes is generous for a picture whose longest edge is
    /// <see cref="ThumbnailEdge"/>; the limit is here to stop the second file in an
    /// upload being used to smuggle a first-sized one past the check on the original.
    /// </summary>
    public const int ThumbnailMaxBytes = 256 * 1024;

    /// <summary>
    /// The longest edge a thumbnail should have.
    ///
    /// The editor draws these in a grid of squares about a hundred points across, so
    /// three hundred and twenty covers a dense screen with room to spare. It is not
    /// enforced - the bytes are not decoded here - it is what the browser is asked for.
    /// </summary>
    public const int ThumbnailEdge = 320;

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

    /// <summary>
    /// A small copy, for grids.
    ///
    /// WHY THE BROWSER MAKES IT AND NOT THIS SERVER
    ///
    /// A library of sixty four-megabyte photographs drawn as hundred-pixel squares was
    /// a quarter of a gigabyte of downloads to render a grid, and the editor draws that
    /// grid inside every photograph field as well as in the library tab. It needed a
    /// small copy.
    ///
    /// Resizing it here would mean an imaging library in the server, which this product
    /// does not have and which is a real dependency with a real licence for one
    /// downscale. The browser doing the upload has already decoded the picture in order
    /// to show it to the person choosing it, so it can produce the small copy for
    /// nothing and send both.
    ///
    /// Nullable, because that arrangement has to degrade. An upload that arrives without
    /// one - an older client, a browser where the canvas is unavailable, anything
    /// calling the API directly - is stored and served from the original. Slower, and
    /// correct.
    /// </summary>
    public byte[]? Thumbnail { get; set; }

    /// <summary>The media type of the thumbnail, if there is one.</summary>
    public string? ThumbnailContentType { get; set; }

    /// <summary>When it was uploaded.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }
}
