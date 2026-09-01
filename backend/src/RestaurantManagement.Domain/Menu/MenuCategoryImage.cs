namespace RestaurantManagement.Domain.Menu;

/// <summary>
/// The photograph heading one section of the menu.
///
/// A different job from the picture on a dish. That one sells a plate of food; this
/// one gives a section a face - a bar shot over Drinks, a dessert trolley over
/// Puddings - so a guest scrolling on a phone can tell where they are without reading
/// every heading.
///
/// A table of its own rather than columns on <see cref="MenuCategory"/>, for the same
/// reason as everywhere else in this product: a category is loaded on paths with no
/// interest in its bytes, and a blob column would ride along on every one of them.
///
/// The bytes live in the database, the same trade the rest of the product makes: the
/// application host has an ephemeral filesystem that a redeploy wipes. It is not
/// free, which is what <see cref="MenuCategory.MaxImageBytes"/> bounds.
///
/// One row per category, enforced by the key. Replacing overwrites this row, so the
/// category carries a timestamp that versions the URL - without it a replacement
/// would sit behind the cache of the picture it replaced.
/// </summary>
public class MenuCategoryImage
{
    /// <summary>
    /// Where a section's picture is served from, or null when it has none.
    ///
    /// Here rather than in a service because two of them need it - the manager's menu
    /// and the guest's - and a second copy would be a second chance for one of them to
    /// forget the version stamp.
    /// </summary>
    public static string? UrlFor(Guid categoryId, DateTimeOffset? updatedAtUtc) =>
        updatedAtUtc is null
            ? null
            : $"/api/menu/categories/{categoryId}/image?v={updatedAtUtc.Value.UtcTicks}";

    /// <summary>
    /// Primary key, and the foreign key to the category. One picture per section
    /// falls out of the key rather than needing a rule.
    /// </summary>
    public Guid MenuCategoryId { get; set; }

    /// <summary>Navigation to the category this belongs to.</summary>
    public MenuCategory MenuCategory { get; set; } = null!;

    /// <summary>
    /// The restaurant, denormalised from the category, so a request can be authorised
    /// without a join.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>
    /// The media type served back, from a checked whitelist rather than from what the
    /// browser claimed. This is served to a stranger's phone, so it matters.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a count need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When these bytes were stored.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
