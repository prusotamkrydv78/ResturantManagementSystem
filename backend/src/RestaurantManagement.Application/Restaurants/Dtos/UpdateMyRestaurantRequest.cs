using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>
/// The fields a restaurant manager may change on their own restaurant.
///
/// There is deliberately no restaurant identifier here, and no manager or slug
/// field. The restaurant being edited is resolved from the access token, so a
/// client has nothing it could alter to reach a different record, and ownership
/// and the platform-level slug stay out of reach.
///
/// Messages are written for the person filling the form rather than using the
/// property names, since they are shown directly in the UI.
/// </summary>
public sealed class UpdateMyRestaurantRequest
{
    /// <summary>Display name of the restaurant.</summary>
    [Required(ErrorMessage = "Enter the restaurant name.")]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage = "The restaurant name must be between 2 and 200 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Street address, or null to clear it.</summary>
    [StringLength(256, ErrorMessage = "The address cannot be longer than 256 characters.")]
    public string? AddressLine { get; set; }

    /// <summary>City, or null to clear it.</summary>
    [StringLength(100, ErrorMessage = "The city cannot be longer than 100 characters.")]
    public string? City { get; set; }

    /// <summary>Country, or null to clear it.</summary>
    [StringLength(100, ErrorMessage = "The country cannot be longer than 100 characters.")]
    public string? Country { get; set; }

    /// <summary>Public contact email, or null to clear it.</summary>
    [EmailAddress(ErrorMessage = "Enter a valid contact email address.")]
    [StringLength(256, ErrorMessage = "The contact email cannot be longer than 256 characters.")]
    public string? ContactEmail { get; set; }

    /// <summary>Public contact phone, or null to clear it.</summary>
    [Phone(ErrorMessage = "Enter a valid contact phone number.")]
    [StringLength(32, ErrorMessage = "The contact phone cannot be longer than 32 characters.")]
    public string? ContactPhone { get; set; }
}
