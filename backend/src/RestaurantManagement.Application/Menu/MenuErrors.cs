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
}
