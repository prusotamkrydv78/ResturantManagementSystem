using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Authentication.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Authentication;

/// <summary>
/// Authentication use cases built on ASP.NET Core Identity. Password hashing and
/// verification are delegated to Identity; nothing is hashed by hand here.
/// </summary>
public sealed class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _dbContext;
    private readonly JwtTokenGenerator _tokenGenerator;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<AuthService> _logger;

    /// <summary>Creates the service.</summary>
    public AuthService(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext dbContext,
        JwtTokenGenerator tokenGenerator,
        IOptions<JwtOptions> jwtOptions,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _dbContext = dbContext;
        _tokenGenerator = tokenGenerator;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<AuthenticationResult>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email.Trim());

        // Both branches return the same error so a caller cannot tell an unknown
        // email from a wrong password.
        if (user is null)
        {
            _logger.LogInformation("Login failed: no account for the supplied email.");
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidCredentials);
        }

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
        {
            _logger.LogInformation("Login failed for user {UserId}: bad password.", user.Id);
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidCredentials);
        }

        // Checked after the password so a deactivated account is not disclosed to
        // someone guessing addresses.
        if (!user.IsActive)
        {
            _logger.LogInformation("Login refused for user {UserId}: deactivated.", user.Id);
            return Result.Failure<AuthenticationResult>(
                AuthenticationErrors.AccountDeactivated);
        }

        _logger.LogInformation("User {UserId} signed in.", user.Id);

        return Result.Success(await IssueTokensAsync(user, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<AuthenticationResult>> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidRefreshToken);
        }

        var tokenHash = JwtTokenGenerator.HashRefreshToken(refreshToken);
        var now = DateTimeOffset.UtcNow;

        var stored = await _dbContext.RefreshTokens
            .Include(token => token.User)
            .SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);

        if (stored is null)
        {
            _logger.LogWarning("Refresh rejected: token not recognised.");
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidRefreshToken);
        }

        if (!stored.IsActive(now))
        {
            // A rotated token presented a second time means either a replay or a
            // stolen token, so the whole family is revoked and the real session
            // cannot continue either.
            if (stored.ReplacedByTokenId is not null)
            {
                _logger.LogWarning(
                    "Refresh token reuse detected for user {UserId}; revoking all active tokens.",
                    stored.UserId);

                await RevokeAllActiveTokensAsync(stored.UserId, now, cancellationToken);
            }

            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidRefreshToken);
        }

        // A session must not outlive the account being switched off. Deactivation
        // already revokes outstanding tokens; this also stops a token issued in the
        // same instant from being exchanged.
        if (!stored.User.IsActive)
        {
            stored.RevokedAtUtc = now;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Refresh refused for user {UserId}: account deactivated.",
                stored.UserId);

            return Result.Failure<AuthenticationResult>(
                AuthenticationErrors.AccountDeactivated);
        }

        // Rotation: the presented token is revoked and replaced by a brand new one.
        var replacement = BuildRefreshToken(stored.UserId, now, out var rawReplacement);

        stored.RevokedAtUtc = now;
        stored.ReplacedByTokenId = replacement.Id;

        _dbContext.RefreshTokens.Add(replacement);

        var (accessToken, accessExpiresAt) = _tokenGenerator.CreateAccessToken(stored.User);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Rotated refresh token for user {UserId}.", stored.UserId);

        return Result.Success(new AuthenticationResult(
            new AuthResponse(accessToken, accessExpiresAt, ToDto(stored.User)),
            rawReplacement,
            replacement.ExpiresAtUtc));
    }

    /// <inheritdoc />
    public async Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var tokenHash = JwtTokenGenerator.HashRefreshToken(refreshToken);

        var stored = await _dbContext.RefreshTokens
            .SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);

        // Unknown or already-revoked tokens are ignored: logout is idempotent and
        // must not tell the caller whether the token existed.
        if (stored is null || stored.RevokedAtUtc is not null)
        {
            return;
        }

        stored.RevokedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User {UserId} signed out; refresh token revoked.", stored.UserId);
    }

    /// <inheritdoc />
    public async Task<Result<UserDto>> GetUserByIdAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.Users
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);

        return user is null
            ? Result.Failure<UserDto>(AuthenticationErrors.UserNotFound)
            : Result.Success(ToDto(user));
    }

    private async Task<AuthenticationResult> IssueTokensAsync(
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var refreshToken = BuildRefreshToken(user.Id, now, out var rawRefreshToken);

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var (accessToken, accessExpiresAt) = _tokenGenerator.CreateAccessToken(user);

        return new AuthenticationResult(
            new AuthResponse(accessToken, accessExpiresAt, ToDto(user)),
            rawRefreshToken,
            refreshToken.ExpiresAtUtc);
    }

    private RefreshToken BuildRefreshToken(Guid userId, DateTimeOffset now, out string rawToken)
    {
        rawToken = JwtTokenGenerator.CreateRefreshToken();

        return new RefreshToken
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            TokenHash = JwtTokenGenerator.HashRefreshToken(rawToken),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddDays(_jwtOptions.RefreshTokenDays)
        };
    }

    private async Task RevokeAllActiveTokensAsync(
        Guid userId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        await _dbContext.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAtUtc == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(token => token.RevokedAtUtc, now),
                cancellationToken);
    }

    private static UserDto ToDto(ApplicationUser user) =>
        new(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            user.PlatformRole.ToString(),
            user.StaffRole?.ToString());
}
