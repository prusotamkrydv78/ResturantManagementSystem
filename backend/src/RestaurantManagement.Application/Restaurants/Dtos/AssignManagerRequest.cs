using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>
/// Payload for the initial manager assignment. Super Admin only.
///
/// Exactly one of two modes must be used:
/// supply <see cref="UserId"/> to promote an existing eligible user, or supply
/// <see cref="Email"/>, <see cref="FullName"/> and <see cref="Password"/> to create
/// a new manager account. Mixing or omitting both is rejected as a validation error.
/// </summary>
public sealed class AssignManagerRequest : IValidatableObject
{
    /// <summary>Identifier of an existing user to promote to manager.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Display name for a new manager account.</summary>
    [StringLength(100, MinimumLength = 2)]
    public string? FullName { get; set; }

    /// <summary>Email address for a new manager account.</summary>
    [EmailAddress]
    [StringLength(256)]
    public string? Email { get; set; }

    /// <summary>
    /// Initial password for a new manager account. Hashed by Identity.
    ///
    /// No minimum and no composition rules: the platform administrator issuing the
    /// account chooses. The upper bound is a bound on what gets hashed.
    /// </summary>
    [StringLength(128)]
    public string? Password { get; set; }

    /// <summary>True when the request asks for a brand new account.</summary>
    public bool CreatesNewAccount =>
        UserId is null
        && !string.IsNullOrWhiteSpace(Email)
        && !string.IsNullOrWhiteSpace(Password);

    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var hasExistingUser = UserId is not null;
        var hasNewAccountFields =
            !string.IsNullOrWhiteSpace(Email)
            || !string.IsNullOrWhiteSpace(Password)
            || !string.IsNullOrWhiteSpace(FullName);

        if (hasExistingUser && hasNewAccountFields)
        {
            yield return new ValidationResult(
                "Supply either userId to assign an existing user, or the new account "
                + "fields, but not both.",
                [nameof(UserId)]);
            yield break;
        }

        if (hasExistingUser)
        {
            yield break;
        }

        // New-account mode: all three fields are required together.
        if (string.IsNullOrWhiteSpace(Email))
        {
            yield return new ValidationResult(
                "An email is required to create a manager account.",
                [nameof(Email)]);
        }

        if (string.IsNullOrWhiteSpace(Password))
        {
            yield return new ValidationResult(
                "A password is required to create a manager account.",
                [nameof(Password)]);
        }

        if (string.IsNullOrWhiteSpace(FullName))
        {
            yield return new ValidationResult(
                "A full name is required to create a manager account.",
                [nameof(FullName)]);
        }
    }
}
