using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps orders.</summary>
public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");

        builder.HasKey(order => order.Id);

        builder.Property(order => order.OrderNumber).IsRequired();

        builder.Property(order => order.Status)
            .IsRequired()
            .HasMaxLength(24)
            .HasConversion<string>()
            .HasDefaultValue(OrderStatus.Open);

        builder.Property(order => order.Subtotal)
            .IsRequired()
            .HasPrecision(18, 2);

        // Maintained by SQL Server. EF compares it on update and raises a
        // concurrency exception when someone else has saved in the meantime.
        builder.Property(order => order.RowVersion).IsRowVersion();

        // Target of the composite foreign key from KitchenTicket, which is what
        // stops a ticket referencing an order in a different restaurant.
        builder.HasAlternateKey(order => new { order.Id, order.RestaurantId });

        // All derived, so none of them are columns. IsPaid and the kitchen count
        // read navigations; CanComplete is composed from the other three.
        builder.Ignore(order => order.IsEditable);
        builder.Ignore(order => order.IsPaid);
        builder.Ignore(order => order.UnfinishedKitchenTicketCount);
        builder.Ignore(order => order.UnsentItemCount);
        builder.Ignore(order => order.StartedKitchenTicketCount);
        builder.Ignore(order => order.CanComplete);
        builder.Ignore(order => order.CanCancel);
        builder.Ignore(order => order.IsSelfService);

        builder.Property(order => order.Source)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>()
            .HasDefaultValue(OrderSource.Staff);

        // Answering "what did this guest eat" without walking every order.
        builder.HasIndex(order => order.CustomerId);

        // The key a customer holds for their own order. Filtered, because only the
        // handful of orders placed from a website carry one and an index over a
        // column that is null for everything else is mostly empty pages.
        builder.Property(order => order.PublicCancelKey).HasMaxLength(32);

        builder.HasIndex(order => order.PublicCancelKey)
            .IsUnique()
            .HasFilter("[PublicCancelKey] IS NOT NULL");

        // Bound to the restaurant on both sides, so an order cannot be attributed to a
        // customer of a different restaurant.
        builder.HasOne<Domain.Customers.Customer>()
            .WithMany()
            .HasForeignKey(order => new { order.CustomerId, order.RestaurantId })
            .HasPrincipalKey(customer => new { customer.Id, customer.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        // A guest order has no staff member behind it, and a staff order must have one.
        // Holds the pairing against a hand-written UPDATE as well as against the code.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Orders_Source",
            "([Source] = 'QrCode' AND [CreatedByStaffId] IS NULL) " +
            "OR ([Source] <> 'QrCode' AND [CreatedByStaffId] IS NOT NULL)"));

        // Long enough for a real sentence, short enough that it stays a reason
        // rather than becoming a notes field.
        builder.Property(order => order.CancellationReason).HasMaxLength(200);

        // Open orders are what both the waiter list and the billing queue ask for,
        // and completed ones are what a future takings figure would.
        builder.HasIndex(order => new { order.RestaurantId, order.CompletedAtUtc });

        // What makes the readable number safe: a colliding insert fails instead of
        // silently producing two "order 7" in the same restaurant.
        builder.HasIndex(order => new { order.RestaurantId, order.OrderNumber })
            .IsUnique();

        builder.HasIndex(order => new { order.RestaurantId, order.Status });
        builder.HasIndex(order => new { order.RestaurantId, order.CreatedAtUtc });
        builder.HasIndex(order => order.CreatedByStaffId);

        // Every relationship out of an order is NO ACTION on purpose.
        //
        // An order is a financial record: it must not disappear because a table was
        // removed or a staff account was cleaned up, and history must never be
        // destroyed as a side effect of deleting something else. This also keeps the
        // restaurant from reaching an order by two different cascade paths, which
        // SQL Server rejects outright.
        builder.HasOne(order => order.Restaurant)
            .WithMany()
            .HasForeignKey(order => order.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(order => order.Table)
            .WithMany()
            .HasForeignKey(order => order.TableId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Orders_Subtotal",
            "[Subtotal] >= 0"));

        // The status and the record of how the order ended cannot drift apart.
        //
        // A cancelled order must carry when and why; anything else must carry neither,
        // nor a canceller. Expressed in the schema as well as on the entity, because
        // the entity only guards the transition: this also holds against a hand
        // written UPDATE or a later code path that forgets one of the columns.
        //
        // Who is no longer required on the cancelled branch. A customer can now call
        // off their own order from their phone, and there is no account behind that -
        // naming a member of staff would be a lie, and naming nobody is the truth.
        // The reason still carries what happened.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Orders_Cancellation",
            "([Status] = 'Cancelled' " +
            "AND [CancelledAtUtc] IS NOT NULL " +
            "AND [CancellationReason] IS NOT NULL) " +
            "OR ([Status] <> 'Cancelled' " +
            "AND [CancelledAtUtc] IS NULL " +
            "AND [CancelledByUserId] IS NULL " +
            "AND [CancellationReason] IS NULL)"));

        // The same for the other ending: only a completed order has a closing time.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Orders_Completion",
            "([Status] = 'Completed' AND [CompletedAtUtc] IS NOT NULL) " +
            "OR ([Status] <> 'Completed' AND [CompletedAtUtc] IS NULL)"));
    }
}

/// <summary>Maps order lines.</summary>
public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    /// <summary>Largest quantity accepted on a single line.</summary>
    public const int MaxQuantity = 99;

    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems");

        builder.HasKey(item => item.Id);

        // Snapshot columns. Sized generously enough to hold any menu item name this
        // system allows, so a snapshot can never be truncated.
        builder.Property(item => item.ItemName)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(item => item.UnitPrice)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(item => item.LineTotal)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(item => item.Quantity).IsRequired();

        builder.Property(item => item.Note).HasMaxLength(200);

        // Derived from whether a kitchen ticket line points here, so not a column.
        builder.Ignore(item => item.IsSubmittedToKitchen);

        builder.HasIndex(item => item.OrderId);

        // Useful later for grouping sales by menu item. Not a foreign key: see the
        // note on the entity.
        builder.HasIndex(item => item.MenuItemId);

        // Lines have no meaning without their order, so this one does cascade.
        builder.HasOne(item => item.Order)
            .WithMany(order => order.Items)
            .HasForeignKey(item => item.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_OrderItems_Quantity",
            $"[Quantity] >= 1 AND [Quantity] <= {MaxQuantity}"));

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_OrderItems_Money",
            "[UnitPrice] >= 0 AND [LineTotal] >= 0"));
    }
}
