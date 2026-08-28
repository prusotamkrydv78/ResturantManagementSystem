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
/// Deliberately plain. No variants, sizes, modifiers, combos, tax, discounts,
/// images or inventory links, and nothing order-related: a future order will keep
/// its own snapshot of the name and price rather than depending on this record
/// staying unchanged.
/// </summary>
public class MenuItem
{
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

    /// <summary>When the item was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the item was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
