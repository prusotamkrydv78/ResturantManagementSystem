namespace RestaurantManagement.Application.Realtime;

/// <summary>
/// Whether somebody holding a key is entitled to follow an order.
///
/// The customer side of realtime has no account behind it, so it cannot be authorised
/// the way everything else is. What it has instead is the key handed back when the order
/// was placed: unguessable, given out exactly once, and never returned on a read. Holding
/// it is the same claim as having placed the order, which is precisely the claim needed
/// to watch it.
///
/// Answered by the server rather than trusted from the connection. A client that could
/// name the order it wanted to follow could follow anybody's.
/// </summary>
public interface ICustomerOrderWatch
{
    /// <summary>
    /// The order this key names in this restaurant, or null.
    ///
    /// Scoped to the slug as well as the key, so a key can never reach outside the
    /// restaurant it came from. Null for a wrong key, a wrong slug, an order that has
    /// been settled or called off, and a key that has been spent - all of which mean the
    /// same thing to a hub: there is nothing here to follow.
    /// </summary>
    Task<CustomerOrderHandle?> ResolveAsync(
        string slug,
        string cancelKey,
        CancellationToken cancellationToken);
}

/// <summary>
/// What the hub needs about an order somebody is entitled to follow.
/// </summary>
/// <param name="OrderId">Which order, for the group name.</param>
/// <param name="OrderNumber">
/// So the first message can tell the phone where the order already stands, rather than
/// leaving it blank until the next thing happens.
/// </param>
public sealed record CustomerOrderHandle(Guid OrderId, int OrderNumber);
