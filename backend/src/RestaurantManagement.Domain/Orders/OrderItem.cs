namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// One line on an order.
///
/// The name and price are snapshots taken when the order was placed, so the order
/// still reads correctly after the menu item is renamed, repriced or withdrawn.
/// Reports and receipts must never reconstruct history from the live menu.
///
/// <see cref="MenuItemId"/> is intentionally not a foreign key. It is kept so later
/// analytics can group lines by the item they came from, but the snapshot is the
/// record of truth. A real constraint here would either cascade menu deletions into
/// order history or block the menu from ever being cleaned up, and neither is
/// acceptable for a financial record.
/// </summary>
public class OrderItem
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The order this line belongs to.</summary>
    public Guid OrderId { get; set; }

    /// <summary>Navigation to the owning order.</summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// The menu item this line came from. A soft reference, deliberately without a
    /// foreign key.
    /// </summary>
    public Guid MenuItemId { get; set; }

    /// <summary>The item name as it was when the order was placed.</summary>
    public string ItemName { get; set; } = string.Empty;

    /// <summary>
    /// The price per unit as it was when the order was placed, read from the server
    /// and never from the request.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>How many of this item were ordered.</summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Optional instruction from the guest, such as "no ice". Two lines for the same
    /// item with different notes stay separate, because the note is the distinction.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Quantity multiplied by the snapshot price, stored so a historical total can
    /// never shift with a change in calculation elsewhere.
    /// </summary>
    public decimal LineTotal { get; set; }

    /// <summary>When the line was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>
    /// The kitchen ticket line this order line was submitted on, or null while it is
    /// still unsubmitted.
    ///
    /// Whether a line has gone to the kitchen is read from this relationship rather
    /// than from a flag on the row. The unique index on the other side means it can
    /// only ever be one ticket, so there is nothing here that could disagree with the
    /// tickets themselves.
    /// </summary>
    public KitchenTicketItem? KitchenTicketItem { get; set; }

    /// <summary>
    /// Whether a waiter may still change this line.
    ///
    /// Once a line has gone to the kitchen it is history: the quantity, note, price
    /// and name are fixed, and it cannot be removed. Editability is therefore per
    /// line, not per order, and an order stays open and workable after a submission.
    /// </summary>
    public bool IsSubmittedToKitchen => KitchenTicketItem is not null;
}
