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

    /// <summary>
    /// The menu course this dish came from, copied at submission.
    ///
    /// The kitchen's dividing line, and deliberately not a new thing for somebody to
    /// configure. A rail showing every dish in the building is unusable in a rush -
    /// the grill scrolls past cold starters to find its own work - so it has to be
    /// divisible, and the menu is already divided in the only way a restaurant has
    /// bothered to write down.
    ///
    /// Reusing the course rather than inventing a station means no setup screen, no
    /// per-dish data entry, and nothing to keep in step with the menu. A kitchen maps
    /// itself: whoever is on the tandoor works Breads and Rice.
    ///
    /// Copied like the name and the note, so the slip stands alone and renaming a
    /// category later cannot rewrite what a chef was handed. Null for a dish whose
    /// category has since been deleted, which lands it on the unfiled rail rather
    /// than nowhere.
    /// </summary>
    public string? Course { get; set; }

    /// <summary>
    /// When this dish was cooked and put at the pass, or null while it is still being
    /// made.
    ///
    /// The line, not the ticket, is where cooking actually finishes. A table ordering
    /// momo and samosa gets one slip, and the samosa is done in four minutes while the
    /// momo takes fifteen - so a ticket that can only be all-cooked or not-cooked gave
    /// the kitchen two bad choices: hold the samosa until it is cold, or send the momo
    /// out raw. Neither is what anybody wanted, and no screen could tell the
    /// difference.
    /// </summary>
    public DateTimeOffset? ReadyAtUtc { get; set; }

    /// <summary>
    /// When a waiter carried this dish to the table, or null while it is still at the
    /// pass.
    ///
    /// Also per line, for the same reason read from the other end: if the samosa can be
    /// cooked on its own it can be carried on its own, and a guest who has eaten it
    /// should not be told their whole order is still waiting.
    /// </summary>
    public DateTimeOffset? ServedAtUtc { get; set; }

    /// <summary>Cooked and at the pass, or already gone.</summary>
    public bool IsReady => ReadyAtUtc is not null;

    /// <summary>Carried to the table.</summary>
    public bool IsServed => ServedAtUtc is not null;

    /// <summary>Cooked and still sitting at the pass, which is a waiter's work.</summary>
    public bool IsWaitingAtPass => IsReady && !IsServed;

    /// <summary>
    /// Records that this dish is cooked.
    ///
    /// Refused for one already cooked, so two chefs ticking the same line cannot both
    /// claim it and the second is told rather than silently restamping the time.
    /// </summary>
    public bool TryMarkReady(DateTimeOffset now)
    {
        if (IsReady)
        {
            return false;
        }

        ReadyAtUtc = now;

        return true;
    }

    /// <summary>
    /// Records that this dish has been carried to the table.
    ///
    /// Refused for anything not cooked - food that does not exist cannot be carried
    /// anywhere - and for anything already taken.
    /// </summary>
    public bool TryServe(DateTimeOffset now)
    {
        if (!IsWaitingAtPass)
        {
            return false;
        }

        ServedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Puts the dish back on the stove.
    ///
    /// Only while it is still at the pass. Once it is on a table it is not the
    /// kitchen's to take back.
    /// </summary>
    public bool TryRecall()
    {
        if (!IsWaitingAtPass)
        {
            return false;
        }

        ReadyAtUtc = null;

        return true;
    }
}
