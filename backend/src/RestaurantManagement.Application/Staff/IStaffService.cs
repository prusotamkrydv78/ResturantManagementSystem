using RestaurantManagement.Application.Staff.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Staff;

/// <summary>
/// Staff administration for a restaurant manager.
///
/// Every method takes the authenticated manager identifier and resolves their
/// restaurant from it. No method accepts a restaurant identifier, so there is no
/// argument a caller could change to reach another restaurant staff, and a staff
/// identifier from elsewhere simply does not resolve.
/// </summary>
public interface IStaffService
{
    /// <summary>
    /// Lists the staff of the caller restaurant, optionally narrowed by a name or
    /// email fragment.
    /// </summary>
    Task<Result<IReadOnlyList<StaffResponse>>> GetAllAsync(
        Guid managerUserId,
        string? search,
        CancellationToken cancellationToken);

    /// <summary>
    /// Lists the staff of a named restaurant. Super Admin only.
    /// </summary>
    /// <remarks>
    /// The one method here that takes a restaurant identifier, because the caller owns
    /// the platform rather than a restaurant and so has nothing to resolve from their
    /// token. Read-only on purpose: hiring and suspending belong to the manager who
    /// works with these people, and a second party editing the same roster is how two
    /// sources of truth start.
    /// </remarks>
    Task<Result<IReadOnlyList<StaffResponse>>> GetForRestaurantAsync(
        Guid restaurantId,
        string? search,
        CancellationToken cancellationToken);

    /// <summary>Loads one staff member from the caller restaurant.</summary>
    Task<Result<StaffResponse>> GetByIdAsync(
        Guid managerUserId,
        Guid staffId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Creates a staff account in the caller restaurant. The platform role and the
    /// restaurant are set by the server.
    /// </summary>
    Task<Result<StaffResponse>> CreateAsync(
        Guid managerUserId,
        CreateStaffRequest request,
        CancellationToken cancellationToken);

    /// <summary>Updates the name, email and operational role of a staff member.</summary>
    Task<Result<StaffResponse>> UpdateAsync(
        Guid managerUserId,
        Guid staffId,
        UpdateStaffRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Activates or deactivates a staff account. Deactivating keeps the record and
    /// revokes the active sessions rather than deleting anything.
    /// </summary>
    Task<Result<StaffResponse>> SetActiveAsync(
        Guid managerUserId,
        Guid staffId,
        bool isActive,
        CancellationToken cancellationToken);
}
