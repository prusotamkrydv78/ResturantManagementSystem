using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// Payment and completion: the rules that decide whether money can be taken, how much,
/// and what closing an order may not do.
///
/// The amount rule is the one worth being loudest about. A client never states what a
/// table paid, so a change that started trusting a request figure would be a way to
/// undercharge a bill; the test below asserts the stored amount against the server
/// own total rather than against anything the caller supplied.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class PaymentAndCompletionTests
{
    private readonly TestDatabase _database;

    public PaymentAndCompletionTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task Settling_records_the_amount_from_the_server_order_total()
    {
        var scenario = await SeedAsync("Amount");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 3);
        var settled = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(settled.IsSuccess, settled.Error?.Message);

        await using var context = _database.NewContext();
        var payment = await context.Payments
            .AsNoTracking()
            .SingleAsync(candidate => candidate.OrderId == order.Id);

        // Three at the seeded price, calculated by the server from its own menu. The
        // request carried no figure at all.
        Assert.Equal(scenario.MenuItemPrice * 3, payment.Amount);
        Assert.Equal(order.Subtotal, payment.Amount);
    }

    [Fact]
    public async Task Settling_records_who_took_it_and_how()
    {
        var scenario = await SeedAsync("Recorded");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id, PaymentMethod.Digital);

        await using var context = _database.NewContext();
        var payment = await context.Payments
            .AsNoTracking()
            .SingleAsync(candidate => candidate.OrderId == order.Id);

        Assert.Equal(PaymentMethod.Digital, payment.Method);
        // Somebody has to be answerable for a cash figure.
        Assert.Equal(scenario.ManagerId, payment.RecordedByUserId);
        Assert.Equal(scenario.RestaurantId, payment.RestaurantId);
    }

    [Fact]
    public async Task Settling_closes_the_order_and_stamps_when()
    {
        var scenario = await SeedAsync("Closes");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var stored = await context.Orders
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == order.Id);

        Assert.Equal(OrderStatus.Completed, stored.Status);
        Assert.NotNull(stored.CompletedAtUtc);
        Assert.Null(stored.CancelledAtUtc);
    }

    [Fact]
    public async Task An_order_cannot_be_settled_twice()
    {
        var scenario = await SeedAsync("Twice");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        var first = await Flow.SettleAsync(_database, scenario, order.Id);
        var second = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(first.IsSuccess, first.Error?.Message);
        Assert.True(second.IsFailure);

        await using var context = _database.NewContext();
        // One payment, not two. Charging a table twice is the failure worth making
        // impossible rather than unlikely.
        Assert.Equal(
            1,
            await context.Payments.CountAsync(candidate => candidate.OrderId == order.Id));
    }

    [Fact]
    public async Task A_second_payment_row_is_refused_by_the_database()
    {
        var scenario = await SeedAsync("UniqueIndex");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();

        // Straight past the service, to prove the guarantee is in the schema rather
        // than only in application logic. Two managers racing cannot both read "not
        // paid" and both write, because this index refuses the second row.
        context.Payments.Add(new Payment
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = scenario.RestaurantId,
            OrderId = order.Id,
            Amount = 1m,
            Method = PaymentMethod.Cash,
            RecordedByUserId = scenario.ManagerId,
            RecordedAtUtc = DateTimeOffset.UtcNow,
        });

        var failure = await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        Assert.Contains("IX_Payments_OrderId", failure.InnerException?.Message ?? string.Empty);
    }

    [Fact]
    public async Task An_order_with_unfinished_kitchen_work_cannot_be_settled()
    {
        var scenario = await SeedAsync("KitchenBusy");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        var refused = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(refused.IsFailure);

        await using var context = _database.NewContext();
        // Nothing was written: no payment, and the order is still open.
        Assert.False(await context.Payments.AnyAsync(p => p.OrderId == order.Id));
        Assert.Equal(OrderStatus.Open, await Flow.OrderStatusAsync(_database, order.Id));
    }

    [Fact]
    public async Task An_order_whose_kitchen_work_is_finished_can_be_settled()
    {
        var scenario = await SeedAsync("KitchenDone");

        var order = await Flow.PlaceAndFinishKitchenAsync(_database, scenario);

        var settled = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(settled.IsSuccess, settled.Error?.Message);
        Assert.Equal(
            OrderStatus.Completed,
            await Flow.OrderStatusAsync(_database, order.Id));
    }

    [Fact]
    public async Task A_paid_order_cannot_be_cancelled()
    {
        var scenario = await SeedAsync("PaidCancel");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id);

        var refused = await Flow.CancelAsync(_database, scenario, order.Id);

        // There is no refund in this product, so cancelling a paid order would record
        // that money was taken for something that never happened.
        Assert.True(refused.IsFailure);
        Assert.Equal(
            OrderStatus.Completed,
            await Flow.OrderStatusAsync(_database, order.Id));
    }

    [Fact]
    public async Task A_cancelled_order_cannot_be_settled()
    {
        var scenario = await SeedAsync("CancelledSettle");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.CancelAsync(_database, scenario, order.Id);

        var refused = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(refused.IsFailure);

        await using var context = _database.NewContext();
        Assert.False(await context.Payments.AnyAsync(p => p.OrderId == order.Id));
    }

    [Fact]
    public async Task Closing_an_order_never_touches_its_line_snapshots()
    {
        var scenario = await SeedAsync("Snapshots");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 2, note: "No onion");
        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var line = await context.OrderItems
            .AsNoTracking()
            .SingleAsync(item => item.OrderId == order.Id);

        // The prices on a closed order are a financial record. Settling must read
        // them, never rewrite them.
        Assert.Equal(scenario.MenuItemPrice, line.UnitPrice);
        Assert.Equal(scenario.MenuItemPrice * 2, line.LineTotal);
        Assert.Equal(2, line.Quantity);
        Assert.Equal("No onion", line.Note);
    }

    [Fact]
    public async Task Closing_an_order_never_touches_its_kitchen_tickets()
    {
        var scenario = await SeedAsync("TicketsIntact");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);
        await Flow.FinishKitchenWorkAsync(_database, scenario, submitted.Ticket.Id);

        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var ticket = await context.KitchenTickets
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == submitted.Ticket.Id);

        // Kitchen history records work that was really done. Billing reads it and
        // never writes it.
        Assert.Equal(KitchenTicketStatus.Ready, ticket.Status);
        Assert.NotNull(ticket.StartedAtUtc);
        Assert.NotNull(ticket.ReadyAtUtc);
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
