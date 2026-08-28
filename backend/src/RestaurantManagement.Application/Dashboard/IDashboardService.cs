using RestaurantManagement.Application.Dashboard.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Dashboard;

/// <summary>
/// The manager operational overview.
///
/// Read only, and deliberately so: nothing in this module writes, and no workflow
/// starts here. Every figure it returns is derived on demand from orders, tables,
/// kitchen tickets and payments that already exist, so there is nothing to keep in
/// step and no counter that can fall out of agreement with the records it counts.
///
/// The restaurant is derived from the manager who owns it, the same as every other
/// manager module. No method accepts a restaurant identifier.
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// The whole overview in one answer: what is happening right now, and what the
    /// restaurant has done today.
    ///
    /// One call rather than one per panel, because a dashboard assembled from eight
    /// requests shows eight different moments and then disagrees with itself.
    /// </summary>
    /// <param name="managerUserId">The authenticated manager.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<ManagerDashboardResponse>> GetAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);
}
