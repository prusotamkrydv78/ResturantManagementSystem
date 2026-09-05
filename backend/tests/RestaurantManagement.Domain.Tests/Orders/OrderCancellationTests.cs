using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Domain.Tests.Orders;

/// <summary>
/// The rules that decide whether an order may be called off, and what a cancellation
/// must record.
///
/// The interesting rule here is the one that is deliberately absent: the kitchen does
/// not block a cancellation. If someone ever "tightens" that, an order whose food is
/// still cooking becomes impossible to close at all, because there is no refund path
/// and no way to un-cook a plate. The test below exists to make that regression loud.
/// </summary>
public class OrderCancellationTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 8, 24, 19, 30, 0, TimeSpan.Zero);

    private static readonly Guid Manager = Guid.NewGuid();

    [Fact]
    public void An_open_unpaid_order_can_be_cancelled()
    {
        var order = OrderBuilder.Open();

        Assert.True(order.CanCancel);
        Assert.True(order.TryCancel(Manager, "Guests left", Now));

        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void Cancelling_records_when_who_and_why_together()
    {
        var order = OrderBuilder.Open();

        order.TryCancel(Manager, "Order entered on the wrong table", Now);

        // All three or none: a cancelled order missing any of them is the missing
        // history this state exists to prevent, and a check constraint refuses it.
        Assert.Equal(Now, order.CancelledAtUtc);
        Assert.Equal(Manager, order.CancelledByUserId);
        Assert.Equal("Order entered on the wrong table", order.CancellationReason);
    }

    [Fact]
    public void Cancelling_does_not_set_a_completion_time()
    {
        var order = OrderBuilder.Open();

        order.TryCancel(Manager, "Guests left", Now);

        // An order has one ending. Both timestamps set would make it unanswerable.
        Assert.Null(order.CompletedAtUtc);
    }

    [Fact]
    public void A_cancelled_order_is_no_longer_editable()
    {
        var order = OrderBuilder.Open();

        order.TryCancel(Manager, "Guests left", Now);

        Assert.False(order.IsEditable);
    }

    [Fact]
    public void An_order_cannot_be_cancelled_twice()
    {
        var order = OrderBuilder.Open();
        order.TryCancel(Manager, "First reason", Now);

        var second = order.TryCancel(Guid.NewGuid(), "Second reason", Now.AddMinutes(5));

        Assert.False(second);
        // The original record must survive: a second attempt cannot rewrite who
        // cancelled it or why.
        Assert.Equal("First reason", order.CancellationReason);
        Assert.Equal(Manager, order.CancelledByUserId);
        Assert.Equal(Now, order.CancelledAtUtc);
    }

    [Fact]
    public void A_completed_order_cannot_be_cancelled()
    {
        var order = OrderBuilder.Open();
        order.TryComplete(Now);

        Assert.False(order.CanCancel);
        Assert.False(order.TryCancel(Manager, "Changed my mind", Now.AddMinutes(1)));
        Assert.Equal(OrderStatus.Completed, order.Status);
        Assert.Null(order.CancellationReason);
    }

    [Fact]
    public void A_paid_order_cannot_be_cancelled()
    {
        var order = OrderBuilder.Open();
        order.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            RestaurantId = order.RestaurantId,
            Amount = order.Total,
            Method = PaymentMethod.Card,
            RecordedByUserId = Manager,
            RecordedAtUtc = Now,
        });

        // There is no refund in this product, so cancelling a paid order would leave a
        // record saying money was taken for something that never happened.
        Assert.False(order.CanCancel);
        Assert.False(order.TryCancel(Manager, "Guests left", Now));
    }

    [Theory]
    [InlineData(KitchenTicketStatus.Pending)]
    [InlineData(KitchenTicketStatus.Preparing)]
    [InlineData(KitchenTicketStatus.Ready)]
    public void The_kitchen_never_blocks_a_cancellation(KitchenTicketStatus status)
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = status });

        // Deliberate, and the opposite of the completion rule. Waiting for the kitchen
        // to finish food nobody will pay for would strand the order open forever.
        Assert.True(order.CanCancel);
        Assert.True(order.TryCancel(Manager, "Guests walked out", Now));
    }

    [Fact]
    public void Cancelling_leaves_kitchen_tickets_exactly_as_they_were()
    {
        var order = OrderBuilder.Open();
        var ticket = new KitchenTicket
        {
            Status = KitchenTicketStatus.Preparing,
            StartedAtUtc = Now.AddMinutes(-10),
        };
        order.KitchenTickets.Add(ticket);

        order.TryCancel(Manager, "Guests walked out", Now);

        // A ticket records work the kitchen really did. The order ending badly does
        // not make that untrue, so nothing about it may move.
        Assert.Equal(KitchenTicketStatus.Preparing, ticket.Status);
        Assert.Equal(Now.AddMinutes(-10), ticket.StartedAtUtc);
        Assert.Single(order.KitchenTickets);
    }

    [Fact]
    public void Cancelling_leaves_the_order_lines_and_total_untouched()
    {
        var order = OrderBuilder.Open();
        var line = order.Items.Single();

        order.TryCancel(Manager, "Guests left", Now);

        // Nothing is deleted. The order keeps its number, its lines and their prices.
        Assert.Single(order.Items);
        Assert.Equal(12.50m, line.LineTotal);
        Assert.Equal(12.50m, order.Subtotal);
        Assert.Equal(1, order.OrderNumber);
    }

    [Fact]
    public void Started_kitchen_tickets_are_counted_so_the_cost_can_be_shown()
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Pending });
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Preparing });
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Ready });

        // Not a rule, a warning: this is what tells the manager what calling the order
        // off actually throws away.
        Assert.Equal(2, order.StartedKitchenTicketCount);
    }
}
