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

    /// <summary>Whether the food has been taken to the table.</summary>
    public bool IsServed => ServedAtUtc is not null;

    /// <summary>
    /// Whether a waiter may mark this as delivered.
    ///
    /// Only from the pass, and only once. Food that has not been cooked cannot be
    /// carried anywhere, and a second waiter arriving at an empty pass should be told
    /// somebody beat them to it rather than silently restamping the ticket.
    /// </summary>
    public bool CanServe => Status == KitchenTicketStatus.Ready && !IsServed;

    /// <summary>
    /// Whether this ticket is waiting at the pass for somebody to carry it.
    ///
    /// The waiter's half of the kitchen rail: what the floor still has to do. Cooked,
    /// and not yet taken to the table.
    /// </summary>
    public bool IsWaitingAtPass => Status == KitchenTicketStatus.Ready && !IsServed;

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

        Status = KitchenTicketStatus.Ready;
        ReadyAtUtc = now;
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

        ServedAtUtc = now;
        ServedByStaffId = servedByStaffId;
        UpdatedAtUtc = now;

        return true;
    }
}
