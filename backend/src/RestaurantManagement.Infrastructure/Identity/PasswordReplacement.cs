using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.Infrastructure.Identity;

/// <summary>
/// An administrator setting somebody else's password.
///
/// ONE WRITE, NOT TWO
///
/// Both resets used to remove the password and then add the new one. Those are two
/// saves, and anything that failed between them - the process, the connection, a
/// validator that disagreed on the second pass - left an account with no password at
/// all, which nobody inside the product could then repair. The hash and the security
/// stamp are set here together and saved once.
///
/// EVERY SESSION ENDS
///
/// The resets used to leave sessions alone, on the reasoning that a reset is usually
/// somebody asking to get back in. But somebody asking to get back in is not signed in,
/// so ending their sessions costs them nothing - while the other reason to reset, that
/// the password is known to somebody who should not have it, is defeated entirely if
/// that somebody's refresh token keeps working for another week. Only the second case
/// is affected by the choice, so it decides it.
/// </summary>
internal static class PasswordReplacement
{
    /// <summary>
    /// Replaces the password and revokes every refresh token the account holds.
    ///
    /// The caller runs the password validators first; this does not repeat them.
    /// </summary>
    /// <param name="userManager">Identity, for the hasher and the save.</param>
    /// <param name="dbContext">Where the refresh tokens live.</param>
    /// <param name="user">The account, tracked.</param>
    /// <param name="password">The new password, already validated.</param>
    /// <param name="cancellationToken">Cancels the revocation.</param>
    public static async Task<IdentityResult> ReplaceAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        ApplicationUser user,
        string password,
        CancellationToken cancellationToken)
    {
        user.PasswordHash = userManager.PasswordHasher.HashPassword(user, password);

        // Rotating the stamp is what Identity itself does on a password change, and it
        // is this call that saves the new hash alongside it.
        var saved = await userManager.UpdateSecurityStampAsync(user);

        if (!saved.Succeeded)
        {
            return saved;
        }

        await dbContext.RefreshTokens
            .Where(token => token.UserId == user.Id && token.RevokedAtUtc == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(token => token.RevokedAtUtc, DateTimeOffset.UtcNow),
                cancellationToken);

        return saved;
    }
}
