using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps kitchen tickets.</summary>
public sealed class KitchenTicketConfiguration : IEntityTypeConfiguration<KitchenTicket>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<KitchenTicket> builder)
    {
        builder.ToTable("KitchenTickets");

        builder.HasKey(ticket => ticket.Id);

        builder.Property(ticket => ticket.TicketNumber).IsRequired();

        builder.Property(ticket => ticket.Status)
            .IsRequired()
            .HasMaxLength(24)
            .HasConversion<string>()
            .HasDefaultValue(KitchenTicketStatus.Pending);

        // Maintained by SQL Server. EF compares it on update, so two chefs starting
        // the same ticket cannot both succeed: the second write matches no row and
        // is reported as a conflict.
        builder.Property(ticket => ticket.RowVersion).IsRowVersion();

        // All derived from Status, so none of them are columns.
        builder.Ignore(ticket => ticket.IsActiveWork);
        builder.Ignore(ticket => ticket.CanStart);
        builder.Ignore(ticket => ticket.CanMarkReady);

        // What makes the callable number safe: a colliding insert fails rather than
        // producing two "KOT 12" on the same rail.
        builder.HasIndex(ticket => new { ticket.RestaurantId, ticket.TicketNumber })
            .IsUnique();

        // Looking a ticket up by its order is covered by the composite foreign key
        // below, whose index leads with OrderId, so no separate index is declared.
        builder.HasIndex(ticket => new { ticket.RestaurantId, ticket.Status });

        // The restaurant travels with the order reference and is bound to it, so a
        // ticket cannot claim one restaurant while pointing at another restaurant
        // order: that pair does not exist to reference.
        //
        // NO ACTION on purpose. Kitchen history is a record of what was cooked and
        // must not vanish because something upstream was deleted. It also keeps the
        // restaurant from reaching ticket lines by two cascade paths, which SQL
        // Server rejects outright.
        builder.HasOne(ticket => ticket.Order)
            .WithMany(order => order.KitchenTickets)
            .HasForeignKey(ticket => new { ticket.OrderId, ticket.RestaurantId })
            .HasPrincipalKey(order => new { order.Id, order.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);
    }
}

/// <summary>Maps kitchen ticket lines.</summary>
public sealed class KitchenTicketItemConfiguration
    : IEntityTypeConfiguration<KitchenTicketItem>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<KitchenTicketItem> builder)
    {
        builder.ToTable("KitchenTicketItems");

        builder.HasKey(item => item.Id);

        // Copies of what the kitchen was told, sized to match the order line so a
        // name can never be truncated on its way to the ticket.
        builder.Property(item => item.ItemName)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(item => item.Quantity).IsRequired();

        builder.Property(item => item.Note).HasMaxLength(200);

        // The whole point of this configuration.
        //
        // One order line can appear on at most one ticket. Two waiters submitting the
        // same order at the same instant means the second insert violates this index
        // and the submission is refused, rather than the kitchen receiving the same
        // food twice.
        builder.HasIndex(item => item.OrderItemId).IsUnique();

        builder.HasIndex(item => item.KitchenTicketId);

        // Lines have no meaning without their ticket, so this one cascades.
        builder.HasOne(item => item.KitchenTicket)
            .WithMany(ticket => ticket.Items)
            .HasForeignKey(item => item.KitchenTicketId)
            .OnDelete(DeleteBehavior.Cascade);

        // NO ACTION, so an order line cannot be deleted out from under a ticket that
        // already told the kitchen to cook it. This is also the second half of
        // avoiding a multiple cascade path from Orders to these rows.
        builder.HasOne(item => item.OrderItem)
            .WithOne(orderItem => orderItem.KitchenTicketItem)
            .HasForeignKey<KitchenTicketItem>(item => item.OrderItemId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_KitchenTicketItems_Quantity",
            "[Quantity] >= 1"));
    }
}
