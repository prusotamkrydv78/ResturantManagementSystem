using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps the restaurant table and its ownership relationship.</summary>
public sealed class RestaurantConfiguration : IEntityTypeConfiguration<Restaurant>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Restaurant> builder)
    {
        builder.ToTable("Restaurants");

        builder.HasKey(restaurant => restaurant.Id);

        builder.Property(restaurant => restaurant.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(restaurant => restaurant.Slug)
            .IsRequired()
            .HasMaxLength(120);

        builder.HasIndex(restaurant => restaurant.Slug).IsUnique();

        builder.Property(restaurant => restaurant.ContactEmail).HasMaxLength(256);
        builder.Property(restaurant => restaurant.ContactPhone).HasMaxLength(32);
        builder.Property(restaurant => restaurant.AddressLine).HasMaxLength(256);
        builder.Property(restaurant => restaurant.City).HasMaxLength(100);

        // An ISO 4217 code is exactly three letters, so the column says three rather
        // than leaving it as unbounded text.
        builder.Property(restaurant => restaurant.Currency)
            .IsRequired()
            .HasMaxLength(Domain.Restaurants.Restaurant.CurrencyLength)
            .HasDefaultValue(Domain.Restaurants.Restaurant.DefaultCurrency);

        // Four decimal places, not two. A rate is not money: two places cannot hold
        // seven and a half per cent, and silently truncating 0.075 to 0.08 would
        // overcharge every table in the restaurant.
        builder.Property(restaurant => restaurant.VatRate)
            .HasPrecision(6, 4)
            .HasDefaultValue(Domain.Restaurants.Restaurant.DefaultVatRate);

        builder.Property(restaurant => restaurant.ServiceChargeRate)
            .HasPrecision(6, 4)
            .HasDefaultValue(Domain.Restaurants.Restaurant.DefaultServiceChargeRate);

        // Neither can be negative, and neither can plausibly exceed the bill itself.
        // A typo that puts a rate at 13 instead of 0.13 would multiply every bill by
        // fourteen, so the schema refuses it rather than trusting the form.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Restaurants_Rates",
            "[VatRate] >= 0 AND [VatRate] <= 1 " +
            "AND [ServiceChargeRate] >= 0 AND [ServiceChargeRate] <= 1"));
        builder.Property(restaurant => restaurant.Country).HasMaxLength(100);

        // Defaulted true so the column arrives on existing rows as trading rather than
        // suspended. A migration that quietly stopped every restaurant on the platform
        // would be discovered by a waiter, not by whoever applied it.
        builder.Property(restaurant => restaurant.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // One manager per restaurant, and one restaurant per manager. The filter is
        // required because SQL Server treats multiple NULLs in a unique index as
        // duplicates, and unassigned restaurants all have a NULL ManagerId.
        builder.HasIndex(restaurant => restaurant.ManagerId)
            .IsUnique()
            .HasFilter("[ManagerId] IS NOT NULL");

        // Restrict rather than cascade: deleting a user must not silently delete or
        // orphan the restaurant they manage.
        builder.HasOne(restaurant => restaurant.Manager)
            .WithOne()
            .HasForeignKey<Restaurant>(restaurant => restaurant.ManagerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
