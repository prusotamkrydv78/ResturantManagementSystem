using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// What happens when two people act on the same thing at the same moment.
///
/// This is not a hypothetical in a restaurant: two chefs reach for the same ticket,
/// and two managers settle the same table. Every case here is set up so both callers
/// genuinely read the record before either writes, which is the situation an
/// application-level status check cannot survive on its own. What separates them is a
/// row version, and these tests are the only place that is demonstrated rather than
/// asserted in a comment.
///
/// Each caller gets its own context, because two requests do.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class ConcurrencyTests
{
    private readonly TestDatabase _database;

    public ConcurrencyTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task Two_chefs_starting_the_same_ticket_cannot_both_succeed()
    {
        var scenario = await SeedAsync("TwoChefs");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);
        var ticketId = submitted.Ticket.Id;

        await using var first = _database.NewContext();
        await using var second = _database.NewContext();

        // Both load the ticket while it is still Pending, so both pass the status
        // check. Only the write can separate them from here.
        var firstTicket = await first.KitchenTickets.SingleAsync(t => t.Id == ticketId);
        var secondTicket = await second.KitchenTickets.SingleAsync(t => t.Id == ticketId);

        Assert.Equal(KitchenTicketStatus.Pending, firstTicket.Status);
        Assert.Equal(KitchenTicketStatus.Pending, secondTicket.Status);

        var firstResult = await Services.Kitchen(first).StartAsync(
            scenario.ChefId,
            ticketId,
            CancellationToken.None);

        var secondResult = await Services.Kitchen(second).StartAsync(
            scenario.ChefId,
            ticketId,
            CancellationToken.None);

        Assert.True(firstResult.IsSuccess, firstResult.Error?.Message);
        Assert.True(secondResult.IsFailure);

        // One start time, not two, and the ticket is being cooked exactly once.
        await using var check = _database.NewContext();
        var stored = await check.KitchenTickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == ticketId);

        Assert.Equal(KitchenTicketStatus.Preparing, stored.Status);
        Assert.NotNull(stored.StartedAtUtc);
    }

    [Fact]
    public async Task Two_managers_settling_the_same_order_cannot_both_succeed()
    {
        var scenario = await SeedAsync("TwoManagers");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var first = _database.NewContext();
        await using var second = _database.NewContext();

        // Both load the order before either writes, so both see it open and unpaid.
        var firstOrder = await first.Orders
            .Include(o => o.Payment)
            .SingleAsync(o => o.Id == order.Id);
        var secondOrder = await second.Orders
            .Include(o => o.Payment)
            .SingleAsync(o => o.Id == order.Id);

        Assert.Null(firstOrder.Payment);
        Assert.Null(secondOrder.Payment);

        var firstResult = await Settle(first, scenario, order.Id);
        var secondResult = await Settle(second, scenario, order.Id);

        Assert.True(firstResult.IsSuccess, firstResult.Error?.Message);
        Assert.True(secondResult.IsFailure);

        await using var check = _database.NewContext();
        // Exactly one payment. This is the case the unique index exists for, and the
        // one an application check alone would let through.
        Assert.Equal(
            1,
            await check.Payments.CountAsync(p => p.OrderId == order.Id));
        Assert.Equal(
            OrderStatus.Completed,
            await Flow.OrderStatusAsync(_database, order.Id));
    }

    [Fact]
    public async Task Settling_and_cancelling_at_once_cannot_both_succeed()
    {
        var scenario = await SeedAsync("SettleVsCancel");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var settling = _database.NewContext();
        await using var cancelling = _database.NewContext();

        await settling.Orders.Include(o => o.Payment).SingleAsync(o => o.Id == order.Id);
        await cancelling.Orders.Include(o => o.Payment).SingleAsync(o => o.Id == order.Id);

        var settled = await Settle(settling, scenario, order.Id);

        var cancelled = await Services.Billing(cancelling).CancelOrderAsync(
            scenario.ManagerId,
            order.Id,
            new CancelOrderRequest { Reason = "Guests changed their mind" },
            CancellationToken.None);

        // An order has one ending. Whichever wins, the other must be refused rather
        // than both being stamped onto the same record.
        Assert.True(settled.IsSuccess, settled.Error?.Message);
        Assert.True(cancelled.IsFailure);

        await using var check = _database.NewContext();
        var stored = await check.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id);

        Assert.Equal(OrderStatus.Completed, stored.Status);
        Assert.NotNull(stored.CompletedAtUtc);
        Assert.Null(stored.CancelledAtUtc);
        Assert.Null(stored.CancellationReason);
    }

    [Fact]
    public async Task Two_waiters_submitting_the_same_order_cannot_both_succeed()
    {
        var scenario = await SeedAsync("TwoSubmits");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var first = _database.NewContext();
        await using var second = _database.NewContext();

        var firstResult = await Services.Orders(first).SubmitToKitchenAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        var secondResult = await Services.Orders(second).SubmitToKitchenAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        Assert.True(firstResult.IsSuccess, firstResult.Error?.Message);
        // The kitchen must never be told to cook the same food twice.
        Assert.True(secondResult.IsFailure);

        await using var check = _database.NewContext();
        Assert.Equal(1, await check.KitchenTickets.CountAsync(t => t.OrderId == order.Id));
    }

    [Fact]
    public async Task A_stale_row_version_is_refused_when_editing_an_order()
    {
        var scenario = await SeedAsync("StaleEdit");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var staleVersion = order.RowVersion;
        var lineId = order.Items.Single().Id;

        // Somebody else saves first, which moves the row version.
        await using (var other = _database.NewContext())
        {
            var moved = await Services.Orders(other).UpdateAsync(
                scenario.WaiterId,
                order.Id,
                new Application.Orders.Dtos.UpdateOrderRequest
                {
                    Lines = [new Application.Orders.Dtos.UpdateOrderLineRequest
                    {
                        Id = lineId,
                        Quantity = 4,
                    }],
                    RowVersion = staleVersion,
                },
                CancellationToken.None);

            Assert.True(moved.IsSuccess, moved.Error?.Message);
        }

        await using var mine = _database.NewContext();
        var result = await Services.Orders(mine).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new Application.Orders.Dtos.UpdateOrderRequest
            {
                Lines = [new Application.Orders.Dtos.UpdateOrderLineRequest
                {
                    Id = lineId,
                    Quantity = 9,
                }],
                // The version this caller loaded before the other save.
                RowVersion = staleVersion,
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);

        await using var check = _database.NewContext();
        var line = await check.OrderItems.AsNoTracking().SingleAsync(i => i.OrderId == order.Id);

        // The first save survives. A stale edit must not silently overwrite it.
        Assert.Equal(4, line.Quantity);
    }

    private static Task<Shared.Results.Result<RecordPaymentResponse>> Settle(
        ApplicationDbContext context,
        Scenario scenario,
        Guid orderId) =>
        Services.Billing(context).RecordPaymentAsync(
            scenario.ManagerId,
            orderId,
            new RecordPaymentRequest { Method = PaymentMethod.Cash },
            CancellationToken.None);

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
