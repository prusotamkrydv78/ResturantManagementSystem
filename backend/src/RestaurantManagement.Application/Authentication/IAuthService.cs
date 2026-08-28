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
}
