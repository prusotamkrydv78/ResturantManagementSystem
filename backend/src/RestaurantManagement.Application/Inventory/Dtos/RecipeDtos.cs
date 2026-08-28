using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Inventory;

namespace RestaurantManagement.Application.Inventory.Dtos;

/// <summary>
/// One ingredient a menu item is made from.
///
/// Carries the quantity in the recipe own unit and again in the unit the ingredient is
/// stocked in, so a manager can see both what they wrote and what it will actually take
/// off the shelf.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="InventoryItemId">The ingredient.</param>
/// <param name="InventoryItemName">What the kitchen calls it.</param>
/// <param name="Quantity">How much, per one of the menu item.</param>
/// <param name="Unit">The unit that quantity is written in.</param>
/// <param name="StockUnit">The unit the ingredient is stocked in.</param>
/// <param name="QuantityInStockUnit">The same amount, in the stock unit.</param>
/// <param name="QuantityInStock">How much of it is on the shelf.</param>
/// <param name="IsInventoryItemActive">
/// Whether the ingredient is still in use. An archived ingredient still deducts, so a
/// recipe pointing at one is worth showing rather than hiding.
/// </param>
/// <param name="PortionsAvailable">
/// How many of the menu item this one ingredient could cover, floored. Null when the
/// ingredient is out of stock or the figure is meaningless.
/// </param>
public sealed record RecipeLineResponse(
    Guid Id,
    Guid InventoryItemId,
    string InventoryItemName,
    decimal Quantity,
    UnitOfMeasure Unit,
    UnitOfMeasure StockUnit,
    decimal QuantityInStockUnit,
    decimal QuantityInStock,
    bool IsInventoryItemActive,
    int? PortionsAvailable);

/// <summary>
/// What a menu item is made from.
///
/// A menu item with no lines has no recipe, which is a legitimate state rather than a
/// missing one: a bottled drink is sold as it comes and consumes nothing that needs
/// tracking. Nothing is deducted for such an item, and nothing warns about it.
/// </summary>
/// <param name="MenuItemId">The menu item.</param>
/// <param name="MenuItemName">What it is called.</param>
/// <param name="Lines">Its ingredients.</param>
/// <param name="PortionsAvailable">
/// How many could be made from what is on the shelves, decided by the scarcest
/// ingredient. Null when the item has no recipe, since then nothing limits it.
/// </param>
/// <param name="HasShortage">
/// Whether any ingredient is already out of stock. Sending such an item to the kitchen
/// still works and still deducts; this is a warning, not a block.
/// </param>
public sealed record RecipeResponse(
    Guid MenuItemId,
    string MenuItemName,
    IReadOnlyList<RecipeLineResponse> Lines,
    int? PortionsAvailable,
    bool HasShortage);

/// <summary>One line of a recipe being saved.</summary>
public sealed class RecipeLineRequest
{
    /// <summary>The ingredient. Must be one of the caller own inventory items.</summary>
    [Required(ErrorMessage = "Choose an ingredient.")]
    public Guid InventoryItemId { get; set; }

    /// <summary>How much is needed for one of the menu item.</summary>
    [Range(
        InventoryLimits.MinPositiveQuantity,
        InventoryLimits.MaxQuantity,
        ErrorMessage = "Enter a quantity greater than zero.")]
    public decimal Quantity { get; set; }

    /// <summary>
    /// The unit that quantity is written in. Must measure the same kind of thing as the
    /// unit the ingredient is stocked in, so the two can be converted exactly.
    /// </summary>
    [Required(ErrorMessage = "Choose a unit.")]
    [EnumDataType(typeof(UnitOfMeasure), ErrorMessage = "Choose a valid unit.")]
    public UnitOfMeasure Unit { get; set; }
}

/// <summary>
/// Payload for saving a recipe.
///
/// The whole recipe, not a change to it: the submitted lines become the recipe, and
/// anything left out is removed. That makes an editor a single save rather than a
/// sequence of adds and deletes that could fail half way and leave a recipe nobody
/// intended.
///
/// An empty list is a valid recipe. It means the item consumes nothing.
/// </summary>
public sealed class SaveRecipeRequest
{
    /// <summary>The ingredients this item is made from.</summary>
    public List<RecipeLineRequest> Lines { get; set; } = [];
}

/// <summary>
/// Whether a menu item has a recipe, and how many of it could be made.
///
/// Enough for the menu screen to show which items are tracked and which are not,
/// without asking for a full recipe per row.
/// </summary>
/// <param name="MenuItemId">The menu item.</param>
/// <param name="IngredientCount">How many ingredients it lists.</param>
/// <param name="PortionsAvailable">
/// How many could be made from what is on the shelves, decided by the scarcest
/// ingredient. Null when there is no recipe, since then nothing limits it.
/// </param>
/// <param name="HasShortage">Whether any ingredient is already out of stock.</param>
public sealed record RecipeSummaryResponse(
    Guid MenuItemId,
    int IngredientCount,
    int? PortionsAvailable,
    bool HasShortage);
