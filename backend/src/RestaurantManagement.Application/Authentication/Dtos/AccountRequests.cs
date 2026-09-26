namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>
/// A change to the signed-in account's own name and email.
/// </summary>
/// <param name="FullName">What they are called.</param>
/// <param name="Email">
/// What they sign in with. Changing it changes the credential, which is why the screen
/// says so rather than treating it as an ordinary field.
/// </param>
/// <param name="CurrentPassword">
/// Required when, and only when, the email changes. A name is not a credential; the
/// address you sign in with is.
/// </param>
public sealed record UpdateProfileRequest(
    string FullName,
    string Email,
    string? CurrentPassword = null);

/// <summary>
/// A replacement for the signed-in account's own password.
/// </summary>
/// <param name="CurrentPassword">
/// Proof that whoever is holding this token also knows the password. An administrator
/// resetting somebody else does not need this; replacing your own does.
/// </param>
/// <param name="NewPassword">What it becomes.</param>
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
