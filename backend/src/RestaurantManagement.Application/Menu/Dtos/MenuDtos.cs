using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Menu.Dtos;

/// <summary>Bounds for a menu item price.</summary>
public static class MenuLimits
{
    /// <summary>
    /// Zero is allowed on purpose: complimentary items such as table water still
    /// belong on a menu.
    /// </summary>
    public const double MinPrice = 0;

    /// <summary>A sanity ceiling, not a business rule.</summary>
    public const double MaxPrice = 999999.99;
}

/// <summary>
/// A menu category, as returned to its restaurant manager.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional note.</param>
/// <param name="DisplayOrder">Where the category sits on the menu.</param>
/// <param name="IsActive">Whether the category is on the menu.</param>
/// <param name="ItemCount">How many items it holds, including inactive ones.</param>
/// <param name="ActiveItemCount">
/// How many of those items are themselves active. Shown so a manager can see what
/// turning the category off would take off the menu.
/// </param>
/// <param name="CreatedAtUtc">When it was created.</param>
/// <param name="UpdatedAtUtc">When it was last changed.</param>
public sealed record MenuCategoryResponse(
    Guid Id,
    string Name,
    string? Description,
    int DisplayOrder,
    bool IsActive,
    int ItemCount,
    int ActiveItemCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>
/// A menu item, as returned to its restaurant manager.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional description.</param>
/// <param name="Price">Price, as an exact decimal.</param>
/// <param name="CategoryId">The category it sits in.</param>
/// <param name="CategoryName">Name of that category.</param>
/// <param name="IsActive">Whether the item itself is on the menu.</param>
/// <param name="IsCategoryActive">Whether its category is on the menu.</param>
/// <param name="IsAvailable">
/// Whether the item would actually be orderable, which needs both the item and its
/// category to be active. Derived rather than stored, so the two can never fall out
/// of step, and so ordering can rely on it later without new columns.
/// </param>
/// <param name="CreatedAtUtc">When it was created.</param>
/// <param name="UpdatedAtUtc">When it was last changed.</param>
public sealed record MenuItemResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    Guid CategoryId,
    string CategoryName,
    bool IsActive,
    bool IsCategoryActive,
    bool IsAvailable,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>
/// Payload for adding a category. There is no restaurant field: it is placed in the
/// restaurant of the authenticated manager.
/// </summary>
public sealed class CreateMenuCategoryRequest
{
    /// <summary>Display name, unique within the restaurant.</summary>
    [Required(ErrorMessage = "Enter a category name.")]
    [StringLength(
        80,
        MinimumLength = 1,
        ErrorMessage = "The category name cannot be longer than 80 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional note about what belongs here.</summary>
    [StringLength(400, ErrorMessage = "The description cannot be longer than 400 characters.")]
    public string? Description { get; set; }

    /// <summary>
    /// Where it sits on the menu. Left empty, it goes after the existing
    /// categories, so a manager never has to think about numbering.
    /// </summary>
    [Range(0, 9999, ErrorMessage = "Display order must be between 0 and 9999.")]
    public int? DisplayOrder { get; set; }
}

/// <summary>Payload for editing a category. Active state has its own endpoint.</summary>
public sealed class UpdateMenuCategoryRequest
{
    /// <summary>Display name, unique within the restaurant.</summary>
    [Required(ErrorMessage = "Enter a category name.")]
    [StringLength(
        80,
        MinimumLength = 1,
        ErrorMessage = "The category name cannot be longer than 80 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional note about what belongs here.</summary>
    [StringLength(400, ErrorMessage = "The description cannot be longer than 400 characters.")]
    public string? Description { get; set; }

    /// <summary>Where it sits on the menu.</summary>
    [Range(0, 9999, ErrorMessage = "Display order must be between 0 and 9999.")]
    public int DisplayOrder { get; set; }
}

/// <summary>
/// Payload for adding a menu item. There is no restaurant field; the category must
/// be one of the caller own categories, which the server checks.
/// </summary>
public sealed class CreateMenuItemRequest
{
    /// <summary>Display name.</summary>
    [Required(ErrorMessage = "Enter an item name.")]
    [StringLength(
        120,
        MinimumLength = 1,
        ErrorMessage = "The item name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description.</summary>
    [StringLength(600, ErrorMessage = "The description cannot be longer than 600 characters.")]
    public string? Description { get; set; }

    /// <summary>Price, as an exact decimal.</summary>
    [Range(
        MenuLimits.MinPrice,
        MenuLimits.MaxPrice,
        ErrorMessage = "Enter a price of zero or more.")]
    public decimal Price { get; set; }

    /// <summary>The category this item belongs in.</summary>
    [Required(ErrorMessage = "Choose a category.")]
    public Guid CategoryId { get; set; }
}

/// <summary>Payload for editing a menu item. Active state has its own endpoint.</summary>
public sealed class UpdateMenuItemRequest
{
    /// <summary>Display name.</summary>
    [Required(ErrorMessage = "Enter an item name.")]
    [StringLength(
        120,
        MinimumLength = 1,
        ErrorMessage = "The item name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description.</summary>
    [StringLength(600, ErrorMessage = "The description cannot be longer than 600 characters.")]
    public string? Description { get; set; }

    /// <summary>Price, as an exact decimal.</summary>
    [Range(
        MenuLimits.MinPrice,
        MenuLimits.MaxPrice,
        ErrorMessage = "Enter a price of zero or more.")]
    public decimal Price { get; set; }

    /// <summary>
    /// The category this item belongs in. May move the item between the caller own
    /// categories, never to another restaurant.
    /// </summary>
    [Required(ErrorMessage = "Choose a category.")]
    public Guid CategoryId { get; set; }
}

/// <summary>Payload for putting a category or item on or off the menu.</summary>
public sealed class SetMenuActiveRequest
{
    /// <summary>True to show on the menu, false to withdraw it.</summary>
    [Required]
    public bool IsActive { get; set; }
}

/// <summary>
/// One line of a bulk item creation. Same rules as creating a single item, minus the
/// category, which is chosen once for the whole batch.
/// </summary>
public sealed class MenuItemLineRequest
{
    /// <summary>What the dish is called.</summary>
    [Required(ErrorMessage = "Enter an item name.")]
    [StringLength(
        120,
        MinimumLength = 1,
        ErrorMessage = "The item name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description shown to staff and guests.</summary>
    [StringLength(600, ErrorMessage = "The description cannot be longer than 600 characters.")]
    public string? Description { get; set; }

    /// <summary>What it sells for.</summary>
    [Range(
        MenuLimits.MinPrice,
        MenuLimits.MaxPrice,
        ErrorMessage = "Enter a price of zero or more.")]
    public decimal Price { get; set; }
}

/// <summary>
/// Creates several items in one category at once.
///
/// Entering a real menu one dish at a time is the longest part of setting a restaurant
/// up. The batch is capped rather than unbounded: a request large enough to matter is
/// a paste of the wrong thing, and the cap says so instead of timing out.
/// </summary>
public sealed class CreateMenuItemsRequest
{
    /// <summary>The largest batch one request will take.</summary>
    public const int MaxItems = 100;

    /// <summary>The category every item in this batch belongs to.</summary>
    [Required(ErrorMessage = "Choose a category.")]
    public Guid CategoryId { get; set; }

    /// <summary>The items to create. Names must not repeat within the batch.</summary>
    [Required(ErrorMessage = "Add at least one item.")]
    [MinLength(1, ErrorMessage = "Add at least one item.")]
    [MaxLength(MaxItems, ErrorMessage = "That is more than 100 items in one go.")]
    public List<MenuItemLineRequest> Items { get; set; } = [];
}

/// <summary>
/// Sets the order categories appear in.
///
/// The list is the whole order, not a patch: position only means anything relative to
/// the other categories, so sending them one at a time would pass through states where
/// two share a place.
/// </summary>
public sealed class ReorderCategoriesRequest
{
    /// <summary>Every category of the restaurant, in the order they should appear.</summary>
    [Required(ErrorMessage = "Send the categories in their new order.")]
    [MinLength(1, ErrorMessage = "Send the categories in their new order.")]
    public List<Guid> CategoryIds { get; set; } = [];
}
