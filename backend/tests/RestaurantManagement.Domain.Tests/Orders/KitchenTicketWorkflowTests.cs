using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Domain.Tests.Orders;

/// <summary>
/// The kitchen workflow: Pending, then Preparing, then Ready, one way only.
///
/// Two things are worth pinning. The skip from Pending straight to Ready must stay
/// refused, because a finished ticket with no start time cannot describe what
/// happened. And each transition must stamp its own timestamp, so status and history
/// cannot drift apart.
/// </summary>
public class KitchenTicketWorkflowTests
{
    private static readonly DateTimeOffset Sent =
        new(2026, 8, 24, 19, 0, 0, TimeSpan.Zero);

    private static readonly DateTimeOffset Started = Sent.AddMinutes(4);
    private static readonly DateTimeOffset Ready = Sent.AddMinutes(15);

    [Fact]
    public void A_new_ticket_is_pending_with_neither_timestamp_set()
    {
        var ticket = Pending();

        Assert.Equal(KitchenTicketStatus.Pending, ticket.Status);
        Assert.Null(ticket.StartedAtUtc);
        Assert.Null(ticket.ReadyAtUtc);
    }

    [Fact]
    public void Starting_a_pending_ticket_moves_it_to_preparing_and_stamps_the_start()
    {
        var ticket = Pending();

        Assert.True(ticket.CanStart);
        Assert.True(ticket.TryStart(Started));

        Assert.Equal(KitchenTicketStatus.Preparing, ticket.Status);
        Assert.Equal(Started, ticket.StartedAtUtc);
        // Still cooking, so there is no time at the pass yet.
        Assert.Null(ticket.ReadyAtUtc);
    }

    [Fact]
    public void Marking_a_preparing_ticket_ready_stamps_the_pass_and_keeps_the_start()
    {
        var ticket = Pending();
        ticket.TryStart(Started);

        Assert.True(ticket.CanMarkReady);
        Assert.True(ticket.TryMarkReady(Ready));

        Assert.Equal(KitchenTicketStatus.Ready, ticket.Status);
        Assert.Equal(Started, ticket.StartedAtUtc);
        Assert.Equal(Ready, ticket.ReadyAtUtc);
    }

    [Fact]
    public void A_pending_ticket_cannot_skip_straight_to_ready()
    {
        var ticket = Pending();

        Assert.False(ticket.CanMarkReady);
        Assert.False(ticket.TryMarkReady(Ready));

        // Nothing moved, and in particular no ready time was written against a ticket
        // nobody ever started.
        Assert.Equal(KitchenTicketStatus.Pending, ticket.Status);
        Assert.Null(ticket.ReadyAtUtc);
        Assert.Null(ticket.StartedAtUtc);
    }

    [Fact]
    public void A_ticket_cannot_be_started_twice()
    {
        var ticket = Pending();
        ticket.TryStart(Started);

        var second = ticket.TryStart(Started.AddMinutes(3));

        // This is the check that stops two chefs both claiming the same ticket. The
        // row version catches the concurrent case; this catches the sequential one.
        Assert.False(second);
        Assert.Equal(Started, ticket.StartedAtUtc);
    }

    [Fact]
    public void A_ready_ticket_cannot_be_started()
    {
        var ticket = Pending();
        ticket.TryStart(Started);
        ticket.TryMarkReady(Ready);

        Assert.False(ticket.CanStart);
        Assert.False(ticket.TryStart(Ready.AddMinutes(1)));
        Assert.Equal(KitchenTicketStatus.Ready, ticket.Status);
    }

    [Fact]
    public void A_ready_ticket_cannot_be_marked_ready_again()
    {
        var ticket = Pending();
        ticket.TryStart(Started);
        ticket.TryMarkReady(Ready);

        var second = ticket.TryMarkReady(Ready.AddMinutes(5));

        Assert.False(second);
        Assert.Equal(Ready, ticket.ReadyAtUtc);
    }

    [Fact]
    public void The_workflow_never_runs_backwards()
    {
        var ticket = Pending();
        ticket.TryStart(Started);
        ticket.TryMarkReady(Ready);

        // There is no transition out of Ready at all. Both attempts above already
        // failed; this asserts the terminal state directly so a new backwards method
        // would have to break it deliberately.
        Assert.False(ticket.CanStart);
        Assert.False(ticket.CanMarkReady);
        Assert.False(ticket.IsActiveWork);
    }

    [Theory]
    [InlineData(KitchenTicketStatus.Pending, true)]
    [InlineData(KitchenTicketStatus.Preparing, true)]
    [InlineData(KitchenTicketStatus.Ready, false)]
    public void Only_unfinished_tickets_count_as_work_on_the_rail(
        KitchenTicketStatus status,
        bool expected)
    {
        var ticket = Pending();
        ticket.Status = status;

        // This is what keeps finished tickets off the kitchen screen and out of the
        // count that blocks settling an order.
        Assert.Equal(expected, ticket.IsActiveWork);
    }

    private static KitchenTicket Pending() =>
        new()
        {
            Id = Guid.NewGuid(),
            RestaurantId = Guid.NewGuid(),
            OrderId = Guid.NewGuid(),
            TicketNumber = 7,
            Status = KitchenTicketStatus.Pending,
            CreatedAtUtc = Sent,
            UpdatedAtUtc = Sent,
        };
}
