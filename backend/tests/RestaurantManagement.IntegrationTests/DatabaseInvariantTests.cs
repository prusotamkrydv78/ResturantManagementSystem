using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// The guarantees that live in the schema rather than in code.
///
/// These are the ones worth testing hardest, because they are the last line: a future
/// service, a migration written by hand, or a script run at three in the morning all
/// have to obey them. Every test here goes round the services deliberately and writes
/// straight at the database, which is the only way to show that the constraint is real
/// and not just a rule some C# happens to follow.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class DatabaseInvariantTests
{
    private readonly TestDatabase _database;

    public DatabaseInvariantTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task An_order_line_cannot_appear_on_two_kitchen_tickets()
    {
        var scenario = await SeedAsync("OneTicketPerLine");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var lineId = await context.OrderItems
            .Where(item => item.OrderId == order.Id)
            .Select(item => item.Id)
            .SingleAsync();

        var secondTicket = new KitchenTicket
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = scenario.RestaurantId,
            OrderId = order.Id,
            TicketNumber = 9999,
            Status = KitchenTicketStatus.Pending,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        secondTicket.Items.Add(new KitchenTicketItem
        {
            Id = Guid.CreateVersion7(),
            KitchenTicketId = secondTicket.Id,
            // The line that is already on the first ticket.
            OrderItemId = lineId,
            ItemName = "Chicken Burger",
            Quantity = 1,
        });

        context.KitchenTickets.Add(secondTicket);

        var failure = await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        // This index is what makes double submission impossible rather than merely
        // guarded against, so the kitchen can never be told to cook the same food
        // twice.
        Assert.Contains(
            "IX_KitchenTicketItems_OrderItemId",
            failure.InnerException?.Message ?? string.Empty);
        Assert.NotEqual(Guid.Empty, submitted.Ticket.Id);
    }

    [Fact]
    public async Task A_cancelled_order_cannot_be_written_without_a_reason()
    {
        var scenario = await SeedAsync("CancelConstraint");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        // Straight past the entity, which would have refused this. A cancelled order
        // with no explanation is precisely the missing history the state exists to
        // prevent, so the database refuses it too.
        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                "UPDATE Orders SET Status = 'Cancelled' WHERE Id = {0}",
                order.Id));

        Assert.Contains("CK_Orders_Cancellation", failure.Message);
    }

    [Fact]
    public async Task A_completed_order_cannot_be_written_without_a_closing_time()
    {
        var scenario = await SeedAsync("CompleteConstraint");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                "UPDATE Orders SET Status = 'Completed' WHERE Id = {0}",
                order.Id));

        Assert.Contains("CK_Orders_Completion", failure.Message);
    }

    [Fact]
    public async Task An_open_order_cannot_carry_a_cancellation_reason()
    {
        var scenario = await SeedAsync("OpenWithReason");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        // The constraint runs both ways: only a cancelled order may carry the three
        // cancellation columns, so a stray reason on an open order is refused too.
        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                "UPDATE Orders SET CancellationReason = 'Sneaky' WHERE Id = {0}",
                order.Id));

        Assert.Contains("CK_Orders_Cancellation", failure.Message);
    }

    [Fact]
    public async Task A_payment_cannot_be_negative()
    {
        var scenario = await SeedAsync("NegativePayment");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO Payments (Id, RestaurantId, OrderId, Amount, Method, RecordedByUserId, RecordedAtUtc)
                VALUES ({0}, {1}, {2}, -5.00, 'Cash', {3}, SYSDATETIMEOFFSET())
                """,
                Guid.CreateVersion7(),
                scenario.RestaurantId,
                order.Id,
                scenario.ManagerId));

        Assert.Contains("CK_Payments_Amount", failure.Message);
    }

    [Fact]
    public async Task An_order_line_quantity_cannot_be_zero()
    {
        var scenario = await SeedAsync("ZeroQuantity");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                "UPDATE OrderItems SET Quantity = 0 WHERE OrderId = {0}",
                order.Id));

        Assert.Contains("CK_OrderItems_Quantity", failure.Message);
    }

    [Fact]
    public async Task Ticket_numbers_are_sequential_within_a_restaurant()
    {
        var scenario = await SeedAsync("Numbering");

        var first = await Flow.PlaceOrderAsync(_database, scenario);
        var firstTicket = await Flow.SubmitToKitchenAsync(_database, scenario, first.Id);

        var second = await Flow.PlaceOrderAsync(_database, scenario);
        var secondTicket = await Flow.SubmitToKitchenAsync(_database, scenario, second.Id);

        // The kitchen calls these out, so they run across tables rather than
        // restarting per order.
        Assert.Equal(firstTicket.Ticket.TicketNumber + 1, secondTicket.Ticket.TicketNumber);
    }

    [Fact]
    public async Task Two_restaurants_number_their_tickets_independently()
    {
        await using var seeding = _database.NewContext();
        var mine = await Scenario.SeedAsync(seeding, "NumberingA");
        var theirs = await Scenario.SeedAsync(seeding, "NumberingB");

        var myOrder = await Flow.PlaceOrderAsync(_database, mine);
        var myTicket = await Flow.SubmitToKitchenAsync(_database, mine, myOrder.Id);

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);
        var theirTicket = await Flow.SubmitToKitchenAsync(_database, theirs, theirOrder.Id);

        // Each restaurant starts at one. Numbering is per restaurant, not platform
        // wide, so one busy restaurant cannot push another numbers up.
        Assert.Equal(1, myTicket.Ticket.TicketNumber);
        Assert.Equal(1, theirTicket.Ticket.TicketNumber);
    }

    [Fact]
    public async Task Two_restaurants_number_their_orders_independently()
    {
        await using var seeding = _database.NewContext();
        var mine = await Scenario.SeedAsync(seeding, "OrderNumbersA");
        var theirs = await Scenario.SeedAsync(seeding, "OrderNumbersB");

        var myOrder = await Flow.PlaceOrderAsync(_database, mine);
        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        Assert.Equal(1, myOrder.OrderNumber);
        Assert.Equal(1, theirOrder.OrderNumber);
    }

    [Fact]
    public async Task Two_orders_in_one_restaurant_cannot_share_a_number()
    {
        var scenario = await SeedAsync("DuplicateNumber");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();

        // A colliding insert must fail rather than producing two "order 1" on the
        // same floor, which is what makes the readable number safe to say out loud.
        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO Orders
                    (Id, RestaurantId, TableId, OrderNumber, Status, Subtotal,
                     CreatedByStaffId, CreatedAtUtc, UpdatedAtUtc)
                VALUES
                    ({0}, {1}, {2}, {3}, 'Open', 0, {4},
                     SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
                """,
                Guid.CreateVersion7(),
                scenario.RestaurantId,
                scenario.TableId,
                order.OrderNumber,
                scenario.WaiterId));

        Assert.Contains("IX_Orders_RestaurantId_OrderNumber", failure.Message);
    }

    [Fact]
    public async Task A_kitchen_ticket_cannot_reference_an_order_in_another_restaurant()
    {
        await using var seeding = _database.NewContext();
        var mine = await Scenario.SeedAsync(seeding, "CrossFkA");
        var theirs = await Scenario.SeedAsync(seeding, "CrossFkB");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();

        // The composite foreign key means the pair (their order, my restaurant) does
        // not exist to reference. Cross-restaurant kitchen history is not merely
        // guarded against in code, it is unrepresentable.
        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO KitchenTickets
                    (Id, RestaurantId, OrderId, TicketNumber, Status,
                     CreatedAtUtc, UpdatedAtUtc)
                VALUES
                    ({0}, {1}, {2}, 4242, 'Pending',
                     SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())
                """,
                Guid.CreateVersion7(),
                mine.RestaurantId,
                theirOrder.Id));

        Assert.Contains("FK_KitchenTickets_Orders", failure.Message);
    }

    [Fact]
    public async Task A_payment_cannot_reference_an_order_in_another_restaurant()
    {
        await using var seeding = _database.NewContext();
        var mine = await Scenario.SeedAsync(seeding, "CrossPayA");
        var theirs = await Scenario.SeedAsync(seeding, "CrossPayB");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();

        var failure = await Assert.ThrowsAsync<Microsoft.Data.SqlClient.SqlException>(
            () => context.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO Payments
                    (Id, RestaurantId, OrderId, Amount, Method, RecordedByUserId, RecordedAtUtc)
                VALUES
                    ({0}, {1}, {2}, 10.00, 'Cash', {3}, SYSDATETIMEOFFSET())
                """,
                Guid.CreateVersion7(),
                mine.RestaurantId,
                theirOrder.Id,
                mine.ManagerId));

        Assert.Contains("FK_Payments_Orders", failure.Message);
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
