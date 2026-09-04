using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.Infrastructure.Realtime;

/// <summary>
/// Which restaurant a connecting account belongs to.
///
/// Two facts rather than one, because the two roles record it in different places: a
/// staff account carries its restaurant, and a manager is named by the restaurant. The
/// same shape as every other caller-to-restaurant resolution in this codebase, and for
/// the same reason - a hub should not have to know which of the two it is looking at.
/// </summary>
public sealed class ConnectionScopeLookup : IConnectionScopeLookup
{
    private readonly ApplicationDbContext _dbContext;

    /// <summary>Creates the lookup.</summary>
    public ConnectionScopeLookup(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<Guid?> RestaurantOfAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        // Active is part of the question, not a filter on the answer. A token issued
        // moments before somebody was deactivated must not still place them in a
        // restaurant's group and keep feeding them its work.
        var staffRestaurantId = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.Id == userId &&
                user.IsActive &&
                user.PlatformRole == PlatformRole.Staff &&
                user.RestaurantId != null)
            .Select(user => user.RestaurantId)
            .SingleOrDefaultAsync(cancellationToken);

        if (staffRestaurantId is not null)
        {
            return staffRestaurantId;
        }

        return await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == userId && restaurant.IsActive)
            .Select(restaurant => (Guid?)restaurant.Id)
            .SingleOrDefaultAsync(cancellationToken);
    }
}
