using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Authentication;

/// <summary>Failures the authentication module can report.</summary>
public static class AuthenticationErrors
{
    /// <summary>
    /// Single error for every credential failure. Intentionally does not say whether
    /// the email or the password was wrong, so accounts cannot be enumerated.
    /// </summary>
    public static readonly Error InvalidCredentials =
        new("auth.invalid_credentials", "Invalid email or password.");

    /// <summary>The supplied refresh token is missing, expired, revoked, or already used.</summary>
    public static readonly Error InvalidRefreshToken =
        new("auth.invalid_refresh_token", "The refresh token is invalid or has expired.");

    /// <summary>
    /// The credentials were correct but the account has been switched off.
    /// Reported only after the password verifies, so it reveals nothing to anyone
    /// who does not already hold the credentials.
    /// </summary>
    public static readonly Error AccountDeactivated =
        new("auth.account_deactivated", "This account has been deactivated.");

    /// <summary>The authenticated user no longer exists.</summary>
    public static readonly Error UserNotFound =
        new("auth.user_not_found", "The user could not be found.");
}
