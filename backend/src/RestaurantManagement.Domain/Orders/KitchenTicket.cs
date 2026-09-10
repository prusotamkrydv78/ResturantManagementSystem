namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// One submission of order lines to the kitchen.
///
/// An order produces a ticket each time the waiter sends work through, so a table
/// that orders drinks first and food later leaves two tickets behind. A ticket is
/// never reopened or added to: the next submission is a new ticket.
///
/// The ticket owns its own workflow. Which transitions are legal, and which
/// timestamps each one writes, are expressed here rather than in a service or a
/// controller, so the rule has one home and the timestamps cannot drift out of step
/// with the status they describe.
/// </summary>
public class KitchenTicket
{
    /// <summary>Primary key. Not shown to kitchen staff.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The restaurant this ticket belongs to. Held alongside the order and bound to
    /// it by a composite foreign key, so a ticket can never reference an order from
    /// a different restaurant.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The order the submitted lines came from.</summary>
    public Guid OrderId { get; set; }

    /// <summary>Navigation to the owning order.</summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Sequential number within the restaurant, starting at 1. This is what the
    /// kitchen calls out, so it runs across all tables rather than restarting per
    /// order: several tickets numbered one on the same rail would be useless.
    /// </summary>
    public int TicketNumber { get; set; }

    /// <summary>Lifecycle state of the ticket itself, not of the order.</summary>
    public KitchenTicketStatus Status { get; set; } = KitchenTicketStatus.Pending;

    /// <summary>When the ticket was sent to the kitchen.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>
    /// When the kitchen started cooking it. Null while the ticket is still waiting,
    /// which is what makes "how long has this been sitting" answerable.
    /// </summary>
    public DateTimeOffset? StartedAtUtc { get; set; }

    /// <summary>When the food reached the pass. Null until then.</summary>
    public DateTimeOffset? ReadyAtUtc { get; set; }

    /// <summary>
    /// When a waiter took the food to the table, or null while it is still at the pass.
    ///
    /// Deliberately a timestamp on the ticket rather than a fourth
    /// <see cref="KitchenTicketStatus"/>. Serving is floor work: the kitchen has
    /// finished, and folding it into the kitchen's own status would make the rail
    /// responsible for something nobody in the kitchen can see. The status stays the
    /// kitchen's, and this is the floor's.
    ///
    /// It is what gives "the food is ready" an ending. Without it a ticket sits at the
    /// pass reading Ready for the rest of the evening, and the next waiter to look
    /// cannot tell whether it has already gone to the table.
    /// </summary>
    public DateTimeOffset? ServedAtUtc { get; set; }

    /// <summary>
    /// Who took it over, or null. Recorded for the same reason the confirmation is:
    /// when a table says the food never arrived, this is the person who knows.
    /// </summary>
    public Guid? ServedByStaffId { get; set; }

    /// <summary>When the ticket was last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// Row version maintained by the database, used for optimistic concurrency.
    ///
    /// Two chefs reaching for the same ticket is the normal case in a kitchen, not
    /// an edge case. Checking the status before writing is not enough on its own,
    /// because both requests can read Pending before either writes; this makes the
    /// second write fail rather than quietly restamping a ticket the first one had
    /// already moved.
    /// </summary>
    public byte[] RowVersion { get; set; } = [];

    /// <summary>The lines on this ticket.</summary>
    public ICollection<KitchenTicketItem> Items { get; } = [];

    /// <summary>
    /// Whether the ticket is still kitchen work. Ready tickets are finished as far
    /// as this phase is concerned, so they drop out of the queue.
    /// </summary>
    public bool IsActiveWork =>
        Status is KitchenTicketStatus.Pending or KitchenTicketStatus.Preparing;

    /// <summary>Whether the kitchen may start cooking this ticket.</summary>
    public bool CanStart => Status == KitchenTicketStatus.Pending;

    /// <summary>Whether the ticket may be sent to the pass.</summary>
    public bool CanMarkReady => Status == KitchenTicketStatus.Preparing;

