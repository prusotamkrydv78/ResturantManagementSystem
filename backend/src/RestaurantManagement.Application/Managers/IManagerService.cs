using RestaurantManagement.Application.Managers.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Managers;

/// <summary>
/// Restaurant manager administration, for Super Admins only.
///
/// This is the single owner of assignment rules. The restaurant endpoints delegate
/// here rather than repeating them, so assign, reassign and unassign behave
/// identically wherever they are triggered from.
/// </summary>
public interface IManagerService
{
    /// <summary>
    /// Lists managers, optionally narrowed by a name or email fragment and by
    /// whether they currently run a restaurant.
    /// </summary>
    Task<Result<IReadOnlyList<ManagerResponse>>> GetAllAsync(
        string? search,
        ManagerAssignmentFilter filter,
        CancellationToken cancellationToken);

    /// <summary>Loads one manager.</summary>
    Task<Result<ManagerResponse>> GetByIdAsync(
        Guid managerId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Creates a manager account. The platform role is set by the server, never
    /// taken from the request. Optionally assigns a restaurant in the same
    /// transaction.
    /// </summary>
    Task<Result<ManagerResponse>> CreateAsync(
        CreateManagerRequest request,
        CancellationToken cancellationToken);

    /// <summary>Updates the name and email of a manager.</summary>
    Task<Result<ManagerResponse>> UpdateAsync(
        Guid managerId,
        UpdateManagerRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Assigns a manager to a restaurant, moving them off their current one if they
    /// already have it. Fails when the target restaurant belongs to someone else.
    /// </summary>
    Task<Result<ManagerResponse>> AssignAsync(
        Guid managerId,
        Guid restaurantId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Removes the restaurant assignment. The account stays active and can be
    /// assigned again later. Safe to call on an already-unassigned manager.
    /// </summary>
    Task<Result<ManagerResponse>> UnassignAsync(
        Guid managerId,
        CancellationToken cancellationToken);
}
