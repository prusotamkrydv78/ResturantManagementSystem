using RestaurantManagement.Application.Authentication.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Authentication;

/// <summary>
/// Authentication use cases. Implemented in the infrastructure layer, which owns
/// ASP.NET Core Identity and the database.
/// </summary>
public interface IAuthService
{
    /// <summary>Validates credentials and issues tokens.</summary>
    Task<Result<AuthenticationResult>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken);

    /// <summary>Validates a refresh token, revokes it, and issues a replacement pair.</summary>
    Task<Result<AuthenticationResult>> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken);

    /// <summary>Revokes the supplied refresh token. Safe to call with an unknown token.</summary>
    Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken);

    /// <summary>Loads a user by the identifier taken from the validated JWT.</summary>
    Task<Result<UserDto>> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// Changes the signed-in account name and email.
    ///
    /// Every account in the product has somebody who can reset it for them - a manager
    /// has the platform administrator, staff have their manager - except the platform
    /// administrator, who has nobody. These three methods exist so the one account at
    /// the top of the tree is not the only one that cannot be maintained from inside
    /// the product.
    /// </summary>
    Task<Result<UserDto>> UpdateProfileAsync(
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Replaces the signed-in account password, having checked the current one.
    ///
    /// Unlike the administrator reset of a manager password, this asks for the old one:
    /// a stolen access token would otherwise be enough to take an account permanently,
    /// and a token is the easier of the two to steal.
    /// </summary>
    Task<Result> ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Revokes every refresh token this account holds, on every device.
    ///
    /// The access token already issued stays valid until it expires - it is signed, not
    /// stored, and nothing can recall it - so this ends sessions at the next refresh
    /// rather than instantly. Said plainly on screen rather than implied.
    /// </summary>
    Task<Result<int>> SignOutEverywhereAsync(Guid userId, CancellationToken cancellationToken);
}
