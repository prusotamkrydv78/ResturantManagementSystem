using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Managers.Dtos;

/// <summary>Which managers a list request should return.</summary>
public enum ManagerAssignmentFilter
{
    /// <summary>Every manager.</summary>
    All = 0,

    /// <summary>Only managers who currently run a restaurant.</summary>
    Assigned = 1,

    /// <summary>Only managers with no restaurant.</summary>
    Unassigned = 2,
}

/// <summary>
/// Payload for creating a restaurant manager.
///
/// There is deliberately no role field: the platform role is set by the server to
/// RestaurantManager, so a client cannot ask for a privileged account.
/// </summary>
public sealed class CreateManagerRequest
{
    /// <summary>Display name of the manager.</summary>
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    /// <summary>Email address, also the login name.</summary>
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Initial password. Hashed by ASP.NET Core Identity.
    ///
    /// No minimum beyond being present, and no composition rules: whoever issues the
    /// account chooses. The upper bound is not a rule to satisfy but a bound on what
    /// gets hashed, since an unbounded field is an unbounded amount of work per
    /// request.
    /// </summary>
    [Required]
    [StringLength(128)]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Optional restaurant to assign straight away. The restaurant must exist and
    /// have no manager.
    /// </summary>
    public Guid? RestaurantId { get; set; }
}

/// <summary>Payload for editing the basic details of a manager.</summary>
public sealed class UpdateManagerRequest
{
    /// <summary>Display name of the manager.</summary>
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    /// <summary>Email address, also the login name.</summary>
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;
}

/// <summary>Payload for assigning or reassigning a manager to a restaurant.</summary>
public sealed class AssignRestaurantRequest
{
    /// <summary>The restaurant the manager should run.</summary>
    [Required]
    public Guid RestaurantId { get; set; }
}

/// <summary>
/// Replaces a manager password.
///
/// There is no self-service reset in this product and accounts are issued rather than
/// registered, so this is the only way back in for a manager who has lost theirs. The
/// current password is not required: the caller is the platform owner, who issued the
/// account to begin with.
/// </summary>
public sealed class ResetManagerPasswordRequest
{
    /// <summary>The new password. Identity hashes it; it is never stored or logged.</summary>
    [Required(ErrorMessage = "Enter the new password.")]
    [StringLength(
        128,
        ErrorMessage = "A password cannot be longer than 128 characters.")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Suspends or restores a manager account.
///
/// Both sign-in and refresh check <c>IsActive</c>, so suspending takes hold within the
/// access-token lifetime rather than only at the next sign-in.
/// </summary>
public sealed class SetManagerActiveRequest
{
    /// <summary>False suspends the account, true restores it.</summary>
    [Required]
    public bool IsActive { get; set; }
}
