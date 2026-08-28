using Microsoft.AspNetCore.Http;

namespace RestaurantManagement.Api.Authentication;

/// <summary>
/// Settings for the refresh token cookie, bound from the "RefreshTokenCookie"
/// configuration section so development and production can differ without code changes.
/// </summary>
public sealed class RefreshTokenCookieOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "RefreshTokenCookie";

    /// <summary>Cookie name.</summary>
    public string Name { get; set; } = "rms_refresh_token";

    /// <summary>
    /// Path the cookie is scoped to. Limiting it to the authentication routes keeps
    /// the browser from attaching it to every other API call.
    /// </summary>
    public string Path { get; set; } = "/api/auth";

    /// <summary>
    /// Whether the cookie requires HTTPS. True in production. In development it is
    /// turned off so the flow can be exercised over plain HTTP on localhost.
    /// </summary>
    public bool Secure { get; set; } = true;

    /// <summary>
    /// SameSite mode. "Lax" is enough while the frontend and API share the localhost
    /// site; genuinely cross-site deployments need "None" together with Secure.
    /// </summary>
    public SameSiteMode SameSite { get; set; } = SameSiteMode.Lax;
}
