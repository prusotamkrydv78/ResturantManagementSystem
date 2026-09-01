using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Inventory;

/// <summary>
/// Something a kitchen keeps on a shelf.
///
/// Belongs directly to one restaurant. Carries no supplier, no cost, no expiry, no
/// batch and no location: none of those exist in this product, and a column for each
/// would imply they were tracked when nothing writes to them.
///
/// It may carry one photograph, which is optional in the strongest sense: nothing in
/// the product reads it except the screens that show it to a manager. It is there
/// because a shelf of forty white tubs is easier to match against a list with
/// pictures than without, and for no other reason.
///
/// The stock figure here is a running balance, and the movements are the record of how
/// it got that way. Both are written together in one transaction, and every movement
/// stores the balance it produced, so the two can always be checked against each other
/// rather than merely trusted.
/// </summary>
public class InventoryItem
{
    /// <summary>Longest name accepted.</summary>
    public const int MaxNameLength = 120;

    /// <summary>Largest photograph accepted, in bytes.</summary>
    public const int MaxImageBytes = 2 * 1024 * 1024;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this sits in.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>What the kitchen calls it. Unique within the restaurant.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// How this item is measured, and the unit its stock figure is in.
    ///
    /// Fixed once movements exist. Changing it afterwards would silently reinterpret
    /// every historical quantity, turning 500 grams into 500 kilograms in the ledger.
    /// </summary>
    public UnitOfMeasure Unit { get; set; }

    /// <summary>
    /// How much is on the shelf, in <see cref="Unit"/>.
    ///
    /// Allowed to go below zero, and deliberately not constrained to be positive. A
    /// negative balance is a true statement: more was cooked than the records said was
    /// there, which means a delivery went unrecorded or a count was wrong. Clamping it
    /// at zero would hide that and make the ledger stop adding up.
    /// </summary>
    public decimal QuantityInStock { get; set; }

    /// <summary>
    /// The level at which this needs reordering. Zero means nobody has set one.
    /// </summary>
    public decimal MinimumQuantity { get; set; }

    /// <summary>
    /// When this item's photograph was last set, or null when it has none.
    ///
    /// Two jobs, and the reason the bytes are not here beside it. It says whether a
    /// picture exists, so a listing can build the URL without touching the image
    /// table at all; and it is the cache version, because the bytes behind an item's
    /// image URL do change when a manager replaces the picture. The URL carries this
    /// stamp and the response is then cached hard against it, so a replacement is
    /// visible immediately instead of hiding behind a year-long cache.
    ///
    /// Denormalised from <see cref="Image"/>, and written in the same transaction as
    /// it. The pair is the one thing here that could fall out of step, which is why
    /// nothing else is allowed to write either half.
    /// </summary>
    public DateTimeOffset? ImageUpdatedAtUtc { get; set; }

    /// <summary>
    /// The photograph itself, in a table of its own.
    ///
    /// Not a column on this row, and that is not tidiness. Sending an order to the
    /// kitchen loads the inventory item behind every ingredient of every dish on it,
    /// and a blob column here would have dragged all of those photographs across the
    /// wire in the middle of service. A separate table cannot be loaded by accident:
    /// it arrives only when something asks for it by name.
    /// </summary>
    public InventoryItemImage? Image { get; set; }

    /// <summary>
    /// Whether it is still in use.
    ///
    /// Archived rather than deleted once it has any history, because a movement that
    /// referenced a row nobody can look up any more would make the ledger unreadable.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When it was added.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When it was last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// Row version, used for optimistic concurrency.
    ///
    /// Stock is the one figure in this product that several people move at once: a
    /// waiter sending food to the kitchen and a manager recording a delivery both
    /// change it. Without this, one of the two writes would silently overwrite the
    /// other and the balance would stop matching the movements that produced it.
    /// </summary>
    public byte[] RowVersion { get; set; } = [];

    /// <summary>Everything that has ever moved this item, newest last.</summary>
    public ICollection<StockMovement> Movements { get; } = [];

    /// <summary>Nothing left, or less than nothing.</summary>
    public bool IsOutOfStock => QuantityInStock <= 0;

    /// <summary>
    /// At or below the reorder level, but not yet empty.
    ///
    /// Only when a level has actually been set: an item with no minimum is not low, it
    /// is simply unmonitored, and reporting every such item as low would make the
    /// warning worthless.
    /// </summary>
    public bool IsLowStock =>
        MinimumQuantity > 0 && QuantityInStock > 0 && QuantityInStock <= MinimumQuantity;

    /// <summary>
    /// Whether the balance has gone below zero, which means the records are wrong
    /// rather than the shelf being empty.
    /// </summary>
    public bool IsNegative => QuantityInStock < 0;

    /// <summary>
    /// Moves the balance and returns the movement that explains it.
    ///
    /// The only way stock changes. Every caller goes through here, so the balance can
    /// never move without a movement accounting for it.
    ///
    /// The movement is returned rather than attached to <see cref="Movements"/>, and the
    /// caller has to add it through its set. A Guid key is store-generated by
    /// convention, so a row discovered hanging off a tracked parent is assumed to exist
    /// already and updated instead of inserted; the update matches no row and the save
    /// fails as a concurrency conflict, which is the opposite of what happened. Adding
    /// it to the collection here as well would then have it counted twice.
    /// </summary>
    public StockMovement Apply(
        StockMovementKind kind,
        decimal delta,
        Guid recordedByUserId,
        DateTimeOffset now,
        string? reason = null,
        Guid? orderId = null,
        Guid? kitchenTicketId = null)
    {
        QuantityInStock += delta;
        UpdatedAtUtc = now;

        var movement = new StockMovement
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = RestaurantId,
            InventoryItemId = Id,
            Kind = kind,
            QuantityDelta = delta,
            // The balance this movement produced, stored so the history reads as a
            // statement rather than having to be replayed from the beginning.
            QuantityAfter = QuantityInStock,
            Unit = Unit,
            Reason = reason,
            OrderId = orderId,
            KitchenTicketId = kitchenTicketId,
            RecordedByUserId = recordedByUserId,
            RecordedAtUtc = now,
        };

        return movement;
    }
}
