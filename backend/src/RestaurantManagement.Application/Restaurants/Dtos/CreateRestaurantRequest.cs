using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>Payload for creating a restaurant. Super Admin only.</summary>
public sealed class CreateRestaurantRequest
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
}
