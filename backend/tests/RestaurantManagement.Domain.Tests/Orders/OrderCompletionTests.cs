using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Domain.Tests.Orders;

/// <summary>
/// The rules that decide whether an order may be paid for and closed.
///
/// These live on the entity so the service, the response the manager is shown, and
/// the write path all answer the same question. That is exactly what makes them worth
/// pinning here: a change that loosens one of these conditions would silently loosen
/// every caller at once.
/// </summary>
public class OrderCompletionTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 8, 24, 19, 30, 0, TimeSpan.Zero);

    [Fact]
    public void An_open_unpaid_order_with_no_kitchen_work_can_be_completed()
    {
        var order = OrderBuilder.Open();

        Assert.True(order.CanComplete);
        Assert.True(order.TryComplete(Now));

        Assert.Equal(OrderStatus.Completed, order.Status);
        Assert.Equal(Now, order.CompletedAtUtc);
    }

    [Fact]
    public void Completing_an_order_records_when_it_closed()
    {
        var order = OrderBuilder.Open();

        order.TryComplete(Now);

        // A completed order with no closing time would be a hole in the history, and
        // a database constraint refuses it, so the entity must never produce one.
        Assert.NotNull(order.CompletedAtUtc);
        Assert.Equal(Now, order.UpdatedAtUtc);
    }

    [Fact]
    public void A_completed_order_is_no_longer_editable()
    {
        var order = OrderBuilder.Open();

        Assert.True(order.IsEditable);

        order.TryComplete(Now);

        // This one property is what locks the whole waiter workflow out of a closed
        // order: every edit and every kitchen submission asks it first.
        Assert.False(order.IsEditable);
    }

    [Fact]
    public void An_order_cannot_be_completed_twice()
    {
        var order = OrderBuilder.Open();
        order.TryComplete(Now);

        var second = order.TryComplete(Now.AddMinutes(5));

        Assert.False(second);
        // The first closing time must survive the second attempt.
        Assert.Equal(Now, order.CompletedAtUtc);
    }

    [Fact]
    public void A_paid_order_cannot_be_completed_again()
    {
        var order = OrderBuilder.Open();
        order.Payment = PaymentFor(order);

        Assert.False(order.CanComplete);
        Assert.False(order.TryComplete(Now));
    }

    [Fact]
    public void An_order_with_an_unfinished_kitchen_ticket_cannot_be_completed()
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Pending });

        Assert.Equal(1, order.UnfinishedKitchenTicketCount);
        Assert.False(order.CanComplete);
        Assert.False(order.TryComplete(Now));
    }

    [Theory]
    [InlineData(KitchenTicketStatus.Pending)]
    [InlineData(KitchenTicketStatus.Preparing)]
    public void Any_ticket_short_of_ready_blocks_completion(KitchenTicketStatus status)
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Ready });
        order.KitchenTickets.Add(new KitchenTicket { Status = status });

        // One unfinished ticket among finished ones is still unfinished work.
        Assert.False(order.CanComplete);
    }

    [Fact]
    public void An_order_whose_every_ticket_is_ready_can_be_completed()
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Ready });
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Ready });

        Assert.Equal(0, order.UnfinishedKitchenTicketCount);
        Assert.True(order.CanComplete);
    }

    [Fact]
    public void An_order_that_never_reached_the_kitchen_can_still_be_completed()
    {
        var order = OrderBuilder.Open();

        // A table that only ordered drinks raises no ticket, and must not be held
        // hostage to a kitchen that was never involved.
        Assert.Empty(order.KitchenTickets);
        Assert.True(order.CanComplete);
    }

    [Fact]
    public void A_cancelled_order_cannot_be_completed()
    {
        var order = OrderBuilder.Open();
        order.TryCancel(Guid.NewGuid(), "Guests left", Now);

        Assert.False(order.CanComplete);
        Assert.False(order.TryComplete(Now.AddMinutes(1)));
        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.Null(order.CompletedAtUtc);
    }

    private static Payment PaymentFor(Order order) =>
        new()
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            RestaurantId = order.RestaurantId,
            Amount = order.Subtotal,
            Method = PaymentMethod.Cash,
            RecordedByUserId = Guid.NewGuid(),
            RecordedAtUtc = Now,
        };
}
