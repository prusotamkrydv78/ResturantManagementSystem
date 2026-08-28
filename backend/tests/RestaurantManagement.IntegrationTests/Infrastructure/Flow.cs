using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.IntegrationTests.Infrastructure;

/// <summary>
/// Drives an order through the real workflow, one service call at a time.
///
/// Every step goes through the service the product actually uses, so a test that ends
/// with a paid order got there the same way a restaurant would. Nothing here writes to
/// the database directly: a helper that shortcut the workflow would let a broken step
/// pass unnoticed.
///
/// Each call gets its own context, because that is what the product does. A web
/// request is served by a scoped context that has seen nothing, so a service must work
/// from what it loads rather than from what happens to be tracked. Sharing one context
/// across a whole test would let entity fixup answer questions the database is
/// supposed to answer, and hide exactly the bugs these tests exist to catch.
/// </summary>
internal static class Flow
{
    /// <summary>Places an order on the scenario table, with the given quantity.</summary>
    public static async Task<OrderResponse> PlaceOrderAsync(
        TestDatabase database,
        Scenario scenario,
        int quantity = 1,
        string? note = null)
    {
        await using var context = database.NewContext();

        var result = await Services.Orders(context).CreateAsync(
            scenario.WaiterId,
            new CreateOrderRequest
            {
                TableId = scenario.TableId,
                Items =
                [
                    new CreateOrderItemRequest
                    {
                        MenuItemId = scenario.MenuItemId,
                        Quantity = quantity,
                        Note = note,
                    },
                ],
            },
            CancellationToken.None);

        Assert.True(result.IsSuccess, $"Placing the order failed: {result.Error?.Message}");

        return result.Value;
    }

    /// <summary>Sends everything unsent on the order to the kitchen.</summary>
    public static async Task<SubmitToKitchenResponse> SubmitToKitchenAsync(
        TestDatabase database,
        Scenario scenario,
        Guid orderId)
    {
        await using var context = database.NewContext();

        var result = await Services.Orders(context).SubmitToKitchenAsync(
            scenario.WaiterId,
            orderId,
            CancellationToken.None);

        Assert.True(result.IsSuccess, $"Submitting failed: {result.Error?.Message}");

        return result.Value;
    }

    /// <summary>Takes a ticket all the way to the pass, as a chef would.</summary>
    public static async Task FinishKitchenWorkAsync(
        TestDatabase database,
        Scenario scenario,
        Guid ticketId)
    {
        await using (var starting = database.NewContext())
        {
            var started = await Services.Kitchen(starting).StartAsync(
                scenario.ChefId,
                ticketId,
                CancellationToken.None);

            Assert.True(started.IsSuccess, $"Starting failed: {started.Error?.Message}");
        }

        await using var finishing = database.NewContext();

        var ready = await Services.Kitchen(finishing).MarkReadyAsync(
            scenario.ChefId,
            ticketId,
            CancellationToken.None);

        Assert.True(ready.IsSuccess, $"Marking ready failed: {ready.Error?.Message}");
    }

    /// <summary>Settles the order as the manager, taking the amount from the server.</summary>
    public static async Task<Result<RecordPaymentResponse>> SettleAsync(
        TestDatabase database,
        Scenario scenario,
        Guid orderId,
        PaymentMethod method = PaymentMethod.Cash)
    {
        await using var context = database.NewContext();

        return await Services.Billing(context).RecordPaymentAsync(
            scenario.ManagerId,
            orderId,
            new RecordPaymentRequest { Method = method },
            CancellationToken.None);
    }

    /// <summary>Calls the order off as the manager.</summary>
    public static async Task<Result<BillingOrderResponse>> CancelAsync(
        TestDatabase database,
        Scenario scenario,
        Guid orderId,
        string reason = "Guests left before the food arrived")
    {
        await using var context = database.NewContext();

        return await Services.Billing(context).CancelOrderAsync(
            scenario.ManagerId,
            orderId,
            new CancelOrderRequest { Reason = reason },
            CancellationToken.None);
    }

    /// <summary>Places an order and takes its kitchen work all the way to the pass.</summary>
    public static async Task<OrderResponse> PlaceAndFinishKitchenAsync(
        TestDatabase database,
        Scenario scenario,
        int quantity = 1)
    {
        var order = await PlaceOrderAsync(database, scenario, quantity);
        var submitted = await SubmitToKitchenAsync(database, scenario, order.Id);

        await FinishKitchenWorkAsync(database, scenario, submitted.Ticket.Id);

        return order;
    }

    /* --------------------------------------------------------------------- Reads */

    /// <summary>Reads a table occupancy straight from the database.</summary>
    public static async Task<TableStatus> TableStatusAsync(
        TestDatabase database,
        Guid tableId)
    {
        await using var context = database.NewContext();

        return await context.RestaurantTables
            .AsNoTracking()
            .Where(table => table.Id == tableId)
            .Select(table => table.Status)
            .SingleAsync();
    }

    /// <summary>Reads an order status straight from the database.</summary>
    public static async Task<OrderStatus> OrderStatusAsync(
        TestDatabase database,
        Guid orderId)
    {
        await using var context = database.NewContext();

        return await context.Orders
            .AsNoTracking()
            .Where(order => order.Id == orderId)
            .Select(order => order.Status)
            .SingleAsync();
    }

    /// <summary>Whether the table is still in service, which billing must never change.</summary>
    public static async Task<bool> TableIsActiveAsync(
        TestDatabase database,
        Guid tableId)
    {
        await using var context = database.NewContext();

        return await context.RestaurantTables
            .AsNoTracking()
            .Where(table => table.Id == tableId)
            .Select(table => table.IsActive)
            .SingleAsync();
    }
}
