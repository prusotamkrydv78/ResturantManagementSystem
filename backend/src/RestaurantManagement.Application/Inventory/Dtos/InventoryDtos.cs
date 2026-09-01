using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Inventory;

namespace RestaurantManagement.Application.Inventory.Dtos;

/// <summary>Bounds the inventory API applies.</summary>
public static class InventoryLimits
{
    /// <summary>Largest quantity accepted on any single write.</summary>
    public const double MaxQuantity = 1_000_000d;

    /// <summary>Smallest quantity that counts as a quantity at all.</summary>
    public const double MinPositiveQuantity = 0.001d;
}

/// <summary>
/// One thing on a kitchen shelf.
///
/// Carries the two figures and the answers derived from them, so every screen agrees
/// about what counts as low rather than each deciding for itself.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the kitchen calls it.</param>
/// <param name="Unit">How it is measured.</param>
/// <param name="QuantityInStock">How much is on the shelf.</param>
/// <param name="MinimumQuantity">The reorder level. Zero means none is set.</param>
/// <param name="IsActive">Whether it is still in use.</param>
/// <param name="IsLowStock">At or below the reorder level, but not empty.</param>
/// <param name="IsOutOfStock">Nothing left, or less than nothing.</param>
/// <param name="IsNegative">
/// Below zero, which means more was cooked than the records held rather than the shelf
/// being empty. Reported separately because it is a data problem, not a stock level.
/// </param>
/// <param name="RecipeUseCount">
/// How many menu items list this as an ingredient. Sent so a manager can see what
/// archiving it would affect.
/// </param>
/// <param name="MovementCount">
/// How many times it has moved. What decides whether it can be deleted or only
/// archived.
/// </param>
/// <param name="LastMovementAtUtc">When it last moved, if it ever has.</param>
/// <param name="CreatedAtUtc">When it was added.</param>
/// <param name="UpdatedAtUtc">When it last changed.</param>
/// <param name="ImageUrl">
/// Where the optional photograph is served from, or null when there is none. Carries
/// a version stamp so a replacement is not hidden behind the cache of the picture it
/// replaced.
/// </param>
public sealed record InventoryItemResponse(
    Guid Id,
    string Name,
    UnitOfMeasure Unit,
    decimal QuantityInStock,
    decimal MinimumQuantity,
    bool IsActive,
    bool IsLowStock,
    bool IsOutOfStock,
    bool IsNegative,
    int RecipeUseCount,
    int MovementCount,
    DateTimeOffset? LastMovementAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    string? ImageUrl);

/// <summary>
/// What the shelves look like as a whole.
///
/// The counts are computed over every item rather than over the page being shown, so a
/// warning cannot be hidden by a filter.
/// </summary>
/// <param name="Items">The items asked for.</param>
/// <param name="ActiveCount">Items in use.</param>
/// <param name="LowStockCount">Items at or below their reorder level.</param>
/// <param name="OutOfStockCount">Items with nothing left.</param>
/// <param name="NegativeCount">Items whose balance has gone below zero.</param>
/// <param name="UntrackedCount">
/// Active items with no reorder level set, so nothing can warn about them. Surfaced
/// because silence about an item is easily mistaken for it being fine.
/// </param>
public sealed record InventoryOverviewResponse(
    IReadOnlyList<InventoryItemResponse> Items,
    int ActiveCount,
    int LowStockCount,
    int OutOfStockCount,
    int NegativeCount,
    int UntrackedCount);

/// <summary>
/// One entry in an item history.
///
/// Carries the change and the balance it produced, so the history reads a line at a
/// time without having to be replayed from the beginning.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Kind">Why it moved.</param>
/// <param name="QuantityDelta">How much it moved by, signed.</param>
/// <param name="QuantityAfter">The balance immediately afterwards.</param>
/// <param name="Unit">The unit both figures are in.</param>
/// <param name="Reason">Why, for the kinds a person enters by hand.</param>
/// <param name="OrderId">The order it was cooked for, when consumed.</param>
/// <param name="OrderNumber">That order readable number, when it still exists.</param>
/// <param name="RecordedByName">Who recorded it.</param>
/// <param name="RecordedAtUtc">When.</param>
public sealed record StockMovementResponse(
    Guid Id,
    StockMovementKind Kind,
    decimal QuantityDelta,
    decimal QuantityAfter,
    UnitOfMeasure Unit,
    string? Reason,
    Guid? OrderId,
    int? OrderNumber,
    string RecordedByName,
    DateTimeOffset RecordedAtUtc);

