namespace RestaurantManagement.Domain.Menu;

/// <summary>
/// Something a restaurant sells, sitting in one category.
///
/// <see cref="RestaurantId"/> is stored alongside <see cref="CategoryId"/> so items
/// can be listed for a restaurant without joining. The pair is bound to the
/// category by a composite foreign key, so an item can never point at a category
/// belonging to a different restaurant: that combination simply does not exist to
/// reference.
///
/// Deliberately plain. No variants, sizes, modifiers, combos, tax or discounts, and
/// nothing order-related: an order keeps its own snapshot of the name and price
/// rather than depending on this record staying unchanged.
///
/// It may carry one optional photograph, which is the only picture in the product a
/// paying guest sees - it appears on the page they reach by scanning their table. What
/// it is made from is a separate record again, so a recipe can change without
/// disturbing the menu.
/// </summary>
public class MenuItem
{
    /// <summary>Largest photograph accepted, in bytes.</summary>
    public const int MaxImageBytes = 2 * 1024 * 1024;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this item belongs to.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The category this item sits in.</summary>
    public Guid CategoryId { get; set; }

    /// <summary>Navigation to the owning category.</summary>
    public MenuCategory Category { get; set; } = null!;

    /// <summary>Display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description shown to guests later.</summary>
    public string? Description { get; set; }

    /// <summary>
    /// Price in the restaurant currency, held as a decimal so money is never
    /// subject to binary floating-point rounding.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// Whether the item itself is on the menu. Whether it can actually be ordered
    /// also depends on its category being active; that is derived, not stored.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// When this item's photograph was last set, or null when it has none.
    ///
    /// Two jobs, which is why the bytes are not beside it. It says whether a picture
    /// exists, so listing a menu - for a manager or for a guest's phone - never
    /// touches the image table; and it is the cache version, because the bytes behind
    /// an item's image URL do change when a manager replaces the picture. The URL
    /// carries this stamp and the response is then cached hard against it, so a new
    /// photograph is seen immediately rather than hiding behind a year-long cache.
    ///
    /// Denormalised from <see cref="Image"/> and written in the same transaction as
    /// it. That pair is the one thing here that could fall out of step, which is why
    /// nothing but the image service writes either half.
    /// </summary>
    public DateTimeOffset? ImageUpdatedAtUtc { get; set; }

    /// <summary>
    /// The photograph itself, in a table of its own.
    ///
    /// Not columns on this row: an item is loaded on paths with no interest in its
    /// bytes - pricing an order, sending a ticket to the kitchen - and a blob column
    /// would ride along on all of them. A separate table arrives only when something
    /// asks for it by name.
    /// </summary>
    public MenuItemImage? Image { get; set; }

    /// <summary>When the item was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the item was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
