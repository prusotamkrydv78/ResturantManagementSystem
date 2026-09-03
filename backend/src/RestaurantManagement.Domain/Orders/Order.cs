using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// An order placed on a table by a waiter.
///
/// Belongs directly to one restaurant and one table. Carries no customer, delivery,
/// payment, invoice, tax, discount, tip, service charge or inventory data: those
/// belong to later phases and would only be guesswork here.
/// </summary>
public class Order
{
    /// <summary>Primary key. Not shown to staff.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this order belongs to.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>The table this order is for.</summary>
    public Guid TableId { get; set; }

    /// <summary>Navigation to the table.</summary>
    public RestaurantTable Table { get; set; } = null!;

    /// <summary>
    /// Sequential number within the restaurant, starting at 1. This is what staff
    /// say out loud, so the interface never has to show a GUID. Uniqueness is
    /// enforced by an index on (RestaurantId, OrderNumber).
    /// </summary>
    public int OrderNumber { get; set; }

    /// <summary>Lifecycle state.</summary>
    public OrderStatus Status { get; set; } = OrderStatus.Open;

    /// <summary>
    /// Sum of the line totals, calculated by the server from its own snapshots. No
    /// tax, discount or service charge exists yet, so this is currently also the
    /// amount owed; those adjustments will layer on top rather than replace it.
    /// </summary>
    public decimal Subtotal { get; set; }

    /// <summary>
    /// The staff account that placed the order, when a person did.
    ///
    /// Null for an order a guest placed by scanning the code on their table. Nullable
    /// rather than filled with a placeholder, because attributing a guest order to a
    /// member of staff would be a lie that later shows up in a report.
    /// </summary>
    public Guid? CreatedByStaffId { get; set; }

    /// <summary>
    /// How the order arrived. Staff unless a guest scanned a table.
    ///
    /// Recorded so the floor and the kitchen can tell the difference. The lifecycle is
    /// identical either way.
    /// </summary>
    public OrderSource Source { get; set; } = OrderSource.Staff;

    /// <summary>
    /// The customer this is for, when one is known.
    ///
    /// Almost always null: a walk-in is nobody in particular, and this product does not
    /// ask a guest who they are. Set when an order is raised against a booking, so a
    /// customer history can show what they ate.
    /// </summary>
    public Guid? CustomerId { get; set; }

    /// <summary>When the order was placed.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the order was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// When the order was paid and closed. Null while it is still open, which makes
    /// "what did we take today" answerable from the order side as well as from the
    /// payment side.
    /// </summary>
    public DateTimeOffset? CompletedAtUtc { get; set; }

    /// <summary>
    /// When the order was called off. Null unless it was, and never set at the same
    /// time as <see cref="CompletedAtUtc"/>: an order has one ending.
    /// </summary>
    public DateTimeOffset? CancelledAtUtc { get; set; }

    /// <summary>
    /// The manager who called it off.
    ///
    /// Held as a value rather than a foreign key, the same way the order records who
    /// took it: cancelling without payment is a decision someone has to be answerable
    /// for, and that record must survive the account being removed or reassigned.
    /// </summary>
    public Guid? CancelledByUserId { get; set; }

    /// <summary>
    /// Why it was called off, in the manager own words.
    ///
    /// Required when cancelling and free text on purpose. A fixed list would be this
    /// product guessing at a restaurant vocabulary, and the honest answer to "why did
    /// this table pay nothing" is usually a sentence rather than a category.
    /// </summary>
    public string? CancellationReason { get; set; }

    /// <summary>
    /// When somebody at the restaurant confirmed this order with the customer, or null.
    ///
    /// Only a customer-placed order has anything to confirm. An order a waiter typed was
    /// confirmed by the act of typing it: they were standing at the table, talking to the
    /// person ordering. Somebody who ordered from their phone has spoken to nobody, and
    /// this column is the record of that conversation finally happening.
    ///
    /// It is the gate in front of the kitchen. Until it is set, nothing on the order can
    /// be sent, because nobody has yet checked that the order is what the table actually
    /// wants - and it is also what closes the customer's own window to cancel.
    /// </summary>
    public DateTimeOffset? ConfirmedAtUtc { get; set; }

    /// <summary>
    /// Who confirmed it, or null.
    ///
    /// Recorded because confirming is a judgement, not a formality: somebody read the
    /// order back to a table and took responsibility for it being right. When the food
    /// turns out to be wrong, this is the person who knows what was agreed.
    /// </summary>
    public Guid? ConfirmedByStaffId { get; set; }

