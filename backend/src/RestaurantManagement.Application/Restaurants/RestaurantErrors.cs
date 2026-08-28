using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Restaurants;

/// <summary>
/// Failures the restaurant module can report. Assignment failures live in
/// <c>ManagerErrors</c>, since the manager module owns those rules.
/// </summary>
public static class RestaurantErrors
{
    /// <summary>No restaurant exists with the supplied identifier.</summary>
    public static readonly Error NotFound =
        new("restaurant.not_found", "The restaurant could not be found.");

    /// <summary>The slug is already used by another restaurant.</summary>
    public static readonly Error SlugTaken =
        new("restaurant.slug_taken", "A restaurant with this slug already exists.");

    /// <summary>The signed-in manager has no restaurant assigned to them.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("restaurant.not_assigned", "No restaurant is assigned to this account.");

    /// <summary>
    /// The restaurant is suspended, so it may not take new business.
    ///
    /// Raised where an order would start - a waiter opening one, or a guest scanning a
    /// table. Never raised on work already underway: a ticket in the kitchen still
    /// cooks and an open bill still settles, because suspending mid-service must not
    /// strand food or money.
    /// </summary>
    public static readonly Error Suspended =
        new(
            "restaurant.suspended",
            "This restaurant is suspended and cannot take new orders.");
}
