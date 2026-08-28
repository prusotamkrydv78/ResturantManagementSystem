using System.Security.Claims;

namespace RestaurantManagement.Api.Authentication;

/// <summary>Reads identity information out of a validated access token.</summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Returns the user identifier from the token subject claim, or null when it is
    /// missing or malformed.
    ///
    /// This is the only source of caller identity used for authorization. A user
    /// identifier supplied in a route, query string, or body is never trusted for
    /// deciding what the caller may access.
    /// </summary>
    public static Guid? GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(JwtClaimNames.Sub), out var userId)
            ? userId
            : null;
}
