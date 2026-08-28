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

        // Long enough for any IANA identifier, and defaulted so every restaurant that
        // already exists gets a boundary it can be reasoned about rather than a null
        // the day calculation would have to guess around.
        builder.Property(restaurant => restaurant.TimeZoneId)
            .IsRequired()
            .HasMaxLength(64)
            .HasDefaultValue(Restaurant.DefaultTimeZoneId);

        builder.Property(restaurant => restaurant.DayStartHour)
            .IsRequired()
            .HasDefaultValue(Restaurant.DefaultDayStartHour);

        // Defaulted true so the column arrives on existing rows as trading rather than
        // suspended. A migration that quietly stopped every restaurant on the platform
        // would be discovered by a waiter, not by whoever applied it.
        builder.Property(restaurant => restaurant.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // An hour outside the clock is not a configuration mistake to be corrected
        // later, it is a value the day calculation cannot use at all.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Restaurants_DayStartHour",
            $"[DayStartHour] >= {Restaurant.MinDayStartHour} " +
            $"AND [DayStartHour] <= {Restaurant.MaxDayStartHour}"));

        builder.Property(restaurant => restaurant.ContactEmail).HasMaxLength(256);
        builder.Property(restaurant => restaurant.ContactPhone).HasMaxLength(32);
        builder.Property(restaurant => restaurant.AddressLine).HasMaxLength(256);
        builder.Property(restaurant => restaurant.City).HasMaxLength(100);
        builder.Property(restaurant => restaurant.Country).HasMaxLength(100);

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
