namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// One line on a kitchen ticket.
///
/// Links the ticket to the order line it came from, and records what the kitchen was
/// actually told. The name, quantity and note are copied at submission so the ticket
/// is a self-contained document: a future kitchen screen reads the ticket rather than
/// reaching back into the order, and the printed slip and the record agree forever.
///
/// No price. The kitchen does not handle money.
///
/// <see cref="OrderItemId"/> carries a unique index, which is what makes double
/// submission impossible rather than merely unlikely: a second ticket claiming the
/// same line fails at the database.
/// </summary>
public class KitchenTicketItem
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The ticket this line belongs to.</summary>
    public Guid KitchenTicketId { get; set; }

    /// <summary>Navigation to the owning ticket.</summary>
    public KitchenTicket KitchenTicket { get; set; } = null!;

    /// <summary>
    /// The order line that was submitted. Unique across the table, so an order line
    /// can only ever be sent to the kitchen once.
    /// </summary>
    public Guid OrderItemId { get; set; }

    /// <summary>Navigation to the submitted order line.</summary>
    public OrderItem OrderItem { get; set; } = null!;

    /// <summary>The item name as the kitchen was told it.</summary>
    public string ItemName { get; set; } = string.Empty;

    /// <summary>How many were sent.</summary>
    public int Quantity { get; set; }

    /// <summary>The instruction the kitchen was given, if any.</summary>
    public string? Note { get; set; }
}
