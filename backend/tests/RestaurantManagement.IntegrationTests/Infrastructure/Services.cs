using Microsoft.Extensions.Logging.Abstractions;
using RestaurantManagement.Application.Billing;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Kitchen;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Infrastructure.Billing;
using RestaurantManagement.Infrastructure.Inventory;
using RestaurantManagement.Infrastructure.Kitchen;
using RestaurantManagement.Infrastructure.Orders;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.IntegrationTests.Infrastructure;

/// <summary>
/// The real services, over a real context.
///
/// Constructed directly rather than through the container: the container adds nothing
/// these tests care about, and building them by hand keeps it obvious that each
/// service is given its own context when a test needs two callers who have not seen
/// each other writes.
/// </summary>
internal static class Services
{
    public static IOrderService Orders(ApplicationDbContext context) =>
        new OrderService(
            context,
            NullLogger<OrderService>.Instance,
            // The real one, sharing the same context, so submitting to the kitchen
            // deducts stock in these tests exactly as it does in the product. A stub
            // here would let a deduction bug pass every existing lifecycle test.
            Stock(context),
            Realtime());

    /// <summary>
    /// The notifier the services publish through. Silent here; see the type for why.
    /// </summary>
    public static IRealtimeNotifier Realtime() => new SilentRealtimeNotifier();

    public static IStockConsumption Stock(ApplicationDbContext context) =>
        new StockConsumption(context, NullLogger<StockConsumption>.Instance);

    public static IInventoryService Inventory(ApplicationDbContext context) =>
        new InventoryService(context, NullLogger<InventoryService>.Instance);

    public static IKitchenService Kitchen(ApplicationDbContext context) =>
        new KitchenService(context, Realtime(), NullLogger<KitchenService>.Instance);

    public static IBillingService Billing(ApplicationDbContext context) =>
        new BillingService(context, Realtime(), NullLogger<BillingService>.Instance);
}
