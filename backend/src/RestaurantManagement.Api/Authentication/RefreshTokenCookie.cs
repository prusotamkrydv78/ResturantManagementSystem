using Microsoft.Extensions.Options;

namespace RestaurantManagement.Api.Authentication;

/// <summary>
/// Reads and writes the refresh token cookie. The cookie is always HttpOnly, so the
/// token is never reachable from frontend JavaScript.
/// </summary>
public sealed class RefreshTokenCookie
{
    private readonly RefreshTokenCookieOptions _options;

    /// <summary>Creates the helper.</summary>
    public RefreshTokenCookie(IOptions<RefreshTokenCookieOptions> options)
    {
        _options = options.Value;
    }

    /// <summary>Reads the refresh token from the request, or null when absent.</summary>
    public string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(_options.Name, out var value) && !string.IsNullOrEmpty(value)
            ? value
            : null;

    /// <summary>Writes the refresh token cookie.</summary>
    public void Write(HttpResponse response, string refreshToken, DateTimeOffset expiresAtUtc)
    {
        response.Cookies.Append(_options.Name, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            Path = _options.Path,
            Expires = expiresAtUtc,
            IsEssential = true
        });
    }

    /// <summary>
    /// Clears the cookie. The attributes must match those used when writing it,
    /// otherwise the browser keeps the original cookie.
    /// </summary>
    public void Clear(HttpResponse response)
    {
        response.Cookies.Delete(_options.Name, new CookieOptions
        {
            HttpOnly = true,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            Path = _options.Path
        });
    }
}
