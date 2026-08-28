using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// Editing an order, and what stops being editable when.
///
/// Two rules matter most. The server prices everything, so a request can never decide
/// what a line costs. And once a line has gone to the kitchen it is history: a change
/// to it would mean the kitchen cooked one thing while the bill said another.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class OrderEditingTests
{
    private readonly TestDatabase _database;

    public OrderEditingTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task The_server_prices_the_order_from_its_own_menu()
    {
        var scenario = await SeedAsync("Pricing");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 4);
        var line = order.Items.Single();

        // The request carried an item id and a quantity, and nothing else. Every
        // figure here came from the server.
        Assert.Equal(scenario.MenuItemPrice, line.UnitPrice);
        Assert.Equal(scenario.MenuItemPrice * 4, line.LineTotal);
        Assert.Equal(scenario.MenuItemPrice * 4, order.Subtotal);
        Assert.Equal("Chicken Burger", line.ItemName);
    }

    [Fact]
    public async Task Changing_a_menu_price_does_not_move_an_existing_order()
    {
        var scenario = await SeedAsync("Snapshot");

        var order = await Flow.PlaceOrderAsync(_database, scenario, quantity: 2);

        await using (var context = _database.NewContext())
        {
            var item = await context.MenuItems.SingleAsync(i => i.Id == scenario.MenuItemId);
            item.Price = 99.00m;
            await context.SaveChangesAsync();
        }

        await using var reading = _database.NewContext();
        var reloaded = await Services.Orders(reading).GetByIdAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        // The order stores its own copies precisely so this cannot happen. A guest is
        // charged what they were quoted.
        Assert.Equal(scenario.MenuItemPrice, reloaded.Value.Items.Single().UnitPrice);
        Assert.Equal(scenario.MenuItemPrice * 2, reloaded.Value.Subtotal);
    }

    [Fact]
    public async Task Raising_a_quantity_reuses_the_recorded_price()
    {
        var scenario = await SeedAsync("Requantify");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var lineId = order.Items.Single().Id;

        await using (var context = _database.NewContext())
        {
            var item = await context.MenuItems.SingleAsync(i => i.Id == scenario.MenuItemId);
            item.Price = 50.00m;
            await context.SaveChangesAsync();
        }

        await using var editing = _database.NewContext();
        var updated = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                Lines = [new UpdateOrderLineRequest { Id = lineId, Quantity = 3 }],
                RowVersion = order.RowVersion,
            },
            CancellationToken.None);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        // Changing how many must never re-price history.
        Assert.Equal(scenario.MenuItemPrice * 3, updated.Value.Subtotal);
    }

    [Fact]
    public async Task A_line_sent_to_the_kitchen_cannot_have_its_quantity_changed()
    {
        var scenario = await SeedAsync("LockedQuantity");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var reading = _database.NewContext();
        var current = await Services.Orders(reading).GetByIdAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        var line = current.Value.Items.Single();
        Assert.True(line.IsSubmittedToKitchen);

        await using var editing = _database.NewContext();
        var result = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                Lines = [new UpdateOrderLineRequest { Id = line.Id, Quantity = 5 }],
                RowVersion = current.Value.RowVersion,
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.SubmittedItemLocked, result.Error);
    }

    [Fact]
    public async Task A_line_sent_to_the_kitchen_cannot_be_removed()
    {
        var scenario = await SeedAsync("LockedRemoval");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var reading = _database.NewContext();
        var current = await Services.Orders(reading).GetByIdAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        await using var editing = _database.NewContext();
        var result = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                // Leaving the line out is how a removal is expressed.
                Lines = [],
                RowVersion = current.Value.RowVersion,
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.SubmittedItemLocked, result.Error);

        await using var check = _database.NewContext();
        // The line is still there. The kitchen was told to cook it.
        Assert.Equal(1, await check.OrderItems.CountAsync(i => i.OrderId == order.Id));
    }

    [Fact]
    public async Task Items_added_after_a_submission_stay_editable()
    {
        var scenario = await SeedAsync("StillEditable");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var reading = _database.NewContext();
        var current = await Services.Orders(reading).GetByIdAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        var sentLine = current.Value.Items.Single();

        await using var editing = _database.NewContext();
        var updated = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                // The sent line is carried through unchanged, which is what the server
                // expects as proof it is intact.
                Lines =
                [
                    new UpdateOrderLineRequest
                    {
                        Id = sentLine.Id,
                        Quantity = sentLine.Quantity,
                    },
                ],
                NewItems =
                [
                    new CreateOrderItemRequest
                    {
                        MenuItemId = scenario.MenuItemId,
                        Quantity = 2,
                    },
                ],
                RowVersion = current.Value.RowVersion,
            },
            CancellationToken.None);

        Assert.True(updated.IsSuccess, updated.Error?.Message);
        // A second line rather than a bigger first one: the sent one is untouchable.
        Assert.Equal(2, updated.Value.Items.Count);
        Assert.Equal(2, updated.Value.UnsubmittedItemCount);
    }

    [Fact]
    public async Task A_completed_order_cannot_be_edited()
    {
        var scenario = await SeedAsync("ClosedEdit");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var lineId = order.Items.Single().Id;

        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var editing = _database.NewContext();
        var result = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                Lines = [new UpdateOrderLineRequest { Id = lineId, Quantity = 7 }],
                RowVersion = order.RowVersion,
            },
            CancellationToken.None);

        // The waiter workflow locks itself out of a closed order without any billing
        // code being involved: it asks whether the order is editable, and it is not.
        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task A_cancelled_order_cannot_be_edited()
    {
        var scenario = await SeedAsync("CancelledEdit");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var lineId = order.Items.Single().Id;

        await Flow.CancelAsync(_database, scenario, order.Id);

        await using var editing = _database.NewContext();
        var result = await Services.Orders(editing).UpdateAsync(
            scenario.WaiterId,
            order.Id,
            new UpdateOrderRequest
            {
                Lines = [new UpdateOrderLineRequest { Id = lineId, Quantity = 7 }],
                RowVersion = order.RowVersion,
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task A_closed_order_cannot_be_sent_to_the_kitchen()
    {
        var scenario = await SeedAsync("ClosedSubmit");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).SubmitToKitchenAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);

        await using var check = _database.NewContext();
        Assert.False(await check.KitchenTickets.AnyAsync(t => t.OrderId == order.Id));
    }

    [Fact]
    public async Task An_order_with_nothing_left_to_send_is_refused()
    {
        var scenario = await SeedAsync("NothingToSend");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).SubmitToKitchenAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.NothingToSubmit, result.Error);
    }

    [Fact]
    public async Task A_second_submission_sends_only_what_is_new()
    {
        var scenario = await SeedAsync("SecondTicket");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var firstTicket = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var reading = _database.NewContext();
        var current = await Services.Orders(reading).GetByIdAsync(
            scenario.WaiterId,
            order.Id,
            CancellationToken.None);

        var sentLine = current.Value.Items.Single();

        await using (var editing = _database.NewContext())
        {
            await Services.Orders(editing).UpdateAsync(
                scenario.WaiterId,
                order.Id,
                new UpdateOrderRequest
                {
                    Lines =
                    [
                        new UpdateOrderLineRequest
                        {
                            Id = sentLine.Id,
                            Quantity = sentLine.Quantity,
                        },
                    ],
                    NewItems =
                    [
                        new CreateOrderItemRequest
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

        // A separate ticket, holding only the new line. Drinks first and food later is
        // the ordinary case, not an edge one.
        Assert.NotEqual(firstTicket.Ticket.Id, secondTicket.Ticket.Id);
        Assert.Equal(1, secondTicket.Ticket.ItemCount);
        Assert.Equal(2, secondTicket.Order.KitchenTickets.Count);
    }

    [Fact]
    public async Task Submitting_never_changes_the_order_status()
    {
        var scenario = await SeedAsync("StaysOpen");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        // Sending food to the kitchen is not a step in the order lifecycle. The table
        // is still open and still unpaid.
        Assert.Equal(OrderStatus.Open, await Flow.OrderStatusAsync(_database, order.Id));
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
