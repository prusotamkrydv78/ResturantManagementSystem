using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Reservations;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps customers.</summary>
public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Customers");

        builder.HasKey(customer => customer.Id);

        builder.Property(customer => customer.Name)
            .IsRequired()
            .HasMaxLength(Customer.MaxNameLength);

        builder.Property(customer => customer.Phone)
            .HasMaxLength(Customer.MaxPhoneLength);

        builder.Property(customer => customer.Email)
            .HasMaxLength(Customer.MaxEmailLength);

        builder.Property(customer => customer.Notes)
            .HasMaxLength(Customer.MaxNotesLength);

        // One number, one customer, within a restaurant.
        //
        // Filtered, because a phone number is optional and SQL Server treats several
        // NULLs in a unique index as duplicates: without the filter a restaurant could
        // record only one customer whose number was unknown.
        builder.HasIndex(customer => new { customer.RestaurantId, customer.Phone })
            .IsUnique()
            .HasFilter("[Phone] IS NOT NULL");

        // Searching is by name and by number, and the list filters on active.
        builder.HasIndex(customer => new { customer.RestaurantId, customer.Name });
        builder.HasIndex(customer => new { customer.RestaurantId, customer.IsActive });

        // Target of the composite foreign keys from reservations and orders, which is
        // what stops either referencing a customer in a different restaurant.
        builder.HasAlternateKey(customer => new { customer.Id, customer.RestaurantId });

        // NO ACTION on purpose: removing a restaurant must not silently take its
        // customer history with it.
        builder.HasOne(customer => customer.Restaurant)
            .WithMany()
            .HasForeignKey(customer => customer.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

/// <summary>Maps reservations.</summary>
public sealed class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("Reservations");

        builder.HasKey(reservation => reservation.Id);

        builder.Property(reservation => reservation.Status)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>()
            .HasDefaultValue(ReservationStatus.Pending);

        builder.Property(reservation => reservation.GuestCount).IsRequired();

        builder.Property(reservation => reservation.DurationMinutes)
            .IsRequired()
            .HasDefaultValue(Reservation.DefaultDurationMinutes);

        builder.Property(reservation => reservation.Notes)
            .HasMaxLength(Reservation.MaxNotesLength);

        builder.Property(reservation => reservation.CancellationReason)
            .HasMaxLength(Reservation.MaxNotesLength);

        // Two people confirming or seating the same booking at once is realistic on a
        // busy service, so the second write fails rather than undoing the first.
        builder.Property(reservation => reservation.RowVersion).IsRowVersion();

        // All derived from the status and the times, so none of them are columns.
        builder.Ignore(reservation => reservation.EndsAtUtc);
        builder.Ignore(reservation => reservation.HoldsTable);
        builder.Ignore(reservation => reservation.IsClosed);
        builder.Ignore(reservation => reservation.CanConfirm);
        builder.Ignore(reservation => reservation.CanSeat);
        builder.Ignore(reservation => reservation.CanComplete);
        builder.Ignore(reservation => reservation.CanCancel);
        builder.Ignore(reservation => reservation.IsEditable);

        // The two questions every screen asks: what is on today, and what is coming.
        builder.HasIndex(reservation => new
        {
            reservation.RestaurantId,
            reservation.ReservedForUtc,
        });

        builder.HasIndex(reservation => new
        {
            reservation.RestaurantId,
            reservation.Status,
        });

        // Clash detection reads every live booking for one table.
        builder.HasIndex(reservation => new
        {
            reservation.TableId,
            reservation.ReservedForUtc,
        });

        builder.HasIndex(reservation => reservation.CustomerId);

        // Both sides carry the restaurant and are bound to it, so a booking cannot hold
        // one restaurant table for another restaurant customer: neither pair exists to
        // be referenced.
        builder.HasOne(reservation => reservation.Customer)
            .WithMany()
            .HasForeignKey(reservation => new
            {
                reservation.CustomerId,
                reservation.RestaurantId,
            })
            .HasPrincipalKey(customer => new { customer.Id, customer.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(reservation => reservation.Table)
            .WithMany()
            .HasForeignKey(reservation => new
            {
                reservation.TableId,
                reservation.RestaurantId,
            })
            .HasPrincipalKey(table => new { table.Id, table.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(reservation => reservation.Restaurant)
            .WithMany()
            .HasForeignKey(reservation => reservation.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Reservations_GuestCount",
            $"[GuestCount] >= {Reservation.MinGuests} " +
            $"AND [GuestCount] <= {Reservation.MaxGuests}"));

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Reservations_Duration",
            $"[DurationMinutes] >= {Reservation.MinDurationMinutes} " +
            $"AND [DurationMinutes] <= {Reservation.MaxDurationMinutes}"));

        // A seated booking must say where. Showing guests to no table in particular is
        // not a state this product can describe, and the entity refuses it too; this
        // holds the same rule against a hand-written UPDATE.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Reservations_SeatedHasTable",
            "[Status] <> 'Seated' OR [TableId] IS NOT NULL"));

        // Only a cancelled booking may carry a cancellation reason, so a stray reason on
        // a live booking cannot be mistaken for one.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Reservations_CancellationReason",
            "[Status] = 'Cancelled' OR [CancellationReason] IS NULL"));
    }
}
