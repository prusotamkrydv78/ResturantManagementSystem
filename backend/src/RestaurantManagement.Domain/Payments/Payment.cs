using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Domain.Payments;

/// <summary>
/// A record that an order was paid for.
///
/// A log entry, not a transaction. Nothing was authorised, captured or verified by
/// this system: a manager settled the bill at the counter and wrote down what
/// happened. That is why there is no provider, no reference number, no status and no
/// outcome to interpret — a payment row exists precisely because the money already
/// arrived.
///
/// One per order, enforced by a unique index rather than by a check in the service.
/// Charging a table twice is the failure mode worth making structurally impossible,
/// and an application check cannot hold when two requests race.
///
/// Carries no tax, discount, tip, service charge or change: none of those exist in
/// this product, and a zero column for each would imply they were considered and
/// came to nothing.
/// </summary>
public class Payment
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The restaurant this payment belongs to. Held alongside the order and bound to
    /// it by a composite foreign key, the same way a kitchen ticket is, so a payment
    /// can never reference an order from a different restaurant.
    ///
    /// Also what makes a future takings figure answerable without walking the orders.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The order that was settled.</summary>
    public Guid OrderId { get; set; }

    /// <summary>Navigation to the order.</summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// What was taken, copied from the order total at the moment of payment.
    ///
    /// A snapshot, and never recalculated. The order it came from is closed and its
    /// lines are frozen, so today this always equals that total; storing it anyway
    /// means a later phase that introduces a tax or a discount cannot silently
    /// restate what was actually collected.
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>How the money arrived.</summary>
    public PaymentMethod Method { get; set; }

    /// <summary>
    /// The manager who recorded it. Kept because someone has to be answerable for a
    /// cash figure; it is not a foreign key onto the restaurant manager, since the
    /// account may later be reassigned and the record must not move with it.
    /// </summary>
    public Guid RecordedByUserId { get; set; }

    /// <summary>When it was recorded, which is also when the order closed.</summary>
    public DateTimeOffset RecordedAtUtc { get; set; }
}
