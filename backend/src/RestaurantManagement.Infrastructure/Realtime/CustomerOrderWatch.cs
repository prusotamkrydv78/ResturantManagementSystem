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
        string orderKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(slug) || string.IsNullOrWhiteSpace(orderKey))
        {
            return null;
        }

        var trimmed = orderKey.Trim();

        // Projected into a shape the stage can be worked out from, rather than loading
        // the order graph. Four counts and a timestamp is all the derivation needs, and
        // it keeps this to one cheap query on a path a reconnecting phone hits often.
        var found = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.PublicOrderKey == trimmed &&
                order.Restaurant.Slug == slug &&
                order.Restaurant.IsActive &&
                // Only while it is running. A settled or cancelled order has nothing
                // further to report, and a key that outlives its order is a capability
                // with no purpose.
                order.Status == OrderStatus.Open)
            .Select(order => new
            {
                order.Id,
                order.OrderNumber,
                Confirmed = order.ConfirmedAtUtc != null,
                Tickets = order.KitchenTickets.Count,
                Preparing = order.KitchenTickets.Count(ticket =>
                    ticket.Status != KitchenTicketStatus.Pending),
                Ready = order.KitchenTickets.Count(ticket =>
                    ticket.Status == KitchenTicketStatus.Ready),
                Served = order.KitchenTickets.Count(ticket => ticket.ServedAtUtc != null),
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (found is null)
        {
            return null;
        }

        // The furthest thing that has happened wins, which is what somebody waiting for
        // food would say is going on. An order can produce several tickets and they move
        // independently, so this deliberately reports the front of the order rather than
        // trying to describe each one - a guest wants to know their food is coming.
        //
        // Served last and only when every ticket has gone out, because a table with one
        // plate still at the pass has not been served.
        CustomerOrderStage? stage = found switch
        {
            { Tickets: > 0 } row when row.Served == row.Tickets => CustomerOrderStage.Served,
            { Ready: > 0 } => CustomerOrderStage.Ready,
            { Preparing: > 0 } => CustomerOrderStage.BeingPrepared,
            { Tickets: > 0 } => CustomerOrderStage.WithKitchen,
            { Confirmed: true } => CustomerOrderStage.Confirmed,
            _ => null,
        };

        return new CustomerOrderHandle(found.Id, found.OrderNumber, stage);
    }
}
