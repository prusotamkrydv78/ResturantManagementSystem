using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.Infrastructure.Realtime;

/// <summary>
/// Whether somebody holding a key is entitled to follow an order.
///
/// One query, and the whole permission is in its WHERE clause: the key, the restaurant
/// behind the slug, and the order still being open. Nothing is found first and decided
/// about second.
/// </summary>
public sealed class CustomerOrderWatch : ICustomerOrderWatch
{
    private readonly ApplicationDbContext _dbContext;

    /// <summary>Creates the lookup.</summary>
    public CustomerOrderWatch(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<CustomerOrderHandle?> ResolveAsync(
        string slug,
        string cancelKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(slug) || string.IsNullOrWhiteSpace(cancelKey))
        {
            return null;
        }

        var trimmed = cancelKey.Trim();

        return await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.PublicCancelKey == trimmed &&
                order.Restaurant.Slug == slug &&
                order.Restaurant.IsActive &&
                // Only while it is running. A settled or cancelled order has nothing
                // further to report, and a key that outlives its order is a capability
                // with no purpose.
                order.Status == OrderStatus.Open)
            .Select(order => new CustomerOrderHandle(order.Id, order.OrderNumber))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
