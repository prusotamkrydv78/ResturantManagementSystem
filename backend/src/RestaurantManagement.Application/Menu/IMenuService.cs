using RestaurantManagement.Application.Menu.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Menu;

/// <summary>
/// Menu administration for a restaurant manager, covering both categories and
/// items.
///
/// Kept as one service because the two are a single cohesive module and share the
/// same restaurant resolution: splitting them would duplicate that logic for no
/// gain. Two thin controllers sit on top so the routes stay conventional.
///
/// Follows the isolation approach used for staff and tables: every method takes the
/// authenticated manager identifier and derives their restaurant from it. No method
/// accepts a restaurant identifier, and identifiers from another restaurant do not
/// resolve.
/// </summary>
public interface IMenuService
{
    /* ---- Categories ---- */

    /// <summary>Lists the categories of the caller restaurant, in menu order.</summary>
    Task<Result<IReadOnlyList<MenuCategoryResponse>>> GetCategoriesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>Loads one category.</summary>
    Task<Result<MenuCategoryResponse>> GetCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        CancellationToken cancellationToken);

    /// <summary>Adds a category to the caller restaurant.</summary>
    Task<Result<MenuCategoryResponse>> CreateCategoryAsync(
        Guid managerUserId,
        CreateMenuCategoryRequest request,
        CancellationToken cancellationToken);

    /// <summary>Updates a category name, description and position.</summary>
    Task<Result<MenuCategoryResponse>> UpdateCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        UpdateMenuCategoryRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Puts a category on or off the menu. Its items are left exactly as they are:
    /// nothing is deleted and no relationship is detached.
    /// </summary>
    Task<Result<MenuCategoryResponse>> SetCategoryActiveAsync(
        Guid managerUserId,
        Guid categoryId,
        bool isActive,
        CancellationToken cancellationToken);

    /* ---- Items ---- */

    /// <summary>
    /// Lists the items of the caller restaurant, optionally narrowed by a name
    /// fragment and by category.
    /// </summary>
    Task<Result<IReadOnlyList<MenuItemResponse>>> GetItemsAsync(
        Guid managerUserId,
        string? search,
        Guid? categoryId,
        CancellationToken cancellationToken);

    /// <summary>Loads one item.</summary>
    Task<Result<MenuItemResponse>> GetItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>Adds an item to one of the caller own categories.</summary>
    Task<Result<MenuItemResponse>> CreateItemAsync(
        Guid managerUserId,
        CreateMenuItemRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates an item, including moving it between the caller own categories.
    /// </summary>
    Task<Result<MenuItemResponse>> UpdateItemAsync(
        Guid managerUserId,
        Guid itemId,
        UpdateMenuItemRequest request,
        CancellationToken cancellationToken);

    /// <summary>Puts an item on or off the menu.</summary>
    Task<Result<MenuItemResponse>> SetItemActiveAsync(
        Guid managerUserId,
        Guid itemId,
        bool isActive,
        CancellationToken cancellationToken);

    /// <summary>
    /// Creates several items in one category at once.
    ///
    /// Building a menu is the longest job in setting a restaurant up, and doing it a
    /// dish at a time is what makes it long. The whole batch is one transaction: a
    /// duplicate or a bad price rejects the lot and names the row, rather than leaving
    /// half a course entered and the manager guessing where they got to.
    /// </summary>
    Task<Result<IReadOnlyList<MenuItemResponse>>> CreateItemsAsync(
        Guid managerUserId,
        CreateMenuItemsRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Sets the order categories appear in, from a list of identifiers.
    ///
    /// Position is a property of the whole menu, not of one category: swapping two of
    /// them by editing numbers one at a time passes through states where both hold the
    /// same value. Sending the full order makes it one decision.
    /// </summary>
    Task<Result<IReadOnlyList<MenuCategoryResponse>>> ReorderCategoriesAsync(
        Guid managerUserId,
        ReorderCategoriesRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes an item added by mistake.
    ///
    /// Refused once it has been ordered. Its recipe lines go with it, because a recipe
    /// cannot mean anything without the dish.
    /// </summary>
    Task<Result<bool>> DeleteItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes an empty category.
    ///
    /// Refused while it still holds items. Items cascade from their category in the
    /// schema, so allowing it would delete dishes - possibly sold ones - as a side
    /// effect of tidying the menu.
    /// </summary>
    Task<Result<bool>> DeleteCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        CancellationToken cancellationToken);
}
