namespace RestaurantManagement.Application.Realtime;

/// <summary>
/// Which restaurant a connecting account belongs to.
///
/// The hub needs this and cannot get it from the token. The access token carries who
/// somebody is, what they do on the floor and what they may reach, but not where they
/// work - so a connection has to be placed in a restaurant by asking.
///
/// Answered here rather than by reading the claim it could have carried, deliberately.
/// A restaurant identifier baked into a token stays true for the life of that token, and
/// a member of staff who was deactivated or moved would keep receiving another
/// restaurant's orders until it expired. This is checked at the moment of connecting and
/// says nothing at all for an account that is no longer active.
/// </summary>
public interface IConnectionScopeLookup
{
    /// <summary>
    /// The restaurant this account works in, or null.
    ///
    /// Null for a deactivated account, a platform administrator, and anybody with no
    /// restaurant behind them - all of which mean the same thing to a hub: there is no
    /// group to put this connection in.
    /// </summary>
    Task<Guid?> RestaurantOfAsync(Guid userId, CancellationToken cancellationToken);
}
