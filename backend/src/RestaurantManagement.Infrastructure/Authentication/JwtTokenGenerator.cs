using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Infrastructure.Authentication;

/// <summary>
/// Issues signed access tokens and cryptographically random refresh tokens.
/// </summary>
public sealed class JwtTokenGenerator
{
    /// <summary>Bytes of entropy in a refresh token.</summary>
    private const int RefreshTokenByteLength = 32;

    private readonly JwtOptions _options;

    /// <summary>Creates the generator.</summary>
    public JwtTokenGenerator(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    /// <summary>Creates a short-lived signed access token for the user.</summary>
    public (string Token, DateTimeOffset ExpiresAtUtc) CreateAccessToken(ApplicationUser user)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Name, user.FullName),
            // Emitted under the standard "role" name so [Authorize(Roles = ...)]
            // works without any further plumbing.
            new(JwtRegisteredClaimNames.Role, user.PlatformRole.ToString()),
            // A fresh jti per token keeps otherwise identical tokens distinct.
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Carried so later operational features can gate on what the person does on
        // the floor without another lookup. Absent for non-staff accounts.
        if (user.StaffRole is not null)
        {
            claims.Add(new Claim(JwtRegisteredClaimNames.StaffRole, user.StaffRole.Value.ToString()));
        }

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    /// <summary>Creates a refresh token value using a cryptographic RNG.</summary>
    public static string CreateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(RefreshTokenByteLength));

    /// <summary>
    /// Hashes a refresh token for storage. SHA-256 is appropriate here because the
    /// token is already high-entropy random data, unlike a user-chosen password.
    /// </summary>
    public static string HashRefreshToken(string refreshToken) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
}

/// <summary>
/// Registered JWT claim names. Declared locally so the generator does not depend on
/// the ASP.NET Core specific claim constant types.
/// </summary>
internal static class JwtRegisteredClaimNames
{
    internal const string Sub = "sub";
    internal const string Email = "email";
    internal const string Name = "name";
    internal const string Role = "role";
    internal const string StaffRole = "staff_role";
    internal const string Jti = "jti";
}
