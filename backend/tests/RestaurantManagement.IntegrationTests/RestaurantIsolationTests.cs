using RestaurantManagement.Application.Billing;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// Restaurant isolation, which is the rule the whole product rests on.
///
/// Two things are being protected. One restaurant staff can never reach another
/// records, and a foreign identifier must be indistinguishable from one that does not
/// exist: an endpoint that answered "forbidden" for a real order elsewhere and "not
/// found" for a made-up one would let anybody map out another restaurant business by
/// probing identifiers.
///
/// Every test here seeds two restaurants and crosses the wires deliberately.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class RestaurantIsolationTests
{
    private readonly TestDatabase _database;

    public RestaurantIsolationTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task A_waiter_cannot_read_an_order_from_another_restaurant()
    {
        var (mine, theirs) = await SeedPairAsync("ReadOrder");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).GetByIdAsync(
            mine.WaiterId,
            theirOrder.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.NotFound, result.Error);
    }

    [Fact]
    public async Task A_real_order_elsewhere_and_a_made_up_one_are_indistinguishable()
    {
        var (mine, theirs) = await SeedPairAsync("Probe");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();
        var orders = Services.Orders(context);

        var foreign = await orders.GetByIdAsync(
            mine.WaiterId,
            theirOrder.Id,
            CancellationToken.None);

        var nonsense = await orders.GetByIdAsync(
            mine.WaiterId,
            Guid.CreateVersion7(),
            CancellationToken.None);

        // Identical answers. Anything else is a way to discover that an order exists
        // in someone else restaurant.
        Assert.Equal(nonsense.Error, foreign.Error);
    }

    [Fact]
    public async Task A_waiter_cannot_edit_an_order_from_another_restaurant()
    {
        var (mine, theirs) = await SeedPairAsync("EditOrder");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);
        var theirLine = theirOrder.Items.Single();

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).UpdateAsync(
            mine.WaiterId,
            theirOrder.Id,
            new UpdateOrderRequest
            {
                Lines = [new UpdateOrderLineRequest { Id = theirLine.Id, Quantity = 99 }],
                RowVersion = theirOrder.RowVersion,
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.NotFound, result.Error);

        await using var check = _database.NewContext();
        var line = await Services.Orders(check).GetByIdAsync(
            theirs.WaiterId,
            theirOrder.Id,
            CancellationToken.None);

        // Their order is untouched, quantity included.
        Assert.Equal(1, line.Value.Items.Single().Quantity);
    }

    [Fact]
    public async Task A_waiter_cannot_place_an_order_on_another_restaurant_table()
    {
        var (mine, theirs) = await SeedPairAsync("ForeignTable");

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).CreateAsync(
            mine.WaiterId,
            new CreateOrderRequest
            {
                TableId = theirs.TableId,
                Items =
                [
                    new CreateOrderItemRequest
                    {
                        MenuItemId = mine.MenuItemId,
                        Quantity = 1,
                    },
                ],
            },
            CancellationToken.None);

        // A table elsewhere reports the same thing as a table that is out of service:
        // unavailable, with no hint that it belongs to somebody else.
        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.TableUnavailable, result.Error);
    }

    [Fact]
    public async Task A_waiter_cannot_order_an_item_from_another_restaurant_menu()
    {
        var (mine, theirs) = await SeedPairAsync("ForeignItem");

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).CreateAsync(
            mine.WaiterId,
            new CreateOrderRequest
            {
                TableId = mine.TableId,
                Items =
                [
                    new CreateOrderItemRequest
                    {
                        MenuItemId = theirs.MenuItemId,
                        Quantity = 1,
                    },
                ],
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        // Refused whole rather than partly created, and the message says unavailable
        // rather than "belongs to another restaurant".
        Assert.Equal("order.items_unavailable", result.Error!.Code);
    }

    [Fact]
    public async Task A_chef_cannot_start_a_ticket_from_another_restaurant()
    {
        var (mine, theirs) = await SeedPairAsync("ForeignTicket");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);
        var theirTicket = await Flow.SubmitToKitchenAsync(_database, theirs, theirOrder.Id);

        await using var context = _database.NewContext();
        var result = await Services.Kitchen(context).StartAsync(
            mine.ChefId,
            theirTicket.Ticket.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);

        await using var check = _database.NewContext();
        var ticket = await Services.Kitchen(check).GetByIdAsync(
            theirs.ChefId,
            theirTicket.Ticket.Id,
            CancellationToken.None);

        // Still waiting. Nobody else kitchen moved it.
        Assert.Equal(KitchenTicketStatus.Pending, ticket.Value.Status);
    }

    [Fact]
    public async Task A_chef_queue_holds_only_their_own_restaurant_tickets()
    {
        var (mine, theirs) = await SeedPairAsync("Queue");

        var myOrder = await Flow.PlaceOrderAsync(_database, mine);
        await Flow.SubmitToKitchenAsync(_database, mine, myOrder.Id);

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);
        var theirTicket = await Flow.SubmitToKitchenAsync(_database, theirs, theirOrder.Id);

        await using var context = _database.NewContext();
        var queue = await Services.Kitchen(context).GetQueueAsync(
            mine.ChefId,
            status: null,
            CancellationToken.None);

        Assert.True(queue.IsSuccess);
        Assert.DoesNotContain(queue.Value, ticket => ticket.Id == theirTicket.Ticket.Id);
        Assert.All(queue.Value, ticket => Assert.Equal(myOrder.OrderNumber, ticket.OrderNumber));
    }

    [Fact]
    public async Task A_manager_cannot_settle_an_order_from_another_restaurant()
    {
        var (mine, theirs) = await SeedPairAsync("ForeignSettle");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();
        var result = await Services.Billing(context).RecordPaymentAsync(
            mine.ManagerId,
            theirOrder.Id,
            new RecordPaymentRequest { Method = Domain.Payments.PaymentMethod.Cash },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BillingErrors.OrderNotFound, result.Error);
        // Their table is still working and nothing was taken.
        Assert.Equal(OrderStatus.Open, await Flow.OrderStatusAsync(_database, theirOrder.Id));
    }

    [Fact]
    public async Task A_manager_cannot_cancel_an_order_from_another_restaurant()
    {
        var (mine, theirs) = await SeedPairAsync("ForeignCancel");

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();
        var result = await Services.Billing(context).CancelOrderAsync(
            mine.ManagerId,
            theirOrder.Id,
            new CancelOrderRequest { Reason = "Not my restaurant" },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BillingErrors.OrderNotFound, result.Error);
        Assert.Equal(OrderStatus.Open, await Flow.OrderStatusAsync(_database, theirOrder.Id));
    }

    [Fact]
    public async Task A_manager_billing_queue_holds_only_their_own_orders()
    {
        var (mine, theirs) = await SeedPairAsync("BillingQueue");

        var myOrder = await Flow.PlaceOrderAsync(_database, mine);
        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);

        await using var context = _database.NewContext();
        var queue = await Services.Billing(context).GetOrdersAsync(
            mine.ManagerId,
            includeCompleted: false,
            CancellationToken.None);

        Assert.True(queue.IsSuccess);
        Assert.Contains(queue.Value, order => order.Id == myOrder.Id);
        Assert.DoesNotContain(queue.Value, order => order.Id == theirOrder.Id);
    }

    [Fact]
    public async Task A_manager_history_holds_only_their_own_orders()
    {
        var (mine, theirs) = await SeedPairAsync("History");

        var myOrder = await Flow.PlaceOrderAsync(_database, mine);
        await Flow.SettleAsync(_database, scenario: mine, orderId: myOrder.Id);

        var theirOrder = await Flow.PlaceOrderAsync(_database, theirs);
        await Flow.SettleAsync(_database, scenario: theirs, orderId: theirOrder.Id);

        await using var context = _database.NewContext();
        var history = await Services.Billing(context).GetHistoryAsync(
            mine.ManagerId,
            status: null,
            limit: 50,
            CancellationToken.None);

        Assert.True(history.IsSuccess);
        Assert.Contains(history.Value, entry => entry.Id == myOrder.Id);
        Assert.DoesNotContain(history.Value, entry => entry.Id == theirOrder.Id);
    }

    [Fact]
    public async Task A_deactivated_waiter_cannot_take_an_order()
    {
        var scenario = await SeedAsync("Deactivated");

        await using (var context = _database.NewContext())
        {
            await Scenario.DeactivateAsync(context, scenario.WaiterId);
        }

        await using var acting = _database.NewContext();
        var result = await Services.Orders(acting).CreateAsync(
            scenario.WaiterId,
            new CreateOrderRequest
            {
                TableId = scenario.TableId,
                Items =
                [
                    new CreateOrderItemRequest { MenuItemId = scenario.MenuItemId, Quantity = 1 },
                ],
            },
            CancellationToken.None);

        // The service checks this as well as sign-in does, so an access token issued
        // moments before deactivation stops working immediately.
        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.NotAnActiveWaiter, result.Error);
    }

    [Fact]
    public async Task A_deactivated_chef_cannot_work_the_kitchen()
    {
        var scenario = await SeedAsync("DeactivatedChef");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using (var context = _database.NewContext())
        {
            await Scenario.DeactivateAsync(context, scenario.ChefId);
        }

        await using var acting = _database.NewContext();
        var result = await Services.Kitchen(acting).StartAsync(
            scenario.ChefId,
            submitted.Ticket.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task A_chef_cannot_use_the_waiter_ordering_service()
    {
        var scenario = await SeedAsync("ChefOrdering");

        await using var context = _database.NewContext();
        var result = await Services.Orders(context).CreateAsync(
            // A chef is Staff with a restaurant, so only the staff role separates
            // them here. The service must check it rather than trusting the policy.
            scenario.ChefId,
            new CreateOrderRequest
            {
                TableId = scenario.TableId,
                Items =
                [
                    new CreateOrderItemRequest { MenuItemId = scenario.MenuItemId, Quantity = 1 },
                ],
            },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(OrderErrors.NotAnActiveWaiter, result.Error);
    }

    [Fact]
    public async Task A_waiter_cannot_use_the_kitchen_service()
    {
        var scenario = await SeedAsync("WaiterKitchen");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var submitted = await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        await using var context = _database.NewContext();
        var result = await Services.Kitchen(context).StartAsync(
            scenario.WaiterId,
            submitted.Ticket.Id,
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task A_waiter_cannot_use_the_billing_service()
    {
        var scenario = await SeedAsync("WaiterBilling");

        var order = await Flow.PlaceOrderAsync(_database, scenario);

        await using var context = _database.NewContext();
        var result = await Services.Billing(context).RecordPaymentAsync(
            // A waiter manages no restaurant, so ownership cannot resolve.
            scenario.WaiterId,
            order.Id,
            new RecordPaymentRequest { Method = Domain.Payments.PaymentMethod.Cash },
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BillingErrors.NoRestaurantAssigned, result.Error);
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }

    private async Task<(Scenario Mine, Scenario Theirs)> SeedPairAsync(string label)
    {
        await using var context = _database.NewContext();

        var mine = await Scenario.SeedAsync(context, $"{label}A");
        var theirs = await Scenario.SeedAsync(context, $"{label}B");

        return (mine, theirs);
    }
}
