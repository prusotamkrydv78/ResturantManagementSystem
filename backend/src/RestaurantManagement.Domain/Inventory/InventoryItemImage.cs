namespace RestaurantManagement.Domain.Inventory;

/// <summary>
/// The photograph of one inventory item.
///
/// A table of its own rather than three columns on the item, for one reason that
/// matters more than tidiness: sending an order to the kitchen loads the inventory
/// item behind every ingredient of every dish on the order, and a blob column would
/// have pulled all of those photographs across the wire in the middle of service.
/// Bytes in a separate table cannot be loaded by accident - nothing arrives unless
/// it is asked for by name.
///
/// The bytes live in the database rather than on disk or in an object store, the
/// same trade the website's picture library makes: the application host has an
/// ephemeral filesystem that a redeploy wipes, and an object store would mean an
/// account, a key and a bill. It is not free, so the size limit on
/// <see cref="InventoryItem.MaxImageBytes"/> is what keeps it bounded.
///
/// One row per item, enforced by the key. Replacing a picture overwrites this row
/// rather than adding another, which is why the item carries a timestamp used to
/// version the URL - without it a replacement would sit behind the cache of the
/// picture it replaced.
/// </summary>
public class InventoryItemImage
{
    /// <summary>
    /// Primary key, and the foreign key to the item. One picture per item falls out
    /// of the key rather than needing a rule.
    /// </summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>Navigation to the item this belongs to.</summary>
    public InventoryItem InventoryItem { get; set; } = null!;

    /// <summary>
    /// The restaurant, denormalised from the item.
    ///
    /// Carried so the bytes can be authorised and counted without a join, and so a
    /// manager cannot reach another restaurant's picture by guessing an identifier.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>
    /// The media type served back.
    ///
    /// Stored from a checked whitelist rather than from what the browser claimed, so
    /// nothing here can be used to serve a document the browser would execute.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a count need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When these bytes were stored.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
