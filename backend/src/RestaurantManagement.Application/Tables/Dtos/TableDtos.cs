using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Application.Tables.Dtos;

/// <summary>Smallest and largest number of seats a table may be given.</summary>
public static class TableLimits
{
    /// <summary>A table seats at least one person.</summary>
    public const int MinCapacity = 1;

    /// <summary>
    /// A sanity ceiling, not a business rule. Large functions are handled by
    /// combining tables rather than by one enormous record.
    /// </summary>
    public const int MaxCapacity = 100;
}

/// <summary>
/// A table, as returned to its restaurant manager.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What staff and guests call this table.</param>
/// <param name="Capacity">How many people it seats.</param>
/// <param name="Status">
/// Live occupancy. Always Available in this version; it becomes meaningful when
/// ordering exists and is never set by a manager.
/// </param>
/// <param name="IsActive">Whether the table is in service.</param>
/// <param name="IsOrderingEnabled">
/// Whether guests may order by scanning this table. Off until a manager turns it on.
/// </param>
/// <param name="PublicOrderingToken">
/// The opaque token in this table ordering link, so the manager can print or display the
/// code. Returned only to the manager of the restaurant that owns the table.
/// </param>
/// <param name="CreatedAtUtc">When it was added.</param>
/// <param name="UpdatedAtUtc">When it was last changed.</param>
public sealed record TableResponse(
    Guid Id,
    string Name,
    int Capacity,
    TableStatus Status,
    bool IsActive,
    bool IsOrderingEnabled,
    string PublicOrderingToken,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>
/// Payload for adding a table.
///
/// There is deliberately no restaurant field: the table is placed in the
/// restaurant of the authenticated manager, so a client cannot add tables
/// elsewhere. Occupancy is not settable either.
/// </summary>
public sealed class CreateTableRequest
{
    /// <summary>
    /// What staff and guests call this table, such as "Table 1" or "A1". Must be
    /// unique within the restaurant.
    /// </summary>
    [Required(ErrorMessage = "Enter a table name.")]
    [StringLength(
        32,
        MinimumLength = 1,
        ErrorMessage = "The table name cannot be longer than 32 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>How many people the table seats.</summary>
    [Range(
        TableLimits.MinCapacity,
        TableLimits.MaxCapacity,
        ErrorMessage = "Capacity must be between 1 and 100 seats.")]
    public int Capacity { get; set; } = 2;
}

/// <summary>
/// Payload for editing a table. Active status is changed through its own endpoint,
/// and occupancy is not editable at all.
/// </summary>
public sealed class UpdateTableRequest
{
    /// <summary>The table name. Must stay unique within the restaurant.</summary>
    [Required(ErrorMessage = "Enter a table name.")]
    [StringLength(
        32,
        MinimumLength = 1,
        ErrorMessage = "The table name cannot be longer than 32 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>How many people the table seats.</summary>
    [Range(
        TableLimits.MinCapacity,
        TableLimits.MaxCapacity,
        ErrorMessage = "Capacity must be between 1 and 100 seats.")]
    public int Capacity { get; set; }
}

/// <summary>Payload for putting a table in or out of service.</summary>
public sealed class SetTableActiveRequest
{
    /// <summary>True to return the table to service, false to withdraw it.</summary>
    [Required]
    public bool IsActive { get; set; }
}

/// <summary>
/// Payload for switching guest ordering on or off for one table.
///
/// Separate from active status on purpose. A restaurant that wants a code on the terrace
/// but not in the private room has to be able to say so without taking the private room
/// out of service, and turning self-service off must never be a way of hiding a table from
/// its own staff.
/// </summary>
public sealed class SetTableOrderingRequest
{
    /// <summary>True to let guests order by scanning, false to stop them.</summary>
    [Required]
    public bool IsOrderingEnabled { get; set; }
}
