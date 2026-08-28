using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Application.Staff.Dtos;

/// <summary>
/// A staff member, as returned to their restaurant manager.
///
/// Projected from the Identity entity, so no password hash, security stamp or
/// token data is ever exposed.
/// </summary>
/// <param name="Id">Account identifier.</param>
/// <param name="FullName">Display name.</param>
/// <param name="Email">Email address, also the login name.</param>
/// <param name="Role">What this person does on the floor.</param>
/// <param name="IsActive">Whether the account may sign in.</param>
/// <param name="RestaurantName">The restaurant they work in.</param>
/// <param name="CreatedAtUtc">When the account was created.</param>
public sealed record StaffResponse(
    Guid Id,
    string FullName,
    string Email,
    StaffRole Role,
    bool IsActive,
    string RestaurantName,
    DateTimeOffset CreatedAtUtc);

/// <summary>
/// Payload for creating a staff account.
///
/// There is deliberately no restaurant field and no platform role field. The
/// restaurant comes from the authenticated manager and the platform role is set by
/// the server, so a client can neither place staff elsewhere nor request a
/// privileged account.
/// </summary>
public sealed class CreateStaffRequest
{
    /// <summary>Display name of the staff member.</summary>
    [Required(ErrorMessage = "Enter the staff member name.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "The name must be between 2 and 100 characters.")]
    public string FullName { get; set; } = string.Empty;

    /// <summary>Email address, also the login name.</summary>
    [Required(ErrorMessage = "Enter an email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(256, ErrorMessage = "The email cannot be longer than 256 characters.")]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Initial password. Hashed by ASP.NET Core Identity.
    ///
    /// No minimum beyond being present, and no composition rules: the manager issuing
    /// the account chooses. The upper bound is a bound on what gets hashed rather than
    /// a rule to satisfy.
    /// </summary>
    [Required(ErrorMessage = "Enter an initial password.")]
    [StringLength(
        128,
        ErrorMessage = "A password cannot be longer than 128 characters.")]
    public string Password { get; set; } = string.Empty;

    /// <summary>Waiter, Chef or Cashier. Any other value is rejected.</summary>
    [Required(ErrorMessage = "Choose a role.")]
    [EnumDataType(typeof(StaffRole), ErrorMessage = "Choose a valid role.")]
    public StaffRole Role { get; set; }
}

/// <summary>
/// Payload for editing a staff member.
///
/// Active status is changed through its own endpoint, and the restaurant, platform
/// role and manager assignment are absent entirely.
/// </summary>
public sealed class UpdateStaffRequest
{
    /// <summary>Display name of the staff member.</summary>
    [Required(ErrorMessage = "Enter the staff member name.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "The name must be between 2 and 100 characters.")]
    public string FullName { get; set; } = string.Empty;

    /// <summary>Email address, also the login name.</summary>
    [Required(ErrorMessage = "Enter an email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(256, ErrorMessage = "The email cannot be longer than 256 characters.")]
    public string Email { get; set; } = string.Empty;

    /// <summary>Waiter, Chef or Cashier.</summary>
    [Required(ErrorMessage = "Choose a role.")]
    [EnumDataType(typeof(StaffRole), ErrorMessage = "Choose a valid role.")]
    public StaffRole Role { get; set; }
}

/// <summary>Payload for activating or deactivating a staff account.</summary>
public sealed class SetStaffActiveRequest
{
    /// <summary>True to allow sign in, false to block it.</summary>
    [Required]
    public bool IsActive { get; set; }
}
