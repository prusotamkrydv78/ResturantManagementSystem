using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// The kitchen workflow end to end, through the real service and a real database.
///
/// The entity tests already pin the transition rules. What these add is everything
/// around them: that the queue shows live work only, that the timestamps survive a
/// round trip, and above all that moving a ticket never reaches back into the order
/// or its prices. The kitchen cooks; it does not sell.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class KitchenWorkflowTests
{
    private readonly TestDatabase _database;

    public KitchenWorkflowTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task A_submitted_ticket_arrives_pending_with_no_timestamps()
    {
        var scenario = await SeedAsync("Arrives");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var ticket = await context.KitchenTickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == submitted.Ticket.Id);

        Assert.Equal(KitchenTicketStatus.Pending, ticket.Status);
        Assert.Null(ticket.StartedAtUtc);
        Assert.Null(ticket.ReadyAtUtc);
    }

    [Fact]
    public async Task Starting_then_finishing_stamps_both_times_in_order()
    {
        var scenario = await SeedAsync("Times");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await Flow.FinishKitchenWorkAsync(_database, scenario, submitted.Ticket.Id);

        await using var context = _database.NewContext();
        var ticket = await context.KitchenTickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == submitted.Ticket.Id);

        Assert.Equal(KitchenTicketStatus.Ready, ticket.Status);
        Assert.NotNull(ticket.StartedAtUtc);
        Assert.NotNull(ticket.ReadyAtUtc);
        // Cooking cannot finish before it began.
        Assert.True(ticket.ReadyAtUtc >= ticket.StartedAtUtc);
        Assert.True(ticket.StartedAtUtc >= ticket.CreatedAtUtc);
    }

    [Fact]
    public async Task A_pending_ticket_cannot_be_marked_ready()
    {
        var scenario = await SeedAsync("NoSkip");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var result = await Services.Kitchen(context).MarkReadyAsync(
            scenario.ChefId,
            submitted.Ticket.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);

        await using var check = _database.NewContext();
        var ticket = await check.KitchenTickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == submitted.Ticket.Id);

        // A ready ticket with no start time could not describe what happened, so the
        // skip stays refused all the way through.
        Assert.Equal(KitchenTicketStatus.Pending, ticket.Status);
        Assert.Null(ticket.ReadyAtUtc);
    }

    [Fact]
    public async Task The_queue_shows_live_work_and_drops_finished_tickets()
    {
        var scenario = await SeedAsync("Queue");

        var waiting = await Flow.PlaceOrderAsync(_database, scenario);
        var waitingTicket = await Flow.SubmitToKitchenAsync(_database, scenario, waiting.Id);

        var done = await Flow.PlaceOrderAsync(_database, scenario);
        var doneTicket = await Flow.SubmitToKitchenAsync(_database, scenario, done.Id);
        await Flow.FinishKitchenWorkAsync(_database, scenario, doneTicket.Ticket.Id);

        await using var context = _database.NewContext();
        var queue = await Services.Kitchen(context).GetQueueAsync(
            scenario.ChefId,
            status: null,
            CancellationToken.None);

        Assert.True(queue.IsSuccess);
        Assert.Contains(queue.Value, t => t.Id == waitingTicket.Ticket.Id);
        // Finished work would push live work down the rail.
        Assert.DoesNotContain(queue.Value, t => t.Id == doneTicket.Ticket.Id);
    }

    [Fact]
    public async Task Tickets_being_cooked_come_before_tickets_still_waiting()
    {
        var scenario = await SeedAsync("Ordering");

        var first = await Flow.PlaceOrderAsync(_database, scenario);
        var firstTicket = await Flow.SubmitToKitchenAsync(_database, scenario, first.Id);

        var second = await Flow.PlaceOrderAsync(_database, scenario);
        var secondTicket = await Flow.SubmitToKitchenAsync(_database, scenario, second.Id);

        // The younger ticket is picked up, so it should lead the rail even though it
        // arrived later: somebody is standing over it.
        await using (var starting = _database.NewContext())
        {
            await Services.Kitchen(starting).StartAsync(
                scenario.ChefId,
                secondTicket.Ticket.Id,
                CancellationToken.None);
        }

        await using var context = _database.NewContext();
        var queue = await Services.Kitchen(context).GetQueueAsync(
            scenario.ChefId,
            status: null,
            CancellationToken.None);

        Assert.Equal(secondTicket.Ticket.Id, queue.Value[0].Id);
        Assert.Equal(firstTicket.Ticket.Id, queue.Value[1].Id);
    }

    [Fact]
    public async Task A_status_filter_returns_only_that_status()
    {
        var scenario = await SeedAsync("Filter");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);
        await Flow.FinishKitchenWorkAsync(_database, scenario, submitted.Ticket.Id);

        await using var context = _database.NewContext();
        var ready = await Services.Kitchen(context).GetQueueAsync(
            scenario.ChefId,
            KitchenTicketStatus.Ready,
            CancellationToken.None);

        Assert.True(ready.IsSuccess);
        Assert.All(ready.Value, t => Assert.Equal(KitchenTicketStatus.Ready, t.Status));
        Assert.Contains(ready.Value, t => t.Id == submitted.Ticket.Id);
    }

    [Fact]
    public async Task A_ticket_carries_the_snapshots_it_was_sent_with()
    {
        var scenario = await SeedAsync("Snapshots");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 3, note: "Extra spicy");
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        var line = submitted.Ticket.Items.Single();

        // The kitchen reads its own copy, so a later menu change cannot rewrite what
        // it was asked to make.
        Assert.Equal("Chicken Burger", line.ItemName);
        Assert.Equal(3, line.Quantity);
        Assert.Equal("Extra spicy", line.Note);
    }

    [Fact]
    public async Task Moving_a_ticket_never_changes_the_order()
    {
        var scenario = await SeedAsync("OrderUntouched");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 2);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await Flow.FinishKitchenWorkAsync(_database, scenario, submitted.Ticket.Id);

        await using var context = _database.NewContext();
        var stored = await context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .SingleAsync(o => o.Id == order.Id);

        // Starting or finishing food is not a step in the order lifecycle, and the
        // kitchen has no business with money.
        Assert.Equal(OrderStatus.Open, stored.Status);
        Assert.Null(stored.CompletedAtUtc);
        Assert.Equal(scenario.MenuItemPrice * 2, stored.Subtotal);
        Assert.Equal(scenario.MenuItemPrice, stored.Items.Single().UnitPrice);
    }

    [Fact]
    public async Task Moving_a_ticket_never_releases_the_table()
    {
        var scenario = await SeedAsync("TableHeld");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await Flow.FinishKitchenWorkAsync(_database, scenario, submitted.Ticket.Id);

        // Food at the pass does not mean the guests have gone.
        Assert.Equal(
            Domain.Restaurants.TableStatus.Occupied,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task Every_ticket_from_one_order_must_finish_before_it_can_be_settled()
    {
        var scenario = await SeedAsync("TwoTickets");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var firstTicket = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        // A second round, the ordinary drinks-then-food case.
        await using (var editing = _database.NewContext())
        {
            var current = await Services.Orders(editing).GetByIdAsync(
                scenario.WaiterId,
                order.Id,
                CancellationToken.None);

            var sent = current.Value.Items.Single();

            await Services.Orders(editing).UpdateAsync(
                scenario.WaiterId,
                order.Id,
                new Application.Orders.Dtos.UpdateOrderRequest
                {
                    Lines =
                    [
                        new Application.Orders.Dtos.UpdateOrderLineRequest
                        {
                            Id = sent.Id,
                            Quantity = sent.Quantity,
                        },
                    ],
                    NewItems =
                    [
                        new Application.Orders.Dtos.CreateOrderItemRequest
                        {
                            MenuItemId = scenario.MenuItemId,
                            Quantity = 1,
                        },
                    ],
                    RowVersion = current.Value.RowVersion,
                },
                CancellationToken.None);
        }

        var secondTicket = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await Flow.FinishKitchenWorkAsync(_database, scenario, firstTicket.Ticket.Id);

        // One ticket finished, one still waiting: not settleable.
        var tooEarly = await Flow.SettleAsync(_database, scenario, order.Id);
        Assert.True(tooEarly.IsFailure);

        await Flow.FinishKitchenWorkAsync(_database, scenario, secondTicket.Ticket.Id);

        var settled = await Flow.SettleAsync(_database, scenario, order.Id);
        Assert.True(settled.IsSuccess, settled.Error?.Message);
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
