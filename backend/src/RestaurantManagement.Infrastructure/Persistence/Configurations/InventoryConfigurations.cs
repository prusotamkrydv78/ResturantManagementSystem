using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Inventory;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps inventory items.</summary>
public sealed class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    /// <summary>
    /// Precision for every stock quantity in the system.
    ///
    /// Three decimal places, which is a gram in a kilogram and a millilitre in a litre.
    /// Enough for any real recipe and few enough that a balance stays exact under
    /// repeated addition, which a floating point column would not.
    /// </summary>
    public const int QuantityPrecision = 18;

    /// <summary>Decimal places kept on a quantity.</summary>
    public const int QuantityScale = 3;

    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("InventoryItems");

        builder.HasKey(item => item.Id);

        builder.Property(item => item.Name)
            .IsRequired()
            .HasMaxLength(InventoryItem.MaxNameLength);

        builder.Property(item => item.Unit)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>();

        builder.Property(item => item.QuantityInStock)
            .IsRequired()
            .HasPrecision(QuantityPrecision, QuantityScale);

        builder.Property(item => item.MinimumQuantity)
            .IsRequired()
            .HasPrecision(QuantityPrecision, QuantityScale);

        // One photograph at most, in its own table, and it goes when the item does.
        builder.HasOne(item => item.Image)
            .WithOne(image => image.InventoryItem)
            .HasForeignKey<InventoryItemImage>(image => image.InventoryItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Several people move stock at once: a waiter sending food to the kitchen and a
        // manager recording a delivery both change it. Without this one write silently
        // overwrites the other and the balance stops matching its own ledger.
        builder.Property(item => item.RowVersion).IsRowVersion();

        // All derived from the two quantities, so none of them are columns.
        builder.Ignore(item => item.IsOutOfStock);
        builder.Ignore(item => item.IsLowStock);
        builder.Ignore(item => item.IsNegative);

        // What a kitchen calls a thing is how it finds it, so two of them would be a
        // trap rather than a convenience.
        builder.HasIndex(item => new { item.RestaurantId, item.Name }).IsUnique();

        // The list is filtered on both of these constantly.
        builder.HasIndex(item => new { item.RestaurantId, item.IsActive });

        // Target of the composite foreign keys from movements and recipe lines, which is
        // what stops either referencing an item in a different restaurant.
        builder.HasAlternateKey(item => new { item.Id, item.RestaurantId });

        // NO ACTION on purpose. Deleting a restaurant must not silently destroy the
        // record of what its kitchen consumed.
        builder.HasOne(item => item.Restaurant)
            .WithMany()
            .HasForeignKey(item => item.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);

        // A reorder level below zero is not a level. The stock figure itself is
        // deliberately unconstrained: a negative balance is a true statement that more
        // was cooked than the records held, and clamping it would hide that.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_InventoryItems_MinimumQuantity",
            "[MinimumQuantity] >= 0"));
    }
}

/// <summary>Maps stock movements.</summary>
/// <summary>Maps the photograph belonging to an inventory item.</summary>
public sealed class InventoryItemImageConfiguration
    : IEntityTypeConfiguration<InventoryItemImage>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<InventoryItemImage> builder)
    {
        builder.ToTable("InventoryItemImages");

        // The item identifier is the key, so one picture per item is a fact about
        // the schema rather than a rule somebody has to remember to enforce.
        builder.HasKey(image => image.InventoryItemId);

        builder.Property(image => image.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(image => image.Content).IsRequired();

        // Not a foreign key to Restaurants: it is denormalised from the item so a
        // request can be authorised without a join, and the item already carries the
        // real relationship.
        builder.HasIndex(image => image.RestaurantId);
    }
}

public sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("StockMovements");

        builder.HasKey(movement => movement.Id);

        builder.Property(movement => movement.Kind)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>();

        builder.Property(movement => movement.QuantityDelta)
            .IsRequired()
            .HasPrecision(
                InventoryItemConfiguration.QuantityPrecision,
                InventoryItemConfiguration.QuantityScale);

        builder.Property(movement => movement.QuantityAfter)
            .IsRequired()
            .HasPrecision(
                InventoryItemConfiguration.QuantityPrecision,
                InventoryItemConfiguration.QuantityScale);

        builder.Property(movement => movement.Unit)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>();

        builder.Property(movement => movement.Reason)
            .HasMaxLength(StockMovement.MaxReasonLength);

        builder.Ignore(movement => movement.IsOutward);

        // The history of one item, newest first, which is the only way it is ever read.
        builder.HasIndex(movement => new
        {
            movement.InventoryItemId,
            movement.RecordedAtUtc,
        });

        // For answering what a given order consumed.
        builder.HasIndex(movement => movement.OrderId);

        builder.HasIndex(movement => new { movement.RestaurantId, movement.Kind });

        // The restaurant travels with the item reference and is bound to it, so a
        // movement cannot claim one restaurant while pointing at another restaurant
        // item: that pair does not exist to reference.
        //
        // NO ACTION rather than cascade. A movement is the record of something that
        // happened; it must not disappear because an item was tidied away, which is
        // also why an item with movements is archived instead of deleted.
        builder.HasOne(movement => movement.InventoryItem)
            .WithMany(item => item.Movements)
            .HasForeignKey(movement => new
            {
                movement.InventoryItemId,
                movement.RestaurantId,
            })
            .HasPrincipalKey(item => new { item.Id, item.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        // A movement of nothing is not a movement. Every kind either adds or subtracts,
        // so a zero delta would be a row that explains nothing and changes nothing.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_StockMovements_Delta",
            "[QuantityDelta] <> 0"));

        // The two kinds a person enters by hand must say why. The ones the system
        // writes for itself have their reason in the kind.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_StockMovements_Reason",
            "([Kind] IN ('Adjusted', 'Wasted') AND [Reason] IS NOT NULL) " +
            "OR [Kind] NOT IN ('Adjusted', 'Wasted')"));

        // Waste only ever leaves the shelf. Recording it as an increase would make
        // thrown-away food look like a delivery.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_StockMovements_WasteOutward",
            "[Kind] <> 'Wasted' OR [QuantityDelta] < 0"));

        // And consumption likewise: the kitchen takes stock, it does not return it.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_StockMovements_ConsumedOutward",
            "[Kind] <> 'Consumed' OR [QuantityDelta] < 0"));
    }
}

/// <summary>Maps recipe lines.</summary>
public sealed class MenuItemIngredientConfiguration
    : IEntityTypeConfiguration<MenuItemIngredient>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MenuItemIngredient> builder)
    {
        builder.ToTable("MenuItemIngredients");

        builder.HasKey(line => line.Id);

        builder.Property(line => line.Quantity)
            .IsRequired()
            .HasPrecision(
                InventoryItemConfiguration.QuantityPrecision,
                InventoryItemConfiguration.QuantityScale);

        builder.Property(line => line.Unit)
            .IsRequired()
            .HasMaxLength(16)
            .HasConversion<string>();

        // One ingredient appears at most once in a recipe. Two rows for the same thing
        // would be two answers to the same question, and summing them silently would
        // hide whichever was wrong.
        builder.HasIndex(line => new { line.MenuItemId, line.InventoryItemId })
            .IsUnique();

        builder.HasIndex(line => line.InventoryItemId);

        // Both sides bound to the restaurant by composite keys, so a recipe cannot
        // reach across restaurants in either direction.
        builder.HasOne(line => line.MenuItem)
            .WithMany()
            .HasForeignKey(line => new { line.MenuItemId, line.RestaurantId })
            .HasPrincipalKey(item => new { item.Id, item.RestaurantId })
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(line => line.InventoryItem)
            .WithMany()
            .HasForeignKey(line => new { line.InventoryItemId, line.RestaurantId })
            .HasPrincipalKey(item => new { item.Id, item.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_MenuItemIngredients_Quantity",
            "[Quantity] > 0"));
    }
}
