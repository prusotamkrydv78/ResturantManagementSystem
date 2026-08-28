using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Staff;

/// <summary>Failures the staff module can report.</summary>
public static class StaffErrors
{
    /// <summary>
    /// No staff member with that identifier exists in the caller restaurant.
    ///
    /// A record belonging to a different restaurant produces this same error, so
    /// probing identifiers reveals nothing about other restaurants.
    /// </summary>
    public static readonly Error NotFound =
        new("staff.not_found", "The staff member could not be found.");

    /// <summary>The caller does not manage a restaurant, so has no staff.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("staff.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>The email address is already registered to another account.</summary>
    public static readonly Error EmailAlreadyInUse =
        new("staff.email_in_use", "An account with this email already exists.");

    /// <summary>Identity rejected the account details, for example a weak password.</summary>
    public static Error CreationFailed(string message) =>
        new("staff.creation_failed", message);

    /// <summary>Identity rejected the updated account details.</summary>
    public static Error UpdateFailed(string message) =>
        new("staff.update_failed", message);
}
