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
    /// <summary>
    /// How long a just-rotated refresh token is still honoured.
    ///
    /// Two tabs share one cookie jar, and when their access tokens expire together they
    /// both send the same refresh token in the same instant. Only one can win the
    /// rotation. The loser presents a token that was replaced a moment ago, which is
    /// indistinguishable from theft by shape alone - and treating it as theft revoked
    /// every session the person held, logging them out everywhere for having two tabs
    /// open. Within this window a replayed token is answered with a fresh pair instead.
    ///
    /// Short on purpose: a stolen token replayed inside half a minute of the real
    /// owner's own refresh is the price, and anything longer widens it for nothing.
    /// </summary>
    private static readonly TimeSpan RotationGrace = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Something to hash a password against when there is no account.
    ///
    /// Without it an unknown email answered in microseconds and a known one after a full
    /// password hash, and that difference names which addresses have accounts as surely
    /// as a different error message would.
    /// </summary>
    private static readonly ApplicationUser TimingDecoy = new();

    private static readonly string TimingDecoyHash =
        new PasswordHasher<ApplicationUser>().HashPassword(TimingDecoy, Guid.NewGuid().ToString());

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
            // The same work a real account costs, so the time taken says nothing either.
            _userManager.PasswordHasher.VerifyHashedPassword(
                TimingDecoy,
                TimingDecoyHash,
                request.Password);

            _logger.LogInformation("Login failed: no account for the supplied email.");
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidCredentials);
        }

        // Lockout was configured and never enforced: nothing in the product counted a
        // failure, so the ten-attempt limit existed only in the options. Checked before
        // the password, so a locked account costs a guesser their attempt even when the
        // guess is right.
        if (await _userManager.IsLockedOutAsync(user))
        {
            _logger.LogWarning("Login refused for user {UserId}: locked out.", user.Id);
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.AccountLocked);
        }

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
        {
            await _userManager.AccessFailedAsync(user);

            _logger.LogInformation("Login failed for user {UserId}: bad password.", user.Id);
            return Result.Failure<AuthenticationResult>(AuthenticationErrors.InvalidCredentials);
        }

        // A success clears the count, so ten mistakes spread across a month do not add
        // up to a lockout.
        if (await _userManager.GetAccessFailedCountAsync(user) > 0)
        {
            await _userManager.ResetAccessFailedCountAsync(user);
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
            // Replaced a moment ago: almost always a second tab refreshing alongside
            // the first. Answered rather than punished - see RotationGrace.
            if (stored.ReplacedByTokenId is not null &&
                stored.RevokedAtUtc is { } rotatedAt &&
                now - rotatedAt <= RotationGrace &&
                stored.ExpiresAtUtc > now &&
                stored.User.IsActive)
            {
                _logger.LogInformation(
                    "Refresh token for user {UserId} presented again {Seconds:0.0}s after " +
                    "rotation; treated as a concurrent refresh.",
                    stored.UserId,
                    (now - rotatedAt).TotalSeconds);

                return Result.Success(
                    await IssueReplacementAsync(stored, now, claim: false, cancellationToken));
            }

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

        return Result.Success(
            await IssueReplacementAsync(stored, now, claim: true, cancellationToken));
    }

    /// <summary>
    /// Mints the next refresh token after <paramref name="stored"/>, and an access token.
    ///
    /// The replacement is written first and the old token claimed afterwards with a
    /// conditional update, which is what makes rotation safe under concurrency. Before,
    /// two requests could both read the token as live, both mark it revoked, and both
    /// save - leaving two valid children of one parent and no record that it happened.
    /// Now only one claim can succeed; the other sees zero rows and knows it lost.
    /// </summary>
    /// <param name="stored">The token being exchanged.</param>
    /// <param name="now">The moment of the exchange.</param>
    /// <param name="claim">
    /// Whether to revoke <paramref name="stored"/>. False inside the grace window, where
    /// it was already revoked by the request that won.
    /// </param>
    /// <param name="cancellationToken">Cancels the writes.</param>
    private async Task<AuthenticationResult> IssueReplacementAsync(
        RefreshToken stored,
        DateTimeOffset now,
        bool claim,
        CancellationToken cancellationToken)
    {
        var replacement = BuildRefreshToken(stored.UserId, now, out var rawReplacement);

        _dbContext.RefreshTokens.Add(replacement);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (claim)
        {
            var claimed = await _dbContext.RefreshTokens
                .Where(token => token.Id == stored.Id && token.RevokedAtUtc == null)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(token => token.RevokedAtUtc, now)
                        .SetProperty(token => token.ReplacedByTokenId, replacement.Id),
                    cancellationToken);

            // Somebody else rotated the same token in the same instant. Both are the
            // real owner - a thief does not race the owner to the millisecond - so the
            // replacement already saved stands beside theirs rather than being thrown
            // away and taking this tab's session with it.
            if (claimed == 0)
            {
                _logger.LogInformation(
                    "Refresh token for user {UserId} was rotated concurrently; issuing a " +
                    "sibling rather than refusing.",
                    stored.UserId);
            }
        }

        var (accessToken, accessExpiresAt) = _tokenGenerator.CreateAccessToken(stored.User);

        _logger.LogInformation("Rotated refresh token for user {UserId}.", stored.UserId);

        return new AuthenticationResult(
            new AuthResponse(accessToken, accessExpiresAt, ToDto(stored.User)),
            rawReplacement,
            replacement.ExpiresAtUtc);
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

        // Nothing ever deleted a refresh token, so every sign-in and every rotation
        // added a row forever. Expired ones are useless even as evidence - reuse
        // detection only needs a revoked token until it would have expired anyway - so
        // they go here, one account at a time, where the index on the user makes it
        // cheap and no background job is needed.
        await _dbContext.RefreshTokens
            .Where(token => token.UserId == user.Id && token.ExpiresAtUtc < now)
            .ExecuteDeleteAsync(cancellationToken);

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

    /// <inheritdoc />
    public async Task<Result<UserDto>> UpdateProfileAsync(
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());

        if (user is null)
        {
            return Result.Failure<UserDto>(AuthenticationErrors.UserNotFound);
        }

        var email = (request.Email ?? string.Empty).Trim();
        var fullName = (request.FullName ?? string.Empty).Trim();

        if (email.Length == 0 || fullName.Length == 0)
        {
            return Result.Failure<UserDto>(
                AuthenticationErrors.Rejected("Enter both a name and an email address."));
        }

        // Checked before Identity is asked, so the caller gets the specific reason
        // rather than whatever wording the identity errors happen to carry.
        var taken = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(
                other => other.Id != userId && other.NormalizedEmail == email.ToUpperInvariant(),
                cancellationToken);

        if (taken)
        {
            return Result.Failure<UserDto>(AuthenticationErrors.EmailTaken);
        }

        user.FullName = fullName;

        // The email is also the user name in this product, and Identity keeps the two
        // normalised copies that every lookup actually reads. Setting the columns by
        // hand would leave those stale and the account unable to sign in, which is a
        // spectacular way to lock the platform owner out of their own platform.
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            // The email is the sign-in, so changing it is changing the credential - and
            // it asks for the password for the same reason changing the password does.
            // Without this, anybody holding a stolen access token for fifteen minutes
            // could move the account to an address they own and keep it for good.
            if (string.IsNullOrEmpty(request.CurrentPassword))
            {
                return Result.Failure<UserDto>(AuthenticationErrors.CurrentPasswordRequired);
            }

            if (!await _userManager.CheckPasswordAsync(user, request.CurrentPassword))
            {
                _logger.LogInformation(
                    "Email change refused for {UserId}: current password did not verify.",
                    userId);

                return Result.Failure<UserDto>(AuthenticationErrors.WrongCurrentPassword);
            }

            var emailChange = await _userManager.SetEmailAsync(user, email);

            if (!emailChange.Succeeded)
            {
                return Result.Failure<UserDto>(
                    AuthenticationErrors.Rejected(Describe(emailChange)));
            }

            var nameChange = await _userManager.SetUserNameAsync(user, email);

            if (!nameChange.Succeeded)
            {
                return Result.Failure<UserDto>(
                    AuthenticationErrors.Rejected(Describe(nameChange)));
            }
        }

        var updated = await _userManager.UpdateAsync(user);

        if (!updated.Succeeded)
        {
            return Result.Failure<UserDto>(AuthenticationErrors.Rejected(Describe(updated)));
        }

        _logger.LogInformation("Account {UserId} updated its own profile.", userId);

        return await GetUserByIdAsync(userId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Result> ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());

        if (user is null)
        {
            return Result.Failure(AuthenticationErrors.UserNotFound);
        }

        if (!await _userManager.CheckPasswordAsync(user, request.CurrentPassword))
        {
            _logger.LogInformation(
                "Password change refused for {UserId}: current password did not verify.",
                userId);

            return Result.Failure(AuthenticationErrors.WrongCurrentPassword);
        }

        var changed = await _userManager.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword);

        if (!changed.Succeeded)
        {
            return Result.Failure(AuthenticationErrors.Rejected(Describe(changed)));
        }

        // Everything else signs out. Somebody changing a password usually believes it
        // was known to a person it should not have been, and leaving that person's
        // refresh token alive would make the change cosmetic.
        var now = DateTimeOffset.UtcNow;

        await RevokeAllActiveTokensAsync(user.Id, now, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Account {UserId} changed its own password; every session was revoked.",
            userId);

        return Result.Success();
    }

    /// <inheritdoc />
    public async Task<Result<int>> SignOutEverywhereAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.Id == userId, cancellationToken);

        if (user is null)
        {
            return Result.Failure<int>(AuthenticationErrors.UserNotFound);
        }

        var live = await _dbContext.RefreshTokens
            .CountAsync(
                token => token.UserId == userId && token.RevokedAtUtc == null,
                cancellationToken);

        await RevokeAllActiveTokensAsync(userId, DateTimeOffset.UtcNow, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Account {UserId} revoked {Count} refresh tokens.",
            userId,
            live);

        return Result.Success(live);
    }

    /// <summary>Identity failures, joined into one sentence a screen can print.</summary>
    private static string Describe(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));

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
