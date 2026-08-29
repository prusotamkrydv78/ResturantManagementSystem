using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Menu;

/// <summary>Failures the menu module can report.</summary>
public static class MenuErrors
{
    /// <summary>The caller does not manage a restaurant, so has no menu.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("menu.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>
    /// No category with that identifier exists in the caller restaurant.
    ///
    /// A category belonging to another restaurant reports the same thing, so
    /// probing identifiers reveals nothing.
    /// </summary>
    public static readonly Error CategoryNotFound =
        new("menu.category_not_found", "The category could not be found.");

    /// <summary>Another category in the same restaurant already uses this name.</summary>
    public static readonly Error CategoryNameTaken =
        new(
            "menu.category_name_taken",
            "This restaurant already has a category with that name.");

    /// <summary>No item with that identifier exists in the caller restaurant.</summary>
    public static readonly Error ItemNotFound =
        new("menu.item_not_found", "The menu item could not be found.");

    /// <summary>
    /// The chosen category is not one of this restaurant categories. Reported as a
    /// plain not-found so nothing is disclosed about other restaurants.
    /// </summary>
    public static readonly Error CategoryNotInRestaurant =
        new("menu.category_not_found", "The selected category could not be found.");

    /// <summary>
    /// The item has been sold, so the record is history rather than a mistake.
    ///
    /// Order lines snapshot the name and price, so a receipt still reads correctly
    /// without it - but they also keep the item id, which is what makes "what sells"
    /// answerable. That column is indexed rather than a foreign key, so the delete
    /// would succeed and quietly break the link. Hiding the item takes it off the menu
    /// without taking it out of the sales history.
    /// </summary>
    public static readonly Error ItemHasHistory =
        new(
            "menu.item_has_history",
            "This item has been ordered and cannot be deleted. Hide it instead.");

    /// <summary>
    /// The category still holds items.
    ///
    /// Items cascade from their category in the schema, so deleting one would take its
    /// items with it - including any that have been sold. Emptying it first makes that
    /// an explicit decision about each item rather than a side effect of tidying up.
    /// </summary>
    public static readonly Error CategoryNotEmpty =
        new(
            "menu.category_not_empty",
            "This category still has items. Move or delete them first, or hide the "
            + "category instead.");
}