    /// <summary>
    /// Whether the kitchen may take this ticket back off the pass.
    ///
    /// Only while nothing on it has been carried. It used to ask whether the *ticket*
    /// had been served, which stopped being the right question once a waiter could take
    /// one dish and leave the rest: a ticket with the samosa eaten and the momo still at
    /// the pass is not served, and recalling it would have un-cooked a dish somebody was
    /// halfway through.
    /// </summary>
    public bool CanRecall =>
        Status == KitchenTicketStatus.Ready && !Items.Any(item => item.IsServed);

    /// <summary>How many dishes on this ticket are cooked.</summary>
    public int ReadyItemCount => Items.Count(item => item.IsReady);

    /// <summary>How many are cooked and still sitting at the pass.</summary>
    public int WaitingAtPassCount => Items.Count(item => item.IsWaitingAtPass);

    /// <summary>Whether the food has been taken to the table.</summary>
    public bool IsServed => ServedAtUtc is not null;

    /// <summary>
    /// Whether a waiter may mark this as delivered.
    ///
    /// Only from the pass, and only once. Food that has not been cooked cannot be
    /// carried anywhere, and a second waiter arriving at an empty pass should be told
    /// somebody beat them to it rather than silently restamping the ticket.
    /// </summary>
    public bool CanServe => Items.Any(item => item.IsWaitingAtPass);

    /// <summary>
    /// Whether this ticket has anything waiting at the pass for somebody to carry.
    ///
    /// The waiter's half of the kitchen rail: what the floor still has to do. True as
    /// soon as one dish on it is cooked and untaken, rather than waiting for the whole
    /// slip - the samosa being ready is work for the floor whether or not the momo is.
    /// </summary>
    public bool IsWaitingAtPass => Items.Any(item => item.IsWaitingAtPass);

