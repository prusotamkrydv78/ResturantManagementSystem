namespace RestaurantManagement.Domain.Inventory;

/// <summary>Why a stock figure moved.</summary>
public enum StockMovementKind
{
    /// <summary>
    /// The opening figure, written when the item is created with stock already on the
    /// shelf. Exists so a ledger never begins with an unexplained balance.
    /// </summary>
    Opening = 0,

    /// <summary>A delivery, or anything else arriving. Adds.</summary>
    Received = 1,

    /// <summary>
    /// Used to cook something the kitchen was told to make. Subtracts, and is the only
    /// kind the system writes by itself.
    /// </summary>
    Consumed = 2,

    /// <summary>
    /// A correction after counting the shelf. Signed, because a count can go either
    /// way, and always carries a reason.
    /// </summary>
    Adjusted = 3,

    /// <summary>
    /// Thrown away: spoiled, dropped, burnt. Subtracts, and always carries a reason.
    ///
    /// Kept apart from an adjustment on purpose. Both reduce stock, but one is a
    /// bookkeeping correction and the other is a real loss, and a kitchen that cannot
    /// tell them apart cannot tell whether it is wasting food or miscounting it.
    /// </summary>
    Wasted = 4,
}

/// <summary>
/// One change to one item stock, and why.
///
/// Append only. Nothing edits or deletes a movement: it is the record of something
/// that happened, and a correction is another movement rather than a rewrite of this
/// one. That is also why an item with movements is archived instead of deleted.
///
/// Carries the balance it produced as well as the change it made, so the history can
/// be read a line at a time and checked against the item current figure without
/// replaying everything since the beginning.
/// </summary>
public class StockMovement
{
    /// <summary>Longest reason accepted.</summary>
    public const int MaxReasonLength = 200;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The restaurant this belongs to. Held alongside the item and bound to it by a
    /// composite foreign key, so a movement cannot reference an item in another
    /// restaurant.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The item that moved.</summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>Navigation to the item.</summary>
    public InventoryItem InventoryItem { get; set; } = null!;

    /// <summary>Why it moved.</summary>
    public StockMovementKind Kind { get; set; }

    /// <summary>
    /// How much it moved by, signed. Negative for anything leaving the shelf.
    ///
    /// Signed rather than paired with a direction flag, so the ledger sums to the
    /// balance without anybody having to know which kinds count as which way.
    /// </summary>
    public decimal QuantityDelta { get; set; }

    /// <summary>The balance immediately after this movement.</summary>
    public decimal QuantityAfter { get; set; }

    /// <summary>
    /// The unit both quantities are in, copied from the item at the time.
    ///
    /// A snapshot, because the reading of every historical number depends on it. The
    /// item unit is fixed once movements exist for exactly this reason, and storing it
    /// here means the history stays readable even if that rule is ever relaxed.
    /// </summary>
    public UnitOfMeasure Unit { get; set; }

    /// <summary>
    /// Why, in the words of whoever recorded it. Required for an adjustment or waste,
    /// and absent for the movements the system writes for itself.
    /// </summary>
    public string? Reason { get; set; }

    /// <summary>The order this was cooked for, when it was consumed.</summary>
    public Guid? OrderId { get; set; }

    /// <summary>
    /// The kitchen ticket that caused it, when it was consumed.
    ///
    /// Not a foreign key, for the same reason an order line does not point at a menu
    /// item: this is history, and it must not become undeletable or vanish because
    /// something upstream was tidied away.
    /// </summary>
    public Guid? KitchenTicketId { get; set; }

    /// <summary>
    /// Who recorded it. The manager for a correction, the waiter whose submission
    /// caused the consumption.
    /// </summary>
    public Guid RecordedByUserId { get; set; }

    /// <summary>When it happened.</summary>
    public DateTimeOffset RecordedAtUtc { get; set; }

    /// <summary>Whether this movement took stock off the shelf.</summary>
    public bool IsOutward => QuantityDelta < 0;
}
