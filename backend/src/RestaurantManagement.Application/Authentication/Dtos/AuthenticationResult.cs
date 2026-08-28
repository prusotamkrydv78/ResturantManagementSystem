namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>
/// Internal result of an authentication operation. Unlike <see cref="AuthResponse"/>
/// this includes the raw refresh token, which the API layer writes into an HttpOnly
/// cookie and must never place in a response body.
/// </summary>
public sealed record AuthenticationResult(
    AuthResponse Response,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAtUtc);
