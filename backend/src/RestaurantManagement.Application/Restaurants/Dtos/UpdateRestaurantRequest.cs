using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>
/// Super Admin edit of any restaurant, addressed by identifier.
///
/// Deliberately separate from <see cref="UpdateMyRestaurantRequest"/> even though the
/// fields overlap. That one is the manager editing their own record, found from the
/// token and never carrying an identifier; this one belongs to the platform owner and
/// is the only place the slug can change. Folding them together would put a slug field
/// on a manager-facing request and invite it being honoured.
/// </summary>
public sealed class UpdateRestaurantRequest
{
    [Required(ErrorMessage = "Enter the restaurant name.")]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage = "The name must be between 2 and 200 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// New slug, or null to leave it alone.
    ///
    /// Unique platform-wide. Changing it breaks any guest ordering link already handed
    /// out for this restaurant, so it is optional rather than required: an edit that
    /// only fixes a typo in the name should not have to restate the slug and risk
    /// changing it by accident.
    /// </summary>
    [StringLength(
        120,
        MinimumLength = 1,
        ErrorMessage = "The slug cannot be longer than 120 characters.")]
    public string? Slug { get; set; }

    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(256)]
    public string? ContactEmail { get; set; }

    [StringLength(32)]
    public string? ContactPhone { get; set; }

    [StringLength(200)]
    public string? AddressLine { get; set; }

    [StringLength(100)]
    public string? City { get; set; }

    [StringLength(100)]
    public string? Country { get; set; }
}