    /// <summary>
    /// The key the customer who placed this order holds, or null.
    ///
    /// Set only on an order somebody placed from the restaurant website, and handed
    /// back exactly once - in the response to placing it. It is what lets them call
    /// their own order off without an account: they hold it, nobody else has been
    /// given it, and it names exactly one order.
    ///
    /// Random rather than derived from the identifier. Order numbers are sequential
    /// and printed on receipts, so anybody who has eaten here could guess a
    /// neighbour's; this is unguessable by construction.
    ///
    /// Null for anything a member of staff placed. They cancel through billing, as
    /// themselves, and a capability nobody needs is a capability worth not having.
    /// </summary>
    public string? PublicCancelKey { get; set; }

    /// <summary>
    /// Row version maintained by the database, used for optimistic concurrency.
    ///
    /// Two waiters editing the same order is a realistic situation in a restaurant,
    /// and this is the cheapest way to make the second save fail loudly instead of
    /// silently discarding the first.
    /// </summary>
    public byte[] RowVersion { get; set; } = [];

    /// <summary>The lines on this order.</summary>
    public ICollection<OrderItem> Items { get; } = [];

    /// <summary>
    /// The kitchen tickets this order has produced, one per submission. An order
    /// with two tickets sent drinks first and food later.
    /// </summary>
    public ICollection<KitchenTicket> KitchenTickets { get; } = [];

    /// <summary>
    /// The record of this order being paid, if it has been. One at most, which the
    /// database enforces rather than trusting this navigation to be the only route.
    /// </summary>
    public Payment? Payment { get; set; }

    /// <summary>
    /// Whether the order may still be changed.
    ///
    /// Expressed once, here, so the rule has a single home. Completing an order
    /// therefore locks the waiter workflow out of it without a single change to that
    /// workflow: it already asks this question before every edit and every
    /// submission.
    /// </summary>
    public bool IsEditable => Status == OrderStatus.Open;

    /// <summary>Whether a guest placed this themselves rather than a waiter.</summary>
    public bool IsSelfService => Source == OrderSource.QrCode;

    /// <summary>
    /// Whether a customer put this order in themselves.
    ///
    /// Both unattended ways in: the code printed on a table, and the restaurant's own
    /// website. What they share is the thing that matters here - no member of staff was
    /// present, so nothing has been agreed out loud yet.
    ///
    /// Read from the source rather than from the absence of a staff member. They happen
    /// to agree today, but "nobody is recorded" is a fact about the record and "a
    /// customer did this" is a fact about what happened, and only the second one is the
    /// question being asked.
    /// </summary>
    public bool IsCustomerPlaced =>
        Source is OrderSource.Website or OrderSource.QrCode;

    /// <summary>
    /// Whether this order is still waiting for somebody at the restaurant to check it
    /// with the table.
    ///
    /// True for a customer-placed order nobody has confirmed yet, and the reason such an
    /// order reaches the waiter rather than the kitchen. A waiter's own order is never
    /// waiting: they were standing there.
    ///
    /// This is the one condition standing between a customer's order and a pan, and it
    /// closes only when a person says so.
    /// </summary>
    public bool NeedsConfirmation =>
        Status == OrderStatus.Open && IsCustomerPlaced && ConfirmedAtUtc is null;

    /// <summary>Whether a payment has been recorded against this order.</summary>
    public bool IsPaid => Payment is not null;

    /// <summary>
    /// Kitchen work still running on this order.
    ///
    /// Counted from the tickets themselves rather than from a flag, so the kitchen
    /// remains the single source of truth for its own state. Requires
    /// <see cref="KitchenTickets"/> to be loaded; a caller that has not loaded them
    /// would read this as zero, so the billing service loads them deliberately.
    ///
    /// An order that never sent anything to the kitchen has none, and so does not
    /// wait on a kitchen that was never involved.
    /// </summary>
    public int UnfinishedKitchenTicketCount =>
        KitchenTickets.Count(ticket => ticket.Status != KitchenTicketStatus.Ready);

    /// <summary>
    /// Lines the kitchen has never been told about.
    ///
    /// Counted from the absence of a ticket line rather than from a flag, so this and
    /// the kitchen can never disagree. Requires <see cref="Items"/> and each line
    /// <see cref="OrderItem.KitchenTicketItem"/> to be loaded; a caller that has not
    /// loaded them would read zero, so the billing service loads them deliberately.
    /// </summary>
    public int UnsentItemCount =>
        Items.Count(item => !item.IsSubmittedToKitchen);

    /// <summary>
    /// Whether the order may be paid for and closed.
    ///
    /// Four conditions, all of which have to hold: it is still open, nothing has been
    /// paid against it, every line has been sent to the kitchen, and the kitchen has
    /// finished with all of them. Bundled here so the service, the response the manager
    /// sees, and the write path cannot disagree about what eligible means.
    ///
    /// The third condition is the one that is easy to miss. Counting only unfinished
    /// tickets is not enough, because an order that never raised a ticket has none and
    /// therefore passes trivially: a manager could settle a bill for food the kitchen was
    /// never asked to cook, which means it was never made and never served. Billing for
    /// it records revenue against nothing.
    ///
    /// This is deliberately about lines rather than tickets. Requiring merely that some
    /// ticket exists would let three lines be billed after only one had been sent.
    /// </summary>
    public bool CanComplete =>
        Status == OrderStatus.Open &&
        !IsPaid &&
        UnsentItemCount == 0 &&
        UnfinishedKitchenTicketCount == 0;

