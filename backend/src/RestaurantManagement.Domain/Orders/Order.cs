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
    /// Sum of the line totals, calculated by the server from its own snapshots.
    ///
    /// What the food cost, before anything is taken off or added on. Never the amount
    /// owed - that is <see cref="Total"/>, and confusing the two is how a restaurant
    /// undercharges by twenty three per cent.
    /// </summary>
    public decimal Subtotal { get; set; }

    /// <summary>
    /// Money taken off the bill, in currency and not as a percentage.
    ///
    /// Stored as an amount even when a manager entered a percentage, because the
    /// percentage is a way of arriving at a figure and the figure is what was agreed.
    /// Keeping the percentage would mean a later change to the lines silently changing
    /// a discount somebody had already promised a table.
    ///
    /// Applied before the service charge and the tax, so both are calculated on what is
    /// actually being charged.
    /// </summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>
    /// Why the discount was given, or null when there is none.
    ///
    /// Required whenever there is a discount, and free text for the same reason a
    /// cancellation reason is: the honest answer to "why did this table pay less" is a
    /// sentence, and a fixed list would be this product guessing at a restaurant's
    /// vocabulary. It is also the only thing standing between a discount feature and
    /// unexplained missing money.
    /// </summary>
    public string? DiscountReason { get; set; }

    /// <summary>
    /// The service charge rate this order was opened with, as a fraction.
    ///
    /// Snapshotted from the restaurant rather than read live, exactly as a line
    /// snapshots its price. A manager changing the rate at nine o'clock must not
    /// rewrite the bill of a table that sat down at seven.
    /// </summary>
    public decimal ServiceChargeRate { get; set; }

    /// <summary>The service charge in currency, derived from the rate.</summary>
    public decimal ServiceChargeAmount { get; set; }

    /// <summary>
    /// The VAT rate this order was opened with, as a fraction. Snapshotted for the same
    /// reason as the service charge, and with more legal weight behind it.
    /// </summary>
    public decimal VatRate { get; set; }

    /// <summary>The VAT in currency, derived from the rate.</summary>
    public decimal VatAmount { get; set; }

    /// <summary>
    /// What the table owes. The one figure a customer is asked to pay.
    ///
    /// Stored rather than computed on read, because it is the number a payment is
    /// checked against and the number printed on a receipt. A total that is recalculated
    /// every time it is looked at is a total that can change after somebody has paid it.
    /// </summary>
    public decimal Total { get; set; }

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
    /// back exactly once - in the response to placing it. Without an account it is the
    /// only thing that can stand for "this is my order": they hold it, nobody else has
    /// been given it, and it names exactly one order.
    ///
    /// It buys two things. Following the order, so their phone can say where the food
    /// is; and adding to it, which is the one change to a running order a customer can
    /// make on their own. It deliberately does not buy calling the order off - that is
    /// a conversation with a waiter, not a button on a phone.
    ///
    /// Random rather than derived from the identifier. Order numbers are sequential
    /// and printed on receipts, so anybody who has eaten here could guess a
    /// neighbour's; this is unguessable by construction.
    ///
    /// Every open order carries one, including the ones a member of staff placed. That
    /// was not always so, and the reasoning that left staff orders without a key - that
    /// the waiter is standing at the table, so nobody needs it - answered the wrong
    /// question. The person who needs it is the guest: they scan the code on their
    /// table, and without a key on the order that scan found nothing and showed them a
    /// menu with their own table marked in use.
    ///
    /// It grants no more than it ever did - following the order, adding to it while the
    /// kitchen has not been told, asking for the bill - and anything a guest adds still
    /// has to be agreed by whoever opened the order. See NeedsConfirmation.
    /// </summary>
    public string? PublicOrderKey { get; set; }

    /// <summary>
    /// When the table asked for their bill, or null if they have not.
    ///
    /// A table putting its hand up, recorded rather than merely announced. A
    /// notification reaches whoever is looking at a screen in that moment; this reaches
    /// the waiter who was carrying plates when it happened, and the one who takes over
    /// at the end of a shift. A guest who has asked to pay and been forgotten is the
    /// worst few minutes of a meal.
    ///
    /// Kept as a time rather than a flag so the floor can show how long they have been
    /// waiting, which is the part that decides who gets seen first.
    ///
    /// Cleared by nothing. Settling the order ends it, and an order that has been paid
    /// is no longer asking for anything.
    /// </summary>
    public DateTimeOffset? BillRequestedAtUtc { get; set; }

    /// <summary>
    /// The address the order was placed from, or null.
    ///
    /// An audit trail, and deliberately nothing else. It is here so that a flood of
    /// junk orders can be traced to a source and blocked, and so a restaurant arguing
    /// about a disputed order has something to look at.
    ///
    /// It is emphatically not an identity, and nothing in this product may use it as
    /// one. Every phone on a restaurant's wifi shares a single address, so it cannot
    /// tell one table from another - matching a customer by it would hand somebody
    /// else's bill to whoever asked. It is also unstable in the other direction: mobile
    /// networks rotate addresses, and a guest who walks out of wifi range changes theirs
    /// mid-meal. Too coarse to distinguish people and too fickle to follow one.
    ///
    /// Recovering an order is done with the key the customer holds, or by scanning the
    /// code on their table. Both of those name exactly one order.
    /// </summary>
    public string? PlacedFromIp { get; set; }

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
    public ICollection<Payment> Payments { get; } = [];

    /// <summary>
    /// Recomputes the money on the bill from a subtotal and the rates this order holds.
    ///
    /// One method, called from every path that changes what is on the order, because
    /// four places each doing their own arithmetic is four chances to disagree about
    /// what a table owes.
    ///
    /// The order matters and is the Nepalese convention: take the discount off the food,
    /// add the service charge to what is left, then tax the two together. Service charge
    /// is part of the taxable amount rather than something added after tax.
    ///
    /// Everything is rounded to the currency's two places at each step rather than only
    /// at the end. A receipt has to add up when somebody checks it by hand, and a total
    /// carrying a third decimal place that the printed lines do not show is a total that
    /// appears wrong to the person paying it.
    /// </summary>
    /// <param name="subtotal">
    /// The sum of the lines. Passed in rather than read off <see cref="Items"/>, because
    /// the paths that append to an order deliberately compute it without loading every
    /// line - and a navigation that was not loaded would silently zero the bill.
    /// </param>
    public void RecalculateBill(decimal subtotal)
    {
        Subtotal = Round(subtotal);

        // A discount larger than the bill takes it to zero rather than negative. Nobody
        // is owed money for eating here, and the alternative is a bill that pays out.
        var chargeable = Math.Max(0m, Subtotal - Round(DiscountAmount));

        ServiceChargeAmount = Round(chargeable * ServiceChargeRate);
        VatAmount = Round((chargeable + ServiceChargeAmount) * VatRate);
        Total = chargeable + ServiceChargeAmount + VatAmount;
    }

    /// <summary>
    /// To the currency's smallest unit, away from zero.
    ///
    /// Away from zero rather than the default to-even, because to-even is a statistical
    /// convention for reducing bias across many roundings and a bill is not a sample -
    /// it is one number a person is about to hand over, and half a paisa going the
    /// restaurant's way is what everybody expects.
    /// </summary>
    private static decimal Round(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

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
    /// True while the order holds lines a customer added that nobody has agreed to yet,
    /// and the reason such an order reaches the waiter rather than the kitchen. A
    /// waiter's own order is never waiting: they were standing there.
    ///
    /// Read off the lines rather than off the order's origin, and that distinction is
    /// load bearing now that a customer can add to an order a waiter opened. Asking
    /// where the order came from would answer "a waiter" and wave the customer's new
    /// lines straight through to the kitchen with nobody having read them back.
    ///
    /// This is the one condition standing between a customer's order and a pan, and it
    /// closes when a person says so - or when somebody already sent the order to the
    /// kitchen, which says the same thing more loudly. An order being cooked cannot
    /// still need agreeing: sending it was the agreement, and asking a waiter to confirm
    /// food that is already on a stove is a question with no useful answer.
    ///
    /// That last condition is also what carries orders taken before this step existed.
    /// Anything already at the pass is treated as agreed, so introducing the rule does
    /// not strand a live service.
    ///
    /// Requires <see cref="Items"/> to be loaded. A caller that has not loaded them
    /// reads this as true, which errs towards asking for a confirmation rather than
    /// towards letting one be skipped.
    /// </summary>
    public bool NeedsConfirmation =>
        Status == OrderStatus.Open
        && ConfirmedAtUtc is null
        && Items.Any(item => item.AddedByCustomer && !item.IsSubmittedToKitchen);

    /// <summary>
    /// What has been taken so far, across every payment against this order.
    ///
    /// Requires <see cref="Payments"/> to be loaded. A caller that has not loaded them
    /// reads this as zero, which errs towards the order looking unpaid - the safe
    /// direction, since the alternative is closing a bill nobody settled.
    /// </summary>
    public decimal AmountPaid => Payments.Sum(payment => payment.Amount);

    /// <summary>
    /// What is still owed. Never negative: a table that overpaid is owed change, not a
    /// negative bill, and change is handed over at the counter rather than modelled.
    /// </summary>
    public decimal AmountOutstanding => Math.Max(0m, Total - AmountPaid);

    /// <summary>
    /// Whether the bill has been settled in full.
    ///
    /// The whole bill, not the existence of a payment. Half of a split bill is a paid
    /// payment and an unpaid order, and treating the first as the second would close a
    /// table that still owes money.
    /// </summary>
    public bool IsPaid => Payments.Count > 0 && AmountOutstanding <= 0m;

    /// <summary>Whether something has been paid, but not all of it.</summary>
    public bool IsPartlyPaid => Payments.Count > 0 && AmountOutstanding > 0m;

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
    public bool CanSettle =>
        Status == OrderStatus.Open &&
        !IsPaid &&
        UnsentItemCount == 0 &&
        UnfinishedKitchenTicketCount == 0;

    /// <summary>
    /// Whether the order may now be closed.
    ///
    /// Split from <see cref="CanSettle"/> when bills became payable in parts, and the
    /// difference between the two is the whole point: one asks whether money may be
    /// taken, the other whether the bill is finished. A half-paid order answers yes to
    /// the first and no to the second.
    ///
    /// Requires the bill to be paid rather than unpaid, which is the opposite of what
    /// this condition used to say. The old rule was guarding against a second payment
    /// on an order that already had one; that job now belongs to the payment path,
    /// which checks the outstanding amount and refuses to overpay.
    /// </summary>
    public bool CanComplete =>
        Status == OrderStatus.Open &&
        IsPaid &&
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
    /// Staff only. A customer cannot call off their own order at all: the moment one
    /// exists somebody may already be acting on it, and a phone withdrawing an order
    /// behind a waiter's back is a disagreement this product should not create. What a
    /// customer can do is add to it - see <see cref="CanCustomerAddTo"/> - and ask a
    /// member of staff for anything else.
    /// </summary>
    public bool CanCancel => Status == OrderStatus.Open && !IsPaid;

    /// <summary>
    /// Whether the customer who placed this may still add to it themselves.
    ///
    /// Adding is the one change to a running order a customer can make alone, and it is
    /// safe in a way that removing is not: nothing already agreed is withdrawn, nothing
    /// being cooked is affected, and the worst case is a larger bill they asked for.
    ///
    /// The line is the kitchen, not the confirmation. Up to the moment food is sent, an
    /// order is still a list on a screen and another item on it costs nobody anything.
    /// Once a ticket exists the kitchen is working from paper that no longer matches,
    /// and a second round has to be a new conversation so somebody knows to send it.
    ///
    /// Adding after a waiter has confirmed is allowed, and clears the confirmation -
    /// see <see cref="Order.TryConfirm"/> for what that gate protects. Lines nobody has
    /// agreed must not ride into the kitchen on the back of an agreement about
    /// different ones.
    /// </summary>
    /// <summary>Whether this table is waiting to pay.</summary>
    public bool IsBillRequested => BillRequestedAtUtc is not null;

    /// <summary>
    /// Whether the customer may ask for their bill.
    ///
    /// While the order is running and unpaid, which is the whole of it. Asking twice is
    /// allowed and simply moves nothing - see <see cref="TryRequestBill"/> - because a
    /// guest who taps again after five minutes is not making a mistake, they are being
    /// ignored.
    /// </summary>
    public bool CanRequestBill => Status == OrderStatus.Open && !IsPaid;

    /// <summary>
    /// Records that the table has asked to pay.
    ///
    /// Returns false only when there is nothing to ask about: the order has already been
    /// settled or called off. Asking a second time succeeds and deliberately keeps the
    /// original time, because how long somebody has been waiting is the useful fact and
    /// restarting the clock on every tap would hide exactly the tables that have waited
    /// longest.
    /// </summary>
    public bool TryRequestBill(DateTimeOffset now)
    {
        if (!CanRequestBill)
        {
            return false;
        }

        BillRequestedAtUtc ??= now;
        UpdatedAtUtc = now;

        return true;
    }

    public bool CanCustomerAddTo =>
        Status == OrderStatus.Open
        && !IsPaid
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
