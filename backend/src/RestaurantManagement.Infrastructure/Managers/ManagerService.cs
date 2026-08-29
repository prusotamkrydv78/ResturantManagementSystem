using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Managers;
using RestaurantManagement.Application.Managers.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Managers;

/// <summary>
/// Manager administration built on ASP.NET Core Identity.
///
/// Ownership lives in one column, Restaurants.ManagerId, protected by a filtered
/// unique index. Every operation here goes through that single relationship, so the
/// one-manager-to-one-restaurant rule cannot be worked around.
/// </summary>
public sealed class ManagerService : IManagerService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<ManagerService> _logger;

    /// <summary>Creates the service.</summary>
    public ManagerService(
        ApplicationDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        ILogger<ManagerService> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<ManagerResponse>>> GetAllAsync(
        string? search,
        ManagerAssignmentFilter filter,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Users
            .AsNoTracking()
            .Where(user => user.PlatformRole == PlatformRole.RestaurantManager);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(user =>
                user.FullName.Contains(term) ||
                (user.Email != null && user.Email.Contains(term)));
        }

        // The restaurant is found through the ownership column rather than a
        // navigation on the user, so there is still only one source of truth.
        var projected = query
            .Select(user => new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.IsActive,
                user.CreatedAtUtc,
                Restaurant = _dbContext.Restaurants
                    .Where(restaurant => restaurant.ManagerId == user.Id)
                    .Select(restaurant => new AssignedRestaurantDto(
                        restaurant.Id,
                        restaurant.Name,
                        restaurant.Slug))
                    .FirstOrDefault(),
            });

        projected = filter switch
        {
            ManagerAssignmentFilter.Assigned => projected.Where(row => row.Restaurant != null),
            ManagerAssignmentFilter.Unassigned => projected.Where(row => row.Restaurant == null),
            _ => projected,
        };

        var rows = await projected
            .OrderBy(row => row.FullName)
            .ToListAsync(cancellationToken);

        var managers = rows
            .Select(row => new ManagerResponse(
                row.Id,
                row.FullName,
                row.Email ?? string.Empty,
                row.Restaurant is not null,
                row.Restaurant,
                row.IsActive,
                row.CreatedAtUtc))
            .ToList();

        return Result.Success<IReadOnlyList<ManagerResponse>>(managers);
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> GetByIdAsync(
        Guid managerId,
        CancellationToken cancellationToken)
    {
        var manager = await FindManagerAsync(managerId, track: false, cancellationToken);

        return manager is null
            ? Result.Failure<ManagerResponse>(ManagerErrors.NotFound)
            : Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> CreateAsync(
        CreateManagerRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();

        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.EmailAlreadyInUse);
        }

        // Validate the optional assignment before creating anything, so a bad
        // restaurant id does not leave a stray account behind.
        Restaurant? restaurant = null;

        if (request.RestaurantId is not null)
        {
            restaurant = await _dbContext.Restaurants.SingleOrDefaultAsync(
                candidate => candidate.Id == request.RestaurantId,
                cancellationToken);

            if (restaurant is null)
            {
                return Result.Failure<ManagerResponse>(ManagerErrors.RestaurantNotFound);
            }

            if (restaurant.ManagerId is not null)
            {
                return Result.Failure<ManagerResponse>(
                    ManagerErrors.RestaurantAlreadyHasManager);
            }
        }

        // Joins a transaction already in progress rather than starting a second one,
        // which the provider would refuse. That happens when a restaurant and its first
        // manager are created together: the caller owns the transaction so both land or
        // neither does, and this method must not commit half of it early.
        var joined = _dbContext.Database.CurrentTransaction is not null;

        await using var transaction = joined
            ? null
            : await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var manager = new ApplicationUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = request.FullName.Trim(),
            // Set here, never from the request: a client cannot choose its role.
            PlatformRole = PlatformRole.RestaurantManager,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        var createResult = await _userManager.CreateAsync(manager, request.Password);

        if (!createResult.Succeeded)
        {
            // Only unwind what this method owns. When joined, the caller decides -
            // rolling back their transaction from here would undo work it has not
            // been told about.
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            var reason = string.Join(" ", createResult.Errors.Select(e => e.Description));

            return Result.Failure<ManagerResponse>(ManagerErrors.CreationFailed(reason));
        }

        if (restaurant is not null)
        {
            restaurant.ManagerId = manager.Id;
            restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        _logger.LogInformation(
            "Created restaurant manager {ManagerId}{Assignment}.",
            manager.Id,
            restaurant is null ? "" : $" assigned to restaurant {restaurant.Id}");

        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> UpdateAsync(
        Guid managerId,
        UpdateManagerRequest request,
        CancellationToken cancellationToken)
    {
        var manager = await FindManagerAsync(managerId, track: true, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotFound);
        }

        var email = request.Email.Trim();

        if (!string.Equals(manager.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _userManager.FindByEmailAsync(email);

            if (existing is not null && existing.Id != manager.Id)
            {
                return Result.Failure<ManagerResponse>(ManagerErrors.EmailAlreadyInUse);
            }

            // Email doubles as the login name, so both move together and Identity
            // recalculates the normalised columns.
            var emailResult = await _userManager.SetEmailAsync(manager, email);

            if (!emailResult.Succeeded)
            {
                var reason = string.Join(" ", emailResult.Errors.Select(e => e.Description));
                return Result.Failure<ManagerResponse>(ManagerErrors.UpdateFailed(reason));
            }

            var nameResult = await _userManager.SetUserNameAsync(manager, email);

            if (!nameResult.Succeeded)
            {
                var reason = string.Join(" ", nameResult.Errors.Select(e => e.Description));
                return Result.Failure<ManagerResponse>(ManagerErrors.UpdateFailed(reason));
            }
        }

        manager.FullName = request.FullName.Trim();

        var updateResult = await _userManager.UpdateAsync(manager);

        if (!updateResult.Succeeded)
        {
            var reason = string.Join(" ", updateResult.Errors.Select(e => e.Description));
            return Result.Failure<ManagerResponse>(ManagerErrors.UpdateFailed(reason));
        }

        _logger.LogInformation("Updated restaurant manager {ManagerId}.", manager.Id);

        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> AssignAsync(
        Guid managerId,
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        // Assignment accepts an existing manager or an ordinary registered user,
        // who is promoted below. A platform operator is never eligible.
        var manager = await _dbContext.Users.SingleOrDefaultAsync(
            user => user.Id == managerId,
            cancellationToken);

        if (manager is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotFound);
        }

        if (manager.PlatformRole == PlatformRole.SuperAdmin)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotAManager);
        }

        var target = await _dbContext.Restaurants.SingleOrDefaultAsync(
            candidate => candidate.Id == restaurantId,
            cancellationToken);

        if (target is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.RestaurantNotFound);
        }

        // Already theirs: nothing to do, and reporting a conflict would be wrong.
        if (target.ManagerId == managerId)
        {
            return Result.Success(await ToResponseAsync(manager, cancellationToken));
        }

        // Someone else runs it. Refuse rather than quietly displacing them.
        if (target.ManagerId is not null)
        {
            return Result.Failure<ManagerResponse>(
                ManagerErrors.RestaurantAlreadyHasManager);
        }

        var now = DateTimeOffset.UtcNow;

        // Reassignment: release the previous restaurant in the same save, so the
        // unique index is never momentarily violated.
        var current = await _dbContext.Restaurants.SingleOrDefaultAsync(
            candidate => candidate.ManagerId == managerId,
            cancellationToken);

        if (current is not null)
        {
            current.ManagerId = null;
            current.UpdatedAtUtc = now;
        }

        // Promote an ordinary account the first time it is given a restaurant, so
        // the role always matches what the person can actually do.
        if (manager.PlatformRole == PlatformRole.User)
        {
            manager.PlatformRole = PlatformRole.RestaurantManager;

            _logger.LogInformation(
                "Promoted user {UserId} to restaurant manager on assignment.",
                manager.Id);
        }

        target.ManagerId = managerId;
        target.UpdatedAtUtc = now;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Assigned manager {ManagerId} to restaurant {RestaurantId}{Moved}.",
            managerId,
            target.Id,
            current is null ? "" : $" (moved from {current.Id})");

        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> UnassignAsync(
        Guid managerId,
        CancellationToken cancellationToken)
    {
        // Untracked on purpose: this reads the manager only to confirm it exists and to
        // shape the response. The write is on the restaurant row, because that is where
        // ownership lives - nothing on the account changes when it is unassigned.
        var manager = await FindManagerAsync(managerId, track: false, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotFound);
        }

        var current = await _dbContext.Restaurants.SingleOrDefaultAsync(
            candidate => candidate.ManagerId == managerId,
            cancellationToken);

        if (current is not null)
        {
            current.ManagerId = null;
            current.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Unassigned manager {ManagerId} from restaurant {RestaurantId}.",
                managerId,
                current.Id);
        }

        // The account keeps its RestaurantManager role so it can be assigned again
        // without a second round of administration.
        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> ResetPasswordAsync(
        Guid managerId,
        ResetManagerPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var manager = await FindManagerAsync(managerId, track: true, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotFound);
        }

        // Validated before the stored hash is touched. The replacement below happens in
        // two writes, so a password rejected on the second one would leave the account
        // with none at all; checking first means the only way to reach that state is
        // the process dying mid-reset.
        foreach (var validator in _userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(_userManager, manager, request.Password);

            if (!check.Succeeded)
            {
                var invalid = string.Join(" ", check.Errors.Select(e => e.Description));

                return Result.Failure<ManagerResponse>(
                    ManagerErrors.PasswordResetFailed(invalid));
            }
        }

        // Through Identity rather than by writing a hash directly: both calls go via
        // UpdatePasswordHash, which rotates the security stamp, and that is what makes
        // the old password stop working everywhere rather than only at the next
        // sign-in. Not the token-based reset, which would need a token provider to be
        // registered for a token that is minted and consumed in the same breath.
        var removed = await _userManager.RemovePasswordAsync(manager);

        if (!removed.Succeeded)
        {
            var removeReason = string.Join(" ", removed.Errors.Select(e => e.Description));

            return Result.Failure<ManagerResponse>(
                ManagerErrors.PasswordResetFailed(removeReason));
        }

        var result = await _userManager.AddPasswordAsync(manager, request.Password);

        if (!result.Succeeded)
        {
            var reason = string.Join(" ", result.Errors.Select(e => e.Description));

            return Result.Failure<ManagerResponse>(
                ManagerErrors.PasswordResetFailed(reason));
        }

        // Existing refresh tokens are left alone deliberately. They are revoked by
        // suspending the account, which is the action that means "lock them out"; a
        // password reset is usually the manager asking for help getting back in, and
        // signing them out of a device they are holding would not help.
        _logger.LogInformation("Reset the password for manager {ManagerId}.", managerId);

        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<ManagerResponse>> SetActiveAsync(
        Guid managerId,
        SetManagerActiveRequest request,
        CancellationToken cancellationToken)
    {
        var manager = await FindManagerAsync(managerId, track: true, cancellationToken);

        if (manager is null)
        {
            return Result.Failure<ManagerResponse>(ManagerErrors.NotFound);
        }

        if (manager.IsActive == request.IsActive)
        {
            return Result.Success(await ToResponseAsync(manager, cancellationToken));
        }

        if (!request.IsActive)
        {
            // Refusing here is what keeps a restaurant from becoming unopenable while
            // still looking staffed. Ownership lives on the restaurant row, so this
            // asks that rather than the account.
            var stillRuns = await _dbContext.Restaurants.AnyAsync(
                restaurant => restaurant.ManagerId == managerId,
                cancellationToken);

            if (stillRuns)
            {
                return Result.Failure<ManagerResponse>(ManagerErrors.StillAssigned);
            }
        }

        manager.IsActive = request.IsActive;

        var result = await _userManager.UpdateAsync(manager);

        if (!result.Succeeded)
        {
            var reason = string.Join(" ", result.Errors.Select(e => e.Description));

            return Result.Failure<ManagerResponse>(ManagerErrors.UpdateFailed(reason));
        }

        if (!request.IsActive)
        {
            // Sign-in and refresh both check IsActive, so a suspended account cannot
            // start or continue a session. Revoking outstanding refresh tokens closes
            // the remaining gap: without it a live access token keeps working until it
            // expires.
            await RevokeRefreshTokensAsync(managerId, cancellationToken);
        }

        _logger.LogInformation(
            "Manager {ManagerId} is now {State}.",
            managerId,
            request.IsActive ? "active" : "suspended");

        return Result.Success(await ToResponseAsync(manager, cancellationToken));
    }

    private async Task RevokeRefreshTokensAsync(
        Guid managerId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var tokens = await _dbContext.RefreshTokens
            .Where(token => token.UserId == managerId && token.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var token in tokens)
        {
            token.RevokedAtUtc = now;
        }

        if (tokens.Count > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<ApplicationUser?> FindManagerAsync(
        Guid managerId,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? _dbContext.Users : _dbContext.Users.AsNoTracking();

        return await query.SingleOrDefaultAsync(
            user =>
                user.Id == managerId &&
                user.PlatformRole == PlatformRole.RestaurantManager,
            cancellationToken);
    }

    private async Task<ManagerResponse> ToResponseAsync(
        ApplicationUser manager,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(candidate => candidate.ManagerId == manager.Id)
            .Select(candidate => new AssignedRestaurantDto(
                candidate.Id,
                candidate.Name,
                candidate.Slug))
            .FirstOrDefaultAsync(cancellationToken);

        return new ManagerResponse(
            manager.Id,
            manager.FullName,
            manager.Email ?? string.Empty,
            restaurant is not null,
            restaurant,
            manager.IsActive,
            manager.CreatedAtUtc);
    }
}
