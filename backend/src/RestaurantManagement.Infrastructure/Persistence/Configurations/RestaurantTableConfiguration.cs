using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps the restaurant table entity.</summary>
public sealed class RestaurantTableConfiguration : IEntityTypeConfiguration<RestaurantTable>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<RestaurantTable> builder)
    {
        builder.ToTable("RestaurantTables");

        builder.HasKey(table => table.Id);

        builder.Property(table => table.Name)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(table => table.Capacity)
            .IsRequired();

        // Stored as text so the column reads clearly and adding a state later does
        // not shift the meaning of existing rows.
        builder.Property(table => table.Status)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>()
            .HasDefaultValue(TableStatus.Available);

        builder.Property(table => table.PublicOrderingToken)
            .IsRequired()
            .HasMaxLength(RestaurantTable.TokenLength);

        // Unique across the platform, not merely within a restaurant. A public link
        // carries nothing but this, so two tables sharing one would let a guest order
        // onto whichever the database happened to return.
        builder.HasIndex(table => table.PublicOrderingToken).IsUnique();

        builder.Property(table => table.IsOrderingEnabled)
            .IsRequired()
            .HasDefaultValue(false);

        // Derived from three columns, so not one itself.
        builder.Ignore(table => table.AcceptsPublicOrders);

        // Target of the composite foreign key from a reservation, which is what stops a
        // booking holding a table in another restaurant.
        builder.HasAlternateKey(table => new { table.Id, table.RestaurantId });

        builder.Property(table => table.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // The name only has to be unique inside its own restaurant, so two
        // restaurants can both have a "Table 1". The default SQL Server collation
        // is case-insensitive, so "table 1" collides with "Table 1", which is what
        // a manager would expect.
        //
        // Inactive tables are included: two tables sharing a name in one restaurant
        // would be confusing even when one is out of service, and the old one can
        // be reactivated instead.
        builder.HasIndex(table => new { table.RestaurantId, table.Name }).IsUnique();

        // Common listing order.
        builder.HasIndex(table => new { table.RestaurantId, table.IsActive });

        // Cascade: tables have no meaning without their restaurant, and a restaurant
        // cannot be deleted while staff reference it anyway.
        builder.HasOne(table => table.Restaurant)
            .WithMany()
            .HasForeignKey(table => table.RestaurantId)
            .OnDelete(DeleteBehavior.Cascade);

        // Guard the value at the storage layer too, not only in the request model.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_RestaurantTables_Capacity",
            "[Capacity] >= 1 AND [Capacity] <= 100"));
    }
}
