using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Staff;
using RestaurantManagement.Application.Staff.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Staff;

/// <summary>
/// Staff administration built on ASP.NET Core Identity.
///
/// Isolation works by construction: the restaurant is derived from the manager,
/// and every read and write is filtered by it. A staff identifier from another
/// restaurant does not match and is reported as not found.
/// </summary>
public sealed class StaffService : IStaffService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<StaffService> _logger;

    /// <summary>Creates the service.</summary>
    public StaffService(
        ApplicationDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        ILogger<StaffService> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<StaffResponse>>> GetAllAsync(
        Guid managerUserId,
        string? search,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<IReadOnlyList<StaffResponse>>(
                StaffErrors.NoRestaurantAssigned);
        }

        var members = await ListStaffAsync(
            restaurant.Value.Id,
            restaurant.Value.Name,
            search,
            cancellationToken);

        return Result.Success<IReadOnlyList<StaffResponse>>(members);
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<StaffResponse>>> GetForRestaurantAsync(
        Guid restaurantId,
        string? search,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(candidate => candidate.Id == restaurantId)
            .Select(candidate => new { candidate.Id, candidate.Name })
            .FirstOrDefaultAsync(cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<IReadOnlyList<StaffResponse>>(
                StaffErrors.RestaurantNotFound);
        }

        // Same listing as the manager sees, deliberately. If the platform owner were
        // shown a different projection it would be a second answer to the same
        // question, and the two would drift.
        var members = await ListStaffAsync(
            restaurant.Id,
            restaurant.Name,
            search,
            cancellationToken);

        return Result.Success<IReadOnlyList<StaffResponse>>(members);
    }

    /// <inheritdoc />
    public async Task<Result<StaffResponse>> GetByIdAsync(
        Guid managerUserId,
        Guid staffId,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NoRestaurantAssigned);
        }

        var member = await StaffOf(restaurant.Value.Id)
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == staffId, cancellationToken);

        return member is null
            ? Result.Failure<StaffResponse>(StaffErrors.NotFound)
            : Result.Success(ToResponse(member, restaurant.Value.Name));
    }

    /// <inheritdoc />
    public async Task<Result<StaffResponse>> CreateAsync(
        Guid managerUserId,
        CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NoRestaurantAssigned);
        }

        var email = request.Email.Trim();

        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.EmailAlreadyInUse);
        }

        var member = new ApplicationUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = request.FullName.Trim(),
            // Both set by the server. The request carries neither.
            PlatformRole = PlatformRole.Staff,
            RestaurantId = restaurant.Value.Id,
            StaffRole = request.Role,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };

        var createResult = await _userManager.CreateAsync(member, request.Password);

        if (!createResult.Succeeded)
        {
            var reason = string.Join(" ", createResult.Errors.Select(e => e.Description));
            return Result.Failure<StaffResponse>(StaffErrors.CreationFailed(reason));
        }

        _logger.LogInformation(
            "Created {Role} {StaffId} in restaurant {RestaurantId}.",
            request.Role,
            member.Id,
            restaurant.Value.Id);

        return Result.Success(ToResponse(member, restaurant.Value.Name));
    }

    /// <inheritdoc />
    public async Task<Result<StaffResponse>> UpdateAsync(
        Guid managerUserId,
        Guid staffId,
        UpdateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NoRestaurantAssigned);
        }

        var member = await StaffOf(restaurant.Value.Id)
            .SingleOrDefaultAsync(candidate => candidate.Id == staffId, cancellationToken);

        if (member is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NotFound);
        }

        var email = request.Email.Trim();

        if (!string.Equals(member.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _userManager.FindByEmailAsync(email);

            if (existing is not null && existing.Id != member.Id)
            {
                return Result.Failure<StaffResponse>(StaffErrors.EmailAlreadyInUse);
            }

            // Email doubles as the login name, so both move together and Identity
            // recalculates the normalised columns.
            var emailResult = await _userManager.SetEmailAsync(member, email);

            if (!emailResult.Succeeded)
            {
                return Result.Failure<StaffResponse>(
                    StaffErrors.UpdateFailed(Describe(emailResult)));
            }

            var nameResult = await _userManager.SetUserNameAsync(member, email);

            if (!nameResult.Succeeded)
            {
                return Result.Failure<StaffResponse>(
                    StaffErrors.UpdateFailed(Describe(nameResult)));
            }
        }

        // Only these change. RestaurantId, PlatformRole and IsActive are untouched.
        member.FullName = request.FullName.Trim();
        member.StaffRole = request.Role;

        var updateResult = await _userManager.UpdateAsync(member);

        if (!updateResult.Succeeded)
        {
            return Result.Failure<StaffResponse>(
                StaffErrors.UpdateFailed(Describe(updateResult)));
        }

        _logger.LogInformation("Updated staff {StaffId}.", member.Id);

        return Result.Success(ToResponse(member, restaurant.Value.Name));
    }

    /// <inheritdoc />
    public async Task<Result<StaffResponse>> SetActiveAsync(
        Guid managerUserId,
        Guid staffId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NoRestaurantAssigned);
        }

        var member = await StaffOf(restaurant.Value.Id)
            .SingleOrDefaultAsync(candidate => candidate.Id == staffId, cancellationToken);

        if (member is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NotFound);
        }

        member.IsActive = isActive;

        if (!isActive)
        {
            // Blocking sign in is not enough on its own: an existing refresh token
            // would keep minting access tokens. Revoking them ends the session at
            // the next refresh, and the account cannot start a new one.
            await _dbContext.RefreshTokens
                .Where(token => token.UserId == member.Id && token.RevokedAtUtc == null)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        token => token.RevokedAtUtc,
                        DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Staff {StaffId} {State}.",
            member.Id,
            isActive ? "activated" : "deactivated and sessions revoked");

        return Result.Success(ToResponse(member, restaurant.Value.Name));
    }

    /// <inheritdoc />
    public async Task<Result<StaffResponse>> ResetPasswordAsync(
        Guid managerUserId,
        Guid staffId,
        ResetStaffPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NoRestaurantAssigned);
        }

        var member = await StaffOf(restaurant.Value.Id)
            .SingleOrDefaultAsync(candidate => candidate.Id == staffId, cancellationToken);

        if (member is null)
        {
            return Result.Failure<StaffResponse>(StaffErrors.NotFound);
        }

        // Validated before the stored hash is touched. The replacement below happens in
        // two writes, so a password rejected on the second one would leave the account
        // with none at all; checking first means the only way to reach that state is
        // the process dying mid-reset.
        foreach (var validator in _userManager.PasswordValidators)
        {
            var check = await validator.ValidateAsync(_userManager, member, request.Password);

            if (!check.Succeeded)
            {
                var invalid = string.Join(" ", check.Errors.Select(error => error.Description));

                return Result.Failure<StaffResponse>(
                    StaffErrors.PasswordResetFailed(invalid));
            }
        }

        // Through Identity rather than by writing a hash directly: both calls go via
        // UpdatePasswordHash, which rotates the security stamp, and that is what makes
        // the old password stop working everywhere rather than only at the next
        // sign-in. Not the token-based reset, which would need a token provider to be
        // registered for a token that is minted and consumed in the same breath.
        var removed = await _userManager.RemovePasswordAsync(member);

        if (!removed.Succeeded)
        {
            var reason = string.Join(" ", removed.Errors.Select(error => error.Description));

            return Result.Failure<StaffResponse>(StaffErrors.PasswordResetFailed(reason));
        }

        var result = await _userManager.AddPasswordAsync(member, request.Password);

        if (!result.Succeeded)
        {
            var reason = string.Join(" ", result.Errors.Select(error => error.Description));

            return Result.Failure<StaffResponse>(StaffErrors.PasswordResetFailed(reason));
        }

        // Sessions are left alone deliberately. Deactivating is the action that means
        // "lock them out" and it revokes tokens; a reset is usually somebody standing
        // in front of the manager asking to get back in, and signing out the handset
        // they are holding would not help.
        _logger.LogInformation("Reset the password for staff account {StaffId}.", staffId);

        return Result.Success(ToResponse(member, restaurant.Value.Name));
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteAsync(
        Guid managerUserId,
        Guid staffId,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<bool>(StaffErrors.NoRestaurantAssigned);
        }

        var member = await StaffOf(restaurant.Value.Id)
            .SingleOrDefaultAsync(candidate => candidate.Id == staffId, cancellationToken);

        if (member is null)
        {
            return Result.Failure<bool>(StaffErrors.NotFound);
        }

        // Checked here because the database will not check it for us. These three
        // columns record who did the work but are plain indexed Guids rather than
        // foreign keys, so a delete would succeed and quietly leave every one of them
        // pointing at an account that no longer exists.
        var hasWorked =
            await _dbContext.Orders.AnyAsync(
                order => order.CreatedByStaffId == staffId, cancellationToken)
            || await _dbContext.Payments.AnyAsync(
                payment => payment.RecordedByUserId == staffId, cancellationToken)
            || await _dbContext.StockMovements.AnyAsync(
                movement => movement.RecordedByUserId == staffId, cancellationToken);

        if (hasWorked)
        {
            return Result.Failure<bool>(StaffErrors.HasHistory);
        }

        // Refresh tokens go with the row through the cascade already configured on the
        // user, so no session can outlive the account.
        var result = await _userManager.DeleteAsync(member);

        if (!result.Succeeded)
        {
            var reason = string.Join(" ", result.Errors.Select(error => error.Description));

            return Result.Failure<bool>(StaffErrors.UpdateFailed(reason));
        }

        _logger.LogInformation(
            "Deleted staff account {StaffId} from restaurant {RestaurantId}.",
            staffId,
            restaurant.Value.Id);

        return Result.Success(true);
    }

    /// <summary>
    /// Finds the restaurant the caller manages. Ownership is read from the
    /// restaurant record, which is the only place it is stored.
    /// </summary>
    private async Task<(Guid Id, string Name)?> ResolveRestaurantAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(candidate => candidate.ManagerId == managerUserId)
            .Select(candidate => new { candidate.Id, candidate.Name })
            .FirstOrDefaultAsync(cancellationToken);

        return restaurant is null ? null : (restaurant.Id, restaurant.Name);
    }

    /// <summary>The staff of one restaurant, and nothing else.</summary>
    /// <summary>
    /// The roster of one restaurant, name-or-email filtered and ordered by name.
    ///
    /// Shared by the manager and Super Admin paths, which differ only in how they
    /// arrive at the restaurant: the manager from their token, the administrator from
    /// an identifier in the route.
    /// </summary>
    private async Task<List<StaffResponse>> ListStaffAsync(
        Guid restaurantId,
        string restaurantName,
        string? search,
        CancellationToken cancellationToken)
    {
        var query = StaffOf(restaurantId).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(member =>
                member.FullName.Contains(term) ||
                (member.Email != null && member.Email.Contains(term)));
        }

        return await query
            .OrderBy(member => member.FullName)
            .Select(member => new StaffResponse(
                member.Id,
                member.FullName,
                member.Email ?? string.Empty,
                member.StaffRole!.Value,
                member.IsActive,
                restaurantName,
                member.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    private IQueryable<ApplicationUser> StaffOf(Guid restaurantId) =>
        _dbContext.Users.Where(user =>
            user.RestaurantId == restaurantId &&
            user.PlatformRole == PlatformRole.Staff);

    private static StaffResponse ToResponse(ApplicationUser member, string restaurantName) =>
        new(
            member.Id,
            member.FullName,
            member.Email ?? string.Empty,
            member.StaffRole ?? Domain.Identity.StaffRole.Waiter,
            member.IsActive,
            restaurantName,
            member.CreatedAtUtc);

    private static string Describe(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));
}
