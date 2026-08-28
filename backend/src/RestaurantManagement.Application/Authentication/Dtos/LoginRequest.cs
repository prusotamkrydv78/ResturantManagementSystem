using System.ComponentModel.DataAnnotations;

namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>Payload for signing in.</summary>
public sealed class LoginRequest
{
    /// <summary>Account email address.</summary>
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    /// <summary>Account password.</summary>
    [Required]
    public string Password { get; set; } = string.Empty;
}
