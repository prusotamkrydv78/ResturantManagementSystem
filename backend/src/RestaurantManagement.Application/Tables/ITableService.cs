using RestaurantManagement.Application.Tables.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Tables;

/// <summary>
/// Table administration for a restaurant manager.
///
/// Follows the same isolation approach as staff administration: every method takes
/// the authenticated manager identifier and derives their restaurant from it. No
/// method accepts a restaurant identifier, and a table identifier from another
/// restaurant does not resolve.
/// </summary>
public interface ITableService
{
    /// <summary>Lists the tables of the caller restaurant.</summary>
    Task<Result<IReadOnlyList<TableResponse>>> GetAllAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>Loads one table from the caller restaurant.</summary>
    Task<Result<TableResponse>> GetByIdAsync(
        Guid managerUserId,
        Guid tableId,
        CancellationToken cancellationToken);

    /// <summary>Adds a table to the caller restaurant.</summary>
    Task<Result<TableResponse>> CreateAsync(
        Guid managerUserId,
        CreateTableRequest request,
        CancellationToken cancellationToken);

    /// <summary>Updates the name and capacity of a table.</summary>
    Task<Result<TableResponse>> UpdateAsync(
        Guid managerUserId,
        Guid tableId,
        UpdateTableRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Puts a table in or out of service. An inactive table is kept, not deleted.
    /// </summary>
    Task<Result<TableResponse>> SetActiveAsync(
        Guid managerUserId,
        Guid tableId,
        bool isActive,
        CancellationToken cancellationToken);

    /// <summary>
    /// Switches guest ordering on or off for one table.
    ///
    /// Turning it off takes effect on the next scan and leaves the token alone, so a
    /// restaurant can stop self-service for the evening and start it again in the morning
    /// without reprinting anything.
    /// </summary>
    Task<Result<TableResponse>> SetOrderingAsync(
        Guid managerUserId,
        Guid tableId,
        bool isOrderingEnabled,
        CancellationToken cancellationToken);

    /// <summary>
    /// Issues a new token for a table, invalidating every code already printed for it.
    ///
    /// The answer to a code having been photographed, posted online, or walked off with:
    /// the old link stops resolving the moment this returns.
    /// </summary>
    Task<Result<TableResponse>> RegenerateOrderingTokenAsync(
        Guid managerUserId,
        Guid tableId,
        CancellationToken cancellationToken);
}
