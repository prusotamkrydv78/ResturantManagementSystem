using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Menu;

/// <summary>
/// A grouping on a restaurant menu, such as Starters or Drinks.
///
/// Belongs directly to one restaurant. There is no separate Menu entity: a
/// restaurant has categories, and categories have items, which is all this version
/// needs.
/// </summary>
public class MenuCategory
{
    /// <summary>Largest photograph accepted, in bytes.</summary>
    public const int MaxImageBytes = 2 * 1024 * 1024;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this category belongs to.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>Display name, unique within the restaurant.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional note about what belongs in this category.</summary>
    public string? Description { get; set; }

    /// <summary>
    /// When this section's photograph was last set, or null when it has none.
    ///
    /// Says whether a picture exists, so listing a menu never touches the image
    /// table, and doubles as the cache version in the URL. Denormalised from
    /// <see cref="Image"/> and written in the same transaction as it.
    /// </summary>
    public DateTimeOffset? ImageUpdatedAtUtc { get; set; }

    /// <summary>
    /// The photograph heading this section, in a table of its own so it is never
    /// loaded by a query that only wanted the name.
    /// </summary>
    public MenuCategoryImage? Image { get; set; }

    /// <summary>
    /// Where this category sits on the menu. A menu has a natural order, so it is
    /// stored rather than inferred from the name.
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Whether the category is on the menu. Turning it off never changes its items:
    /// they keep their category, and whether an item can be ordered is derived from
    /// both flags together.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When the category was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the category was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>The items in this category.</summary>
    public ICollection<MenuItem> Items { get; } = [];
}
