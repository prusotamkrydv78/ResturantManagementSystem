using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>
/// Payload for creating a restaurant, optionally with the manager who will run it.
/// Super Admin only.
///
/// The manager fields exist so setting a restaurant up is one action rather than two.
/// A restaurant with nobody assigned cannot trade at all, so the previous flow always
/// produced a record that was useless until somebody came back to it - and every
/// abandoned half-setup on the platform started there.
///
/// Supply exactly one of:
///
/// <list type="bullet">
/// <item><c>ManagerId</c> to hand it to an account that already exists,</item>
/// <item><c>ManagerFullName</c> + <c>ManagerEmail</c> + <c>ManagerPassword</c> to create one,</item>
/// <item>none of them, to create the restaurant and assign somebody later.</item>
/// </list>
/// </summary>
public sealed class CreateRestaurantRequest : IValidatableObject
{
    /// <summary>Display name of the restaurant.</summary>
    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional URL-friendly identifier. Derived from the name when omitted.
    /// </summary>
    [StringLength(120, MinimumLength = 2)]
    [RegularExpression(
        "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        ErrorMessage = "Slug may contain only lower-case letters, digits and single hyphens.")]
    public string? Slug { get; set; }

    /// <summary>Optional contact email for the restaurant.</summary>
    [EmailAddress]
    [StringLength(256)]
    public string? ContactEmail { get; set; }

    /// <summary>Optional contact phone number.</summary>
    [Phone]
    [StringLength(32)]
    public string? ContactPhone { get; set; }

    /// <summary>Optional street address.</summary>
    [StringLength(256)]
    public string? AddressLine { get; set; }

    /// <summary>Optional city.</summary>
    [StringLength(100)]
    public string? City { get; set; }

    /// <summary>Optional country.</summary>
    [StringLength(100)]
    public string? Country { get; set; }

    /// <summary>
    /// An existing manager account to hand the restaurant to.
    ///
    /// Refused if that account already runs somewhere: one manager, one restaurant.
    /// </summary>
    public Guid? ManagerId { get; set; }

    /// <summary>Name of a new manager account to create for this restaurant.</summary>
    [StringLength(100, MinimumLength = 2)]
    public string? ManagerFullName { get; set; }

    /// <summary>Email of the new manager account, which is also their login.</summary>
    [EmailAddress]
    [StringLength(256)]
    public string? ManagerEmail { get; set; }

    /// <summary>Initial password for the new manager account.</summary>
    [StringLength(128)]
    public string? ManagerPassword { get; set; }

    /// <summary>True when the payload asks for a brand new manager account.</summary>
    public bool CreatesManager =>
        !string.IsNullOrWhiteSpace(ManagerFullName)
        || !string.IsNullOrWhiteSpace(ManagerEmail)
        || !string.IsNullOrWhiteSpace(ManagerPassword);

    /// <summary>
    /// Rejects a payload that asks for two managers, or for a new one without saying
    /// enough about it.
    ///
    /// Checked here rather than in the service so a contradictory request never reaches
    /// the transaction, and so the caller is told which field is missing instead of
    /// getting a generic refusal.
    /// </summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ManagerId is not null && CreatesManager)
        {
            yield return new ValidationResult(
                "Choose an existing manager or create a new one, not both.",
                [nameof(ManagerId)]);

            yield break;
        }

        if (!CreatesManager)
        {
            yield break;
        }

        if (string.IsNullOrWhiteSpace(ManagerFullName))
        {
            yield return new ValidationResult(
                "Enter the manager name.",
                [nameof(ManagerFullName)]);
        }

        if (string.IsNullOrWhiteSpace(ManagerEmail))
        {
            yield return new ValidationResult(
                "Enter the manager email.",
                [nameof(ManagerEmail)]);
        }

        if (string.IsNullOrWhiteSpace(ManagerPassword))
        {
            yield return new ValidationResult(
                "Enter an initial password for the manager.",
                [nameof(ManagerPassword)]);
        }
    }
}