    /// <summary>
    /// Kitchen work that has already cost the kitchen something: tickets picked up or
    /// finished. Zero means nothing has been started, so calling the order off wastes
    /// nothing.
    ///
    /// Not a bar to cancelling. It is what the manager is shown before they decide,
    /// because throwing away food that is already on the stove is a different act from
    /// voiding an order nobody has touched.
    /// </summary>
    public int StartedKitchenTicketCount =>
        KitchenTickets.Count(ticket => ticket.Status != KitchenTicketStatus.Pending);

    /// <summary>
    /// Whether the order may be called off.
    ///
    /// Two conditions: it is still open, and no money has been taken against it. The
    /// kitchen deliberately does not appear here. Waiting for the kitchen to finish
    /// food nobody is going to pay for would strand the order permanently open, since
    /// there is no refund path to undo a payment and no way to un-cook a plate; a
    /// guest who walks out has to be recordable at any point.
    ///
    /// This is the rule for somebody who works here. A customer calling off their own
    /// order answers to <see cref="CanGuestCancel"/>, which is stricter.
    /// </summary>
    public bool CanCancel => Status == OrderStatus.Open && !IsPaid;

    /// <summary>
    /// Whether the customer who placed this may still call it off themselves.
    ///
    /// Stricter than <see cref="CanCancel"/>: the order must also be unconfirmed, and
    /// nothing on it may have reached the kitchen.
    ///
    /// Confirmation is the real line. Up to that point nobody at the restaurant has
    /// looked at the order, so calling it off costs nothing and inconveniences nobody.
    /// After it, a member of staff has read the order back to the table and agreed it,
    /// and a phone quietly withdrawing what was just agreed in person is exactly the
    /// disagreement this product should not create.
    ///
    /// The kitchen condition is kept as well, though a confirmation now stands in front
    /// of every submission and so it should be unreachable. It costs one clause, and it
    /// is the condition that actually protects the food.
    ///
    /// The whole order rather than a line. Cancelling half of something is a
    /// conversation to have with a waiter, not a button.
    /// </summary>
    public bool CanGuestCancel =>
        CanCancel
        && ConfirmedAtUtc is null
        && !Items.Any(item => item.IsSubmittedToKitchen);

    /// <summary>
    /// Closes the order.
    ///
    /// Returns false when the order is not eligible, which the caller reports as a
    /// conflict. Deliberately does not create the payment: an order that closed
    /// without one, or a payment recorded against an order still open, are both
    /// states this product must never hold, so the two are written together by the
    /// billing service in one transaction rather than being reachable apart.
    /// </summary>
    public bool TryComplete(DateTimeOffset now)
    {
        if (!CanComplete)
        {
            return false;
        }

        Status = OrderStatus.Completed;
        CompletedAtUtc = now;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Calls the order off.
    ///
    /// Returns false when the order is not eligible, which the caller reports as a
    /// conflict. Records who and why alongside the status, so the three cannot exist
    /// apart: a cancelled order with no reason on it would be exactly the missing
    /// history this state exists to keep.
    ///
    /// Touches nothing else. The lines keep their snapshots and any kitchen tickets
    /// keep their own status, because both are records of what really happened and
    /// the order ending badly does not make them untrue.
    /// </summary>
    /// <summary>
    /// Records that somebody at the restaurant has checked this order with the table.
    ///
    /// Returns false when there was nothing to confirm - the order is not
    /// customer-placed, is no longer open, or somebody confirmed it already. False
    /// rather than an exception, because two waiters reaching the same new order at the
    /// same time is an ordinary evening, not a bug.
    ///
    /// Changes nothing about the order's contents. Confirming says "this is what the
    /// table wants"; adjusting it to be what the table wants is an ordinary edit, and
    /// the waiter does that first.
    /// </summary>
    public bool TryConfirm(Guid confirmedByStaffId, DateTimeOffset now)
    {
        if (!NeedsConfirmation)
        {
            return false;
        }

        ConfirmedAtUtc = now;
        ConfirmedByStaffId = confirmedByStaffId;
        UpdatedAtUtc = now;

        return true;
    }

    public bool TryCancel(Guid? cancelledByUserId, string reason, DateTimeOffset now)
    {
        if (!CanCancel)
        {
            return false;
        }

        Status = OrderStatus.Cancelled;
        CancelledAtUtc = now;
        CancelledByUserId = cancelledByUserId;
        CancellationReason = reason;
        UpdatedAtUtc = now;

        return true;
    }
}
