using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Domain.Tests.Orders;

/// <summary>
/// Builds orders for the domain tests.
///
/// Deliberately minimal: it produces the plainest order that satisfies the rule under
/// test and nothing else, so each test says out loud which condition it is adding.
/// A builder that quietly filled in kitchen tickets or a payment would hide the very
/// thing these tests exist to pin down.
/// </summary>
internal static class OrderBuilder
{
    /// <summary>
    /// An open order with one line, no kitchen tickets and no payment. Eligible for
    /// both endings.
    /// </summary>
    public static Order Open()
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            RestaurantId = Guid.NewGuid(),
            TableId = Guid.NewGuid(),
            OrderNumber = 1,
            Status = OrderStatus.Open,
            CreatedByStaffId = Guid.NewGuid(),
            CreatedAtUtc = new DateTimeOffset(2026, 8, 24, 19, 0, 0, TimeSpan.Zero),
            UpdatedAtUtc = new DateTimeOffset(2026, 8, 24, 19, 0, 0, TimeSpan.Zero),
        };

        order.Items.Add(new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            MenuItemId = Guid.NewGuid(),
            ItemName = "Chicken Burger",
            UnitPrice = 12.50m,
            Quantity = 1,
            LineTotal = 12.50m,
            CreatedAtUtc = order.CreatedAtUtc,
        });

        // Priced through the same arithmetic the product uses, so a test that pays a
        // bill pays what the bill actually says. Setting Subtotal alone used to be
        // enough; it is not now that tax and a service charge sit on top of it.
        order.ServiceChargeRate = 0.10m;
        order.VatRate = 0.13m;
        order.RecalculateBill(12.50m);

        return order;
    }
}
