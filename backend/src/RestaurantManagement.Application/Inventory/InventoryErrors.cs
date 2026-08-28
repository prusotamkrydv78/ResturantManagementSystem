using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Inventory;

/// <summary>Failures the inventory module can report.</summary>
public static class InventoryErrors
{
    /// <summary>The caller manages no restaurant, so there are no shelves to read.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("inventory.no_restaurant", "No restaurant is assigned to this account yet.");

    /// <summary>
    /// No item with that identifier exists in the caller restaurant. An item from
    /// another restaurant reports the same thing.
    /// </summary>
    public static readonly Error ItemNotFound =
        new("inventory.item_not_found", "That inventory item could not be found.");

    /// <summary>Another item in this restaurant already uses the name.</summary>
    public static readonly Error NameTaken =
        new(
            "inventory.name_taken",
            "An inventory item with this name already exists.");

    /// <summary>
    /// The item cannot be deleted because its history would be left dangling.
    ///
    /// Archiving is offered instead. A movement referring to a row nobody can look up
    /// any more would make the whole ledger unreadable, which is a worse outcome than
    /// keeping a row somebody no longer wants.
    /// </summary>
    public static readonly Error HasHistory =
        new(
            "inventory.has_history",
            "This item has stock history and cannot be deleted. Archive it instead.");

    /// <summary>
    /// The item cannot be deleted because a recipe still lists it.
    ///
    /// Reported separately from history, because the fix is different: remove it from
    /// the recipes first.
    /// </summary>
    public static Error UsedInRecipes(int count) =>
        new(
            "inventory.used_in_recipes",
            count == 1
                ? "One menu item lists this as an ingredient. Remove it from that recipe first."
                : $"{count} menu items list this as an ingredient. Remove it from those recipes first.");

    /// <summary>
    /// A correction or a loss was submitted with no reason.
    ///
    /// The one thing this ledger exists to prevent is a stock figure that moved and
    /// nobody knows why, so this is refused rather than stored blank.
    /// </summary>
    public static readonly Error ReasonRequired =
        new(
            "inventory.reason_required",
            "Say why the stock is being corrected or written off.");

    /// <summary>
    /// Consumption was submitted by hand.
    ///
    /// It is written by the kitchen being told to cook, and a second route to it would
    /// let the same food be deducted twice.
    /// </summary>
    public static readonly Error ConsumptionIsAutomatic =
        new(
            "inventory.consumption_is_automatic",
            "Stock used for cooking is recorded when a waiter sends the order to the kitchen.");

    /// <summary>
    /// An opening balance was submitted by hand. It is written once, when the item is
    /// created, and a second one would be a correction pretending to be a beginning.
    /// </summary>
    public static readonly Error OpeningIsAutomatic =
        new(
            "inventory.opening_is_automatic",
            "An opening balance is recorded when the item is created. Use a correction instead.");

    /* ------------------------------------------------------------------- Recipes */

    /// <summary>
    /// No menu item with that identifier exists in the caller restaurant.
    /// </summary>
    public static readonly Error MenuItemNotFound =
        new("inventory.menu_item_not_found", "That menu item could not be found.");

    /// <summary>
    /// A recipe line named an ingredient that is not one of the caller own, which
    /// reports the same as one that does not exist at all.
    /// </summary>
    public static readonly Error IngredientNotFound =
        new(
            "inventory.ingredient_not_found",
            "One of the ingredients could not be found. Refresh and try again.");

    /// <summary>The same ingredient was listed twice in one recipe.</summary>
    public static readonly Error DuplicateIngredient =
        new(
            "inventory.duplicate_ingredient",
            "Each ingredient can only appear once in a recipe. Combine the quantities.");

    /// <summary>
    /// A recipe line measured an ingredient in a unit that cannot describe it.
    ///
    /// Grams of a liquid would need a density the system has no way to know, so this is
    /// refused rather than converted with a made-up figure.
    /// </summary>
    public static Error IncompatibleUnit(string ingredient, string recipeUnit, string stockUnit) =>
        new(
            "inventory.incompatible_unit",
            $"{ingredient} is stocked in {stockUnit}, which cannot be converted to {recipeUnit}.");
}
