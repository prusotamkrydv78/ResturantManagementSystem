using RestaurantManagement.Application.Floor.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Floor;

/// <summary>
/// The live floor overview.
///
/// Read only, and there is no write anywhere in this module. Occupancy is set by
/// placing an order and cleared by closing or cancelling one; offering a second way
/// to change it would let the floor and the orders disagree, and then neither could
/// be trusted.
///
/// Two entry points rather than one, because two different jobs ask the same
/// question. A waiter is looking for somewhere to seat guests and for the order they
/// need to add to; a manager is looking for where money is waiting. The answer is the
/// same shape for both, so the projection is written once, but each resolves its own
/// caller: a waiter must be active staff with a waiter role, a manager must own the
/// restaurant. Neither accepts a restaurant identifier.
/// </summary>
public interface IFloorService
{
    /// <summary>
    /// The floor as a waiter sees it.
    ///
    /// Requires an active waiter, checked here as well as at sign in, so an access
    /// token issued moments before deactivation cannot be used to read the floor.
    /// </summary>
    Task<Result<FloorOverviewResponse>> GetForWaiterAsync(
        Guid staffUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The floor as the manager of the restaurant sees it. Ownership comes from the
    /// restaurant record, not from anything the client sent.
    /// </summary>
    Task<Result<FloorOverviewResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);
}
