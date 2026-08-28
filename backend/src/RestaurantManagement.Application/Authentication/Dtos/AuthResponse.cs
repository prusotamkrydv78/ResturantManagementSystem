namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>
/// What an authentication call returns to the client: the access token only.
/// The refresh token travels exclusively in an HttpOnly cookie.
/// </summary>
public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAtUtc,
    UserDto User);