/// <summary>One item with its history.</summary>
/// <param name="Item">The item.</param>
/// <param name="Movements">Its movements, newest first.</param>
public sealed record InventoryItemDetailResponse(
    InventoryItemResponse Item,
    IReadOnlyList<StockMovementResponse> Movements);

/// <summary>
/// Payload for adding an item to the shelves.
///
/// There is no restaurant field: the item is placed in the restaurant of the
/// authenticated manager.
/// </summary>
public sealed class CreateInventoryItemRequest
{
    /// <summary>What the kitchen calls it. Unique within the restaurant.</summary>
    [Required(ErrorMessage = "Enter a name for the item.")]
    [StringLength(
        InventoryItem.MaxNameLength,
        MinimumLength = 1,
        ErrorMessage = "The name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// How it is measured. Cannot be changed once it has any history, because that
    /// would reinterpret every quantity already recorded.
    /// </summary>
    [Required(ErrorMessage = "Choose how this item is measured.")]
    [EnumDataType(typeof(UnitOfMeasure), ErrorMessage = "Choose a valid unit.")]
    public UnitOfMeasure Unit { get; set; }

    /// <summary>
    /// How much is on the shelf right now. Written as an opening movement, so the
    /// ledger never starts with a balance nothing explains.
    /// </summary>
    [Range(0, InventoryLimits.MaxQuantity, ErrorMessage = "Enter a quantity of zero or more.")]
    public decimal QuantityInStock { get; set; }

    /// <summary>The level at which it needs reordering. Zero for none.</summary>
    [Range(0, InventoryLimits.MaxQuantity, ErrorMessage = "Enter a level of zero or more.")]
    public decimal MinimumQuantity { get; set; }
}

/// <summary>
/// Payload for editing an item.
///
/// The unit is deliberately absent. Changing it would reinterpret every quantity
/// already in the ledger, so it is fixed the moment the item has any history; an item
/// with none can be deleted and added again.
/// </summary>
public sealed class UpdateInventoryItemRequest
{
    /// <summary>What the kitchen calls it.</summary>
    [Required(ErrorMessage = "Enter a name for the item.")]
    [StringLength(
        InventoryItem.MaxNameLength,
        MinimumLength = 1,
        ErrorMessage = "The name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>The level at which it needs reordering. Zero for none.</summary>
    [Range(0, InventoryLimits.MaxQuantity, ErrorMessage = "Enter a level of zero or more.")]
    public decimal MinimumQuantity { get; set; }
}

/// <summary>Payload for archiving or restoring an item.</summary>
public sealed class SetInventoryItemActiveRequest
{
    /// <summary>Whether it is in use.</summary>
    public bool IsActive { get; set; }
}

/// <summary>
/// Payload for moving stock by hand.
///
/// Three of the five kinds can be entered: a delivery, a correction after counting,
/// and something thrown away. Consumption is never entered by hand, because it is
/// written by the kitchen being told to cook and a second route to it would let the
/// same food be deducted twice.
/// </summary>
public sealed class RecordStockMovementRequest
{
    /// <summary>
    /// Why the stock is moving.
    ///
    /// Received adds, Wasted subtracts, and Adjusted is signed because a count can go
    /// either way.
    /// </summary>
    [Required(ErrorMessage = "Choose why the stock is moving.")]
    [EnumDataType(typeof(StockMovementKind), ErrorMessage = "Choose a valid reason.")]
    public StockMovementKind Kind { get; set; }

    /// <summary>
    /// How much, in the unit the item is stocked in.
    ///
    /// Always stated as a positive amount. Which way it moves the balance is decided by
    /// the kind, so a delivery cannot be entered as a negative number and quietly
    /// become a loss. An adjustment says its direction separately.
    /// </summary>
    [Range(
        InventoryLimits.MinPositiveQuantity,
        InventoryLimits.MaxQuantity,
        ErrorMessage = "Enter a quantity greater than zero.")]
    public decimal Quantity { get; set; }

    /// <summary>
    /// For an adjustment, whether the count went up. Ignored for the other kinds,
    /// whose direction is not a choice.
    /// </summary>
    public bool Increase { get; set; }

    /// <summary>
    /// Why. Required for a correction or a loss, because a stock figure that moved for
    /// no stated reason is the thing this ledger exists to prevent.
    /// </summary>
    [StringLength(
        StockMovement.MaxReasonLength,
        ErrorMessage = "A reason cannot be longer than 200 characters.")]
    public string? Reason { get; set; }
}
