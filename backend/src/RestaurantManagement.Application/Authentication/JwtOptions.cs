namespace RestaurantManagement.Application.Authentication;

/// <summary>
/// JWT settings bound from the "Jwt" configuration section. The signing key must
/// come from configuration or environment (user secrets in development), never source.
/// </summary>
public sealed class JwtOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Jwt";

    /// <summary>Token issuer.</summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>Token audience.</summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>Symmetric signing key. Supplied through configuration only.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Access token lifetime in minutes. Deliberately short.</summary>
    public int AccessTokenMinutes { get; set; } = 15;

    /// <summary>Refresh token lifetime in days.</summary>
    public int RefreshTokenDays { get; set; } = 7;
}
