using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps payments.</summary>
public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");

        builder.HasKey(payment => payment.Id);

        builder.Property(payment => payment.Amount)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(payment => payment.Method)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>();

        builder.Property(payment => payment.RecordedByUserId).IsRequired();

        builder.Property(payment => payment.RecordedAtUtc).IsRequired();

        // The rule of this phase, in the schema rather than in a service.
        //
        // One order is paid for once. An application check cannot hold this on its
        // own: two managers pressing the button at the same instant both read "not
        // paid" before either writes. A second insert here fails outright, so
        // charging a table twice is impossible rather than unlikely.
        // Not unique any more. A bill can be settled in parts - half cash, half card -
        // and the order closes when the payments cover the total rather than when the
        // first one arrives. What used to be enforced here is now a sum on the order.
        builder.HasIndex(payment => payment.OrderId);

        // Groundwork for the questions a restaurant asks at the end of a shift:
        // what came in, and how much of it was cash. No report is built on these
        // yet, and neither index costs anything until one is.
        builder.HasIndex(payment => new { payment.RestaurantId, payment.RecordedAtUtc });
        builder.HasIndex(payment => new { payment.RestaurantId, payment.Method });

        // The restaurant travels with the order reference and is bound to it, so a
        // payment cannot claim one restaurant while pointing at another restaurant
        // order: that pair does not exist to reference.
        //
        // NO ACTION on purpose. A payment is the record that money changed hands and
        // must not disappear because something upstream was deleted. It also keeps
        // the restaurant from reaching a payment by two cascade paths, which SQL
        // Server rejects outright.
        builder.HasOne(payment => payment.Order)
            .WithMany(order => order.Payments)
            .HasForeignKey(payment => new
            {
                payment.OrderId,
                payment.RestaurantId,
            })
            .HasPrincipalKey(order => new
            {
                order.Id,
                order.RestaurantId,
            })
            .OnDelete(DeleteBehavior.NoAction);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Payments_Amount",
            "[Amount] >= 0"));
    }
}
