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

    /// <summary>
    /// Replaces a staff member password.
    ///
    /// The only way back in for somebody who has forgotten theirs: the product has no
    /// forgot-password flow, and these accounts are issued rather than registered.
    /// </summary>
    Task<Result<StaffResponse>> ResetPasswordAsync(
        Guid managerUserId,
        Guid staffId,
        ResetStaffPasswordRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes a staff account outright.
    ///
    /// Only for one added by mistake. Refused once the account has taken an order,
    /// recorded a payment or moved stock, because those rows record who did the work
    /// by id and would be left pointing at nobody. Deactivating is the answer for
    /// somebody who has actually worked and then left.
    /// </summary>
    /// <summary>
    /// Puts a photograph on a staff account, replacing any it already had.
    ///
    /// For recognition: a manager matching a name on a roster to a face on a shift.
    /// </summary>
    Task<Result<StaffResponse>> SetImageAsync(
        Guid managerUserId,
        Guid staffId,
        string fileName,
        string contentType,
        Stream content,
        long length,
        CancellationToken cancellationToken);

    /// <summary>Takes the photograph off a staff account.</summary>
    Task<Result<StaffResponse>> RemoveImageAsync(
        Guid managerUserId,
        Guid staffId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The bytes of a staff photograph.
    ///
    /// Takes no caller, because an image tag cannot send an access token. What stands
    /// in for authorisation is the identifier: the account id is only ever handed to
    /// the manager who runs that roster. That is a weaker guarantee than every other
    /// route in this module has, and it is the reason this is a photograph and not a
    /// personnel file.
    /// </summary>
    Task<Result<(byte[] Content, string ContentType)>> GetImageBytesAsync(
        Guid staffId,
        CancellationToken cancellationToken);

    Task<Result<bool>> DeleteAsync(
        Guid managerUserId,
        Guid staffId,
        CancellationToken cancellationToken);
}
