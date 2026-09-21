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

    /// <summary>
    /// The label the restaurant's website answers on, or null to leave it alone.
    ///
    /// The platform owner's to give, like the slug, and for the same reason: it is
    /// unique across every restaurant, so it cannot be a field a manager edits without
    /// somebody arbitrating the collisions.
    ///
    /// An empty string is distinguishable from absent and means "take it away", which
    /// is the only way to release a label somebody else should have.
    /// </summary>
    [StringLength(63, ErrorMessage = "A web address cannot be longer than 63 characters.")]
    public string? Subdomain { get; set; }

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

/// <summary>
/// Suspends or restores a restaurant.
///
/// Suspending stops new orders, staff-placed and guest alike, and leaves everything
/// already running able to finish. Sign-in is untouched: the manager and their staff
/// still need to close the night out and read their own history.
/// </summary>
public sealed class SetRestaurantActiveRequest
{
    /// <summary>False suspends the restaurant, true puts it back in service.</summary>
    [Required]
    public bool IsActive { get; set; }
}
