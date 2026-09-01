using RestaurantManagement.Application.Inventory.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Inventory;

/// <summary>
/// The shelves, and what has moved on them.
///
/// Every method takes the authenticated manager and derives the restaurant from them,
/// the same way every other manager module does. No method accepts a restaurant
/// identifier.
///
/// Stock only ever changes through here, and never without a movement recording why.
/// The balance and the ledger are written in the same transaction, so a figure that
/// nothing explains cannot exist.
/// </summary>
public interface IInventoryService
{
    /// <summary>
    /// The shelves, with the counts that decide what needs attention.
    ///
    /// The counts cover every item rather than the filtered set, so a warning cannot be
    /// hidden by narrowing the list.
    /// </summary>
    Task<Result<InventoryOverviewResponse>> GetItemsAsync(
        Guid managerUserId,
        bool includeArchived,
        CancellationToken cancellationToken);

    /// <summary>One item with its history, newest first.</summary>
    Task<Result<InventoryItemDetailResponse>> GetItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Adds an item to the shelves.
    ///
    /// Any opening quantity is written as a movement of its own, so a balance never
    /// exists without something in the ledger accounting for it.
    /// </summary>
    Task<Result<InventoryItemResponse>> CreateItemAsync(
        Guid managerUserId,
        CreateInventoryItemRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Renames an item or changes its reorder level.
    ///
    /// Deliberately cannot change the unit or the stock figure. The unit would
    /// reinterpret every quantity already recorded, and the figure has to move through a
    /// movement so the ledger keeps adding up.
    /// </summary>
    Task<Result<InventoryItemResponse>> UpdateItemAsync(
        Guid managerUserId,
        Guid itemId,
        UpdateInventoryItemRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Archives or restores an item.
    ///
    /// Archiving is what takes something out of use. It stays in the database with its
    /// history, and any recipe still naming it keeps deducting it, because the food is
    /// still being made.
    /// </summary>
    Task<Result<InventoryItemResponse>> SetItemActiveAsync(
        Guid managerUserId,
        Guid itemId,
        SetInventoryItemActiveRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes an item outright.
    ///
    /// Only possible while it has no history and no recipe naming it, which in practice
    /// means it was added by mistake. Anything else is archived, because a movement
    /// pointing at a row nobody can look up would make the ledger unreadable.
    /// </summary>
    Task<Result<bool>> DeleteItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Moves stock by hand: a delivery, a correction, or something thrown away.
    ///
    /// Consumption cannot be entered here. It is written by the kitchen being told to
    /// cook, and a second route would let the same food be deducted twice.
    /// </summary>
    Task<Result<InventoryItemDetailResponse>> RecordMovementAsync(
        Guid managerUserId,
        Guid itemId,
        RecordStockMovementRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Puts a photograph on an item, replacing any it already had.
    ///
    /// Entirely optional: nothing in the product reads it except the screens that
    /// show it back. It exists because a shelf of identical white tubs is easier to
    /// match against a list with pictures on it.
    /// </summary>
    Task<Result<InventoryItemResponse>> SetItemImageAsync(
        Guid managerUserId,
        Guid itemId,
        string fileName,
        string contentType,
        Stream content,
        long length,
        CancellationToken cancellationToken);

    /// <summary>Takes the photograph off an item.</summary>
    Task<Result<InventoryItemResponse>> RemoveItemImageAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The bytes of an item's photograph.
    ///
    /// Takes no caller, because an image tag cannot send an access token and the
    /// endpoint serving this is therefore open. What it protects is the identifier:
    /// a random key names the picture, and nothing about a photograph of an onion is
    /// worth more protection than that.
    /// </summary>
    Task<Result<(byte[] Content, string ContentType)>> GetItemImageBytesAsync(
        Guid itemId,
        CancellationToken cancellationToken);

    /* ------------------------------------------------------------------- Recipes */

    /// <summary>
    /// What a menu item is made from, with how many could be made from what is on the
    /// shelves.
    /// </summary>
    Task<Result<RecipeResponse>> GetRecipeAsync(
        Guid managerUserId,
        Guid menuItemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Saves a whole recipe, replacing whatever it was.
    ///
    /// The submitted lines become the recipe and anything left out is removed, so an
    /// editor is one save rather than a sequence that could fail half way. An empty list
    /// is valid and means the item consumes nothing.
    /// </summary>
    Task<Result<RecipeResponse>> SaveRecipeAsync(
        Guid managerUserId,
        Guid menuItemId,
        SaveRecipeRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Which menu items have a recipe, for showing on the menu screen without a request
    /// per row.
    /// </summary>
    Task<Result<IReadOnlyList<RecipeSummaryResponse>>> GetRecipeSummariesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);
}