    /// <summary>
    /// Starts cooking: Pending becomes Preparing and the start time is recorded.
    ///
    /// Returns false when the transition is not legal from the current state, which
    /// includes a ticket someone else already started. The caller reports that as a
    /// conflict rather than treating it as success.
    /// </summary>
    public bool TryStart(DateTimeOffset now)
    {
        if (!CanStart)
        {
            return false;
        }

        Status = KitchenTicketStatus.Preparing;
        StartedAtUtc = now;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Sends the ticket to the pass: Preparing becomes Ready and the ready time is
    /// recorded.
    ///
    /// Pending cannot jump straight here. A ticket nobody started cannot be cooked,
    /// and allowing the skip would leave a Ready ticket with no start time, making
    /// the timestamps unable to describe what happened.
    /// </summary>
    public bool TryMarkReady(DateTimeOffset now)
    {
        if (!CanMarkReady)
        {
            return false;
        }

        // Everything still cooking is now cooked. The whole-ticket button is a
        // shorthand for ticking every remaining line, not a separate state that could
        // disagree with them.
        foreach (var item in Items)
        {
            item.TryMarkReady(now);
        }

        Status = KitchenTicketStatus.Ready;
        ReadyAtUtc = now;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Records that one dish on this ticket is cooked, and closes the ticket if it was
    /// the last one.
    /// </summary>
    /// <remarks>
    /// This is the point of per-line state. The kitchen ticks off what is done as it is
    /// done; the ticket reaching Ready is a consequence rather than a decision, so the
    /// ticket and its lines can never say different things about the same food.
    ///
    /// Allowed while the ticket is Pending as well as Preparing, and starts it if so: a
    /// chef who ticks a dish has plainly begun, and refusing the tick to make them press
    /// Start first would be the software asking to be told something it can see.
    /// </remarks>
    public bool TryMarkItemReady(Guid itemId, DateTimeOffset now)
    {
        if (Status == KitchenTicketStatus.Ready)
        {
            return false;
        }

        var item = Items.FirstOrDefault(candidate => candidate.Id == itemId);

        if (item is null || !item.TryMarkReady(now))
        {
            return false;
        }

        StartedAtUtc ??= now;

        if (Status == KitchenTicketStatus.Pending)
        {
            Status = KitchenTicketStatus.Preparing;
        }

        // The last line closes the ticket. Checked after the tick rather than before,
        // so the answer describes the state the tick produced.
        if (Items.All(candidate => candidate.IsReady))
        {
            Status = KitchenTicketStatus.Ready;
            ReadyAtUtc = now;
        }

        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Puts one cooked dish back on the stove, reopening the ticket if it had closed.
    /// </summary>
    public bool TryRecallItem(Guid itemId, DateTimeOffset now)
    {
        var item = Items.FirstOrDefault(candidate => candidate.Id == itemId);

        if (item is null || !item.TryRecall())
        {
            return false;
        }

        Status = KitchenTicketStatus.Preparing;
        ReadyAtUtc = null;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Takes a ticket back off the pass: Ready becomes Preparing again.
    ///
    /// Every other step here is one-way, and this one exists because the step before
    /// it is the easiest to get wrong. Marking ready is a single tap on a rail of
    /// identical cards, it sends a waiter walking to a pass that may have nothing on
    /// it, and until now there was no way back from it - not even a way to see what had
    /// been done, because the ticket left the rail in the same instant.
    ///
    /// The ready time is cleared rather than kept. It exists to say how long a plate
    /// has been waiting at the pass, and a plate that was never really at the pass has
    /// not been waiting; leaving the stamp behind would age a ticket from a moment that
    /// turned out not to have happened. What is kept is the start time, because the
    /// cooking did happen and is still happening.
    ///
    /// Refused once a waiter has taken it, and the caller reports that as a conflict.
    /// </summary>
    public bool TryRecall(DateTimeOffset now)
    {
        if (!CanRecall)
        {
            return false;
        }

        // Every line goes back on the stove with it, for the same reason the whole
        // ticket button ticks them all: the ticket is a summary of its lines and must
        // not be able to contradict them.
        foreach (var item in Items)
        {
            item.TryRecall();
        }

        Status = KitchenTicketStatus.Preparing;
        ReadyAtUtc = null;
        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Records that a waiter carried one dish to the table, and closes the ticket if it
    /// was the last one still at the pass.
    /// </summary>
    /// <remarks>
    /// The floor's half of per-line state. A waiter who can be handed one finished dish
    /// can carry one finished dish, and a guest who has eaten it should not be told
    /// their order is still waiting.
    /// </remarks>
    public bool TryServeItem(Guid itemId, Guid servedByStaffId, DateTimeOffset now)
    {
        var item = Items.FirstOrDefault(candidate => candidate.Id == itemId);

        if (item is null || !item.TryServe(now))
        {
            return false;
        }

        // The ticket counts as served once nothing is left at the pass. Recorded
        // against whoever carried the last of it, which is the same answer the
        // whole-ticket path gives.
        if (Items.All(candidate => candidate.IsServed))
        {
            ServedAtUtc = now;
            ServedByStaffId = servedByStaffId;
        }

        UpdatedAtUtc = now;

        return true;
    }

    /// <summary>
    /// Records that a waiter carried this ticket to the table.
    ///
    /// Returns false when there was nothing to carry - the food is not at the pass, or
    /// another waiter already took it. False rather than an exception, because two
    /// waiters reaching the same pass at the same moment is an ordinary service.
    ///
    /// Does not touch <see cref="Status"/>. The kitchen said Ready and that stays true;
    /// what changed is whose hands the plate is in.
    /// </summary>
    public bool TryServe(Guid servedByStaffId, DateTimeOffset now)
    {
        if (!CanServe)
        {
            return false;
        }

        // Shorthand for carrying everything still at the pass, so the ticket cannot
        // report itself served over lines that say otherwise.
        foreach (var item in Items)
        {
            item.TryServe(now);
        }

        ServedAtUtc = now;
        ServedByStaffId = servedByStaffId;
        UpdatedAtUtc = now;

        return true;
    }
}
