using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Managers;

/// <summary>Failures the manager management module can report.</summary>
public static class ManagerErrors
{
    /// <summary>No restaurant manager exists with the supplied identifier.</summary>
    public static readonly Error NotFound =
        new("manager.not_found", "The manager could not be found.");

    /// <summary>The email address is already registered to another account.</summary>
    public static readonly Error EmailAlreadyInUse =
        new("manager.email_in_use", "An account with this email already exists.");

    /// <summary>The restaurant chosen for the assignment does not exist.</summary>
    public static readonly Error RestaurantNotFound =
        new("manager.restaurant_not_found", "The selected restaurant could not be found.");

    /// <summary>
    /// The target restaurant already has a different manager. Reassignment never
    /// displaces someone silently, so the caller has to unassign them first.
    /// </summary>
    public static readonly Error RestaurantAlreadyHasManager =
        new(
            "manager.restaurant_already_has_manager",
            "That restaurant already has a manager. Unassign them first, then try again.");

    /// <summary>
    /// The account exists but is not a restaurant manager, so manager operations
    /// do not apply to it.
    /// </summary>
    public static readonly Error NotAManager =
        new("manager.not_a_manager", "This account is not a restaurant manager.");

    /// <summary>Identity rejected the account details, for example a weak password.</summary>
    public static Error CreationFailed(string message) =>
        new("manager.creation_failed", message);

    /// <summary>Identity rejected the updated account details.</summary>
    public static Error UpdateFailed(string message) =>
        new("manager.update_failed", message);
}
