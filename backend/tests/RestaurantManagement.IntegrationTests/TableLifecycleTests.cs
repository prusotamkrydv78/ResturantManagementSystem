using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.IntegrationTests.Infrastructure;

namespace RestaurantManagement.IntegrationTests;

/// <summary>
/// Table occupancy, which is entirely a side effect of the order lifecycle.
///
/// Nothing in this product sets occupancy by hand, so these tests are the only place
/// the rule is stated in one piece: placing an order seats the table, and the table
/// comes back only when nothing is running on it any more. The two-parties case is the
/// one worth guarding hardest, because releasing a table that is still eating would
/// tell the floor it was free.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class TableLifecycleTests
{
    private readonly TestDatabase _database;

    public TableLifecycleTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task Placing_an_order_occupies_the_table()
    {
        var scenario = await SeedAsync("Seat");

        Assert.Equal(
            TableStatus.Available,
            await Flow.TableStatusAsync(_database, scenario.TableId));

        await Flow.PlaceOrderAsync(_database, scenario);

        Assert.Equal(
            TableStatus.Occupied,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task Settling_the_order_releases_the_table()
    {
        var scenario = await SeedAsync("Settle");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var settled = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(settled.IsSuccess, settled.Error?.Message);
        Assert.Equal(
            TableStatus.Available,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task Cancelling_the_order_releases_the_table()
    {
        var scenario = await SeedAsync("Cancel");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        var cancelled = await Flow.CancelAsync(_database, scenario, order.Id);

        Assert.True(cancelled.IsSuccess, cancelled.Error?.Message);
        // Both endings give the table back. A cancelled order that left the table
        // occupied would take it out of service until somebody noticed.
        Assert.Equal(
            TableStatus.Available,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task A_table_with_a_second_open_order_is_not_released()
    {
        var scenario = await SeedAsync("Shared");

        var first = await Flow.PlaceOrderAsync(_database, scenario);
        var second = await Flow.PlaceOrderAsync(_database, scenario);

        var settled = await Flow.SettleAsync(_database, scenario, first.Id);
        Assert.True(settled.IsSuccess, settled.Error?.Message);

        // Two parties can share a table over an evening. Releasing it while the second
        // is still eating would be wrong, so occupancy survives the first settlement.
        Assert.Equal(
            TableStatus.Occupied,
            await Flow.TableStatusAsync(_database, scenario.TableId));

        var alsoSettled = await Flow.SettleAsync(_database, scenario, second.Id);
        Assert.True(alsoSettled.IsSuccess, alsoSettled.Error?.Message);

        Assert.Equal(
            TableStatus.Available,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task A_cancelled_order_alongside_an_open_one_leaves_the_table_occupied()
    {
        var scenario = await SeedAsync("MixedEndings");

        var first = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.PlaceOrderAsync(_database, scenario);

        var cancelled = await Flow.CancelAsync(_database, scenario, first.Id);

        Assert.True(cancelled.IsSuccess, cancelled.Error?.Message);
        // The guard is about other open orders, not about how this one ended.
        Assert.Equal(
            TableStatus.Occupied,
            await Flow.TableStatusAsync(_database, scenario.TableId));
    }

    [Fact]
    public async Task A_refused_settlement_leaves_the_table_occupied()
    {
        var scenario = await SeedAsync("Refused");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SubmitToKitchenAsync(_database, scenario, order.Id);

        // The kitchen has not finished, so settling must be refused.
        var refused = await Flow.SettleAsync(_database, scenario, order.Id);

        Assert.True(refused.IsFailure);
        // The release rides the same transaction as the payment, so a refusal must
        // leave both the table and the order exactly as they were.
        Assert.Equal(
            TableStatus.Occupied,
            await Flow.TableStatusAsync(_database, scenario.TableId));
        Assert.Equal(
            OrderStatus.Open,
            await Flow.OrderStatusAsync(_database, order.Id));
    }

    [Fact]
    public async Task Settling_never_takes_a_table_out_of_service()
    {
        var scenario = await SeedAsync("InService");

        var order = await Flow.PlaceOrderAsync(_database, scenario);
        await Flow.SettleAsync(_database, scenario, order.Id);

        // Availability and being in service are different things, and only the manager
        // controls the second one.
        Assert.True(await Flow.TableIsActiveAsync(_database, scenario.TableId));
    }

    private async Task<Scenario> SeedAsync(string label)
    {
        await using var context = _database.NewContext();

        return await Scenario.SeedAsync(context, label);
    }
}
