using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Domain.Tests.Orders;

/// <summary>
/// Whether an order line has gone to the kitchen.
///
/// This is derived from the existence of a kitchen ticket line, not stored on the
/// order line. That choice is what makes "at most one ticket per line" a database
/// guarantee rather than a rule the service has to remember, so it is worth pinning
/// that the derivation stays a derivation.
/// </summary>
public class OrderItemSubmissionTests
{
    [Fact]
    public void A_line_with_no_ticket_line_has_not_been_sent()
    {
        var item = Line();

        Assert.Null(item.KitchenTicketItem);
        Assert.False(item.IsSubmittedToKitchen);
    }

    [Fact]
    public void A_line_pointed_at_by_a_ticket_line_has_been_sent()
    {
        var item = Line();

        item.KitchenTicketItem = new KitchenTicketItem
        {
            Id = Guid.NewGuid(),
            OrderItemId = item.Id,
            ItemName = item.ItemName,
            Quantity = item.Quantity,
        };

        Assert.True(item.IsSubmittedToKitchen);
    }

    [Fact]
    public void The_unfinished_count_ignores_lines_and_reads_tickets()
    {
        var order = OrderBuilder.Open();
        order.KitchenTickets.Add(new KitchenTicket { Status = KitchenTicketStatus.Ready });

        // The line on this order was never submitted, yet the ticket that exists is
        // finished. Kitchen readiness is about tickets; unsent lines are the waiter
        // business and deliberately do not block closing.
        Assert.False(order.Items.Single().IsSubmittedToKitchen);
        Assert.Equal(0, order.UnfinishedKitchenTicketCount);
        Assert.True(order.CanComplete);
    }

    private static OrderItem Line() =>
        new()
        {
            Id = Guid.NewGuid(),
            OrderId = Guid.NewGuid(),
            MenuItemId = Guid.NewGuid(),
            ItemName = "Chicken Burger",
            UnitPrice = 12.50m,
            Quantity = 2,
            LineTotal = 25.00m,
            CreatedAtUtc = new DateTimeOffset(2026, 8, 24, 19, 0, 0, TimeSpan.Zero),
        };
}
