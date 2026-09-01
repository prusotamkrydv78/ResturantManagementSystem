namespace RestaurantManagement.Domain.Menu;

/// <summary>
/// The photograph of one menu item.
///
/// This is the one picture in the product a paying guest actually sees: it appears on
/// the page they reach by scanning the code on their table, which is where a dish is
/// chosen. The inventory photograph exists so staff can match a tub to a name; this
/// one exists to sell food.
///
/// A table of its own rather than columns on <see cref="MenuItem"/>, for the same
/// reason the inventory picture is separate: an item row is loaded on paths that have
/// no interest in its bytes - pricing an order, listing a menu for the kitchen - and a
/// blob column would ride along on every one of them. Bytes in a separate table
/// cannot be loaded by accident.
///
/// The bytes live in the database rather than on disk or in an object store, the same
/// trade the rest of the product makes: the application host has an ephemeral
/// filesystem that a redeploy wipes. It is not free, which is what
/// <see cref="MenuItem.MaxImageBytes"/> bounds.
///
/// One row per item, enforced by the key. Replacing a picture overwrites this row, so
/// the item carries a timestamp that versions the URL - without it a replacement would
/// sit behind the cache of the picture it replaced.
/// </summary>
public class MenuItemImage
{
    /// <summary>
    /// Where an item's picture is served from, or null when it has none.
    ///
    /// Here rather than in a service because two of them need it - the manager's menu
    /// and the guest's - and a second copy would be a second chance for one of them to
    /// forget the version stamp. That stamp is the whole reason a replacement is ever
    /// seen: the response is cached for a year, so the URL has to move with the bytes.
    /// </summary>
    public static string? UrlFor(Guid menuItemId, DateTimeOffset? updatedAtUtc) =>
        updatedAtUtc is null
            ? null
            : $"/api/menu/items/{menuItemId}/image?v={updatedAtUtc.Value.UtcTicks}";

    /// <summary>
    /// Primary key, and the foreign key to the item. One picture per item falls out of
    /// the key rather than needing a rule.
    /// </summary>
    public Guid MenuItemId { get; set; }

    /// <summary>Navigation to the item this belongs to.</summary>
    public MenuItem MenuItem { get; set; } = null!;

    /// <summary>
    /// The restaurant, denormalised from the item.
    ///
    /// Carried so a request can be authorised without a join, and so a manager cannot
    /// reach another restaurant's picture by guessing an identifier.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>
    /// The media type served back.
    ///
    /// Stored from a checked whitelist rather than from what the browser claimed, so
    /// nothing here can be used to serve a document the browser would execute. That
    /// matters more here than anywhere else in the product: this is the only image a
    /// stranger's phone loads.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a count need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When these bytes were stored.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
