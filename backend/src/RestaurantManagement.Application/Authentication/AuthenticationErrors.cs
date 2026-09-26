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

    /// <summary>
    /// Too many wrong passwords in a row; sign-in is paused for this account.
    ///
    /// Says so plainly rather than repeating "invalid email or password", which would
    /// send the real owner round in circles retyping a password that is correct.
    /// </summary>
    public static readonly Error AccountLocked =
        new(
            "auth.account_locked",
            "Too many unsuccessful sign-in attempts. Wait a few minutes and try again.");

    /// <summary>An email change arrived without the password that authorises it.</summary>
    public static readonly Error CurrentPasswordRequired =
        new(
            "auth.current_password_required",
            "Enter your current password to change the email you sign in with.");

    /// <summary>The authenticated user no longer exists.</summary>
    public static readonly Error UserNotFound =
        new("auth.user_not_found", "The user could not be found.");

    /// <summary>
    /// The current password supplied alongside a new one did not verify.
    ///
    /// Named separately from <see cref="InvalidCredentials"/> on purpose. Nothing is
    /// being enumerated here - the caller has already proved who they are with a token
    /// - so the honest message is the useful one.
    /// </summary>
    public static readonly Error WrongCurrentPassword =
        new("auth.wrong_current_password", "That is not your current password.");

    /// <summary>The email is already attached to another account.</summary>
    public static readonly Error EmailTaken =
        new("auth.email_taken", "Another account already uses that email.");

    /// <summary>Identity refused the change, usually a password policy.</summary>
    public static Error Rejected(string detail) => new("auth.rejected", detail);
}
