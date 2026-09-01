using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Menu;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps menu categories.</summary>
public sealed class MenuCategoryConfiguration : IEntityTypeConfiguration<MenuCategory>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MenuCategory> builder)
    {
        builder.ToTable("MenuCategories");

        builder.HasKey(category => category.Id);

        builder.Property(category => category.Name)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(category => category.Description)
            .HasMaxLength(400);

        builder.Property(category => category.DisplayOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(category => category.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // Unique inside the restaurant only, so two restaurants can both have a
        // "Drinks". The default collation is case-insensitive, so "drinks" collides
        // with "Drinks", which is what a manager would expect.
        builder.HasIndex(category => new { category.RestaurantId, category.Name })
            .IsUnique();

        builder.HasIndex(category => new { category.RestaurantId, category.DisplayOrder });

        // One photograph at most, in its own table, and it goes when the section does.
        builder.HasOne(category => category.Image)
            .WithOne(image => image.MenuCategory)
            .HasForeignKey<MenuCategoryImage>(image => image.MenuCategoryId)
            .OnDelete(DeleteBehavior.Cascade);

        // Target of the composite foreign key on MenuItem below. Declaring it here
        // is what lets the database guarantee an item and its category always agree
        // about which restaurant they belong to.
        builder.HasAlternateKey(category => new { category.Id, category.RestaurantId });

        builder.HasOne(category => category.Restaurant)
            .WithMany()
            .HasForeignKey(category => category.RestaurantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>Maps menu items.</summary>
public sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("MenuItems");

        builder.HasKey(item => item.Id);

        builder.Property(item => item.Name)
            .IsRequired()
            .HasMaxLength(120);

        builder.Property(item => item.Description)
            .HasMaxLength(600);

        // Money: exact decimal storage, never a floating-point type.
        builder.Property(item => item.Price)
            .IsRequired()
            .HasPrecision(18, 2);

        builder.Property(item => item.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasIndex(item => new { item.RestaurantId, item.IsActive });
        builder.HasIndex(item => new { item.RestaurantId, item.CategoryId });

        // One photograph at most, in its own table, and it goes when the item does.
        builder.HasOne(item => item.Image)
            .WithOne(image => image.MenuItem)
            .HasForeignKey<MenuItemImage>(image => image.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // The whole point of this configuration.
        //
        // The foreign key carries RestaurantId as well as CategoryId, and points at
        // the category alternate key (Id, RestaurantId). An item claiming category C
        // while claiming restaurant R2 would have to reference the pair (C, R2),
        // which does not exist when C belongs to R1. Cross-restaurant attachment is
        // therefore rejected by the database rather than only by application code.
        //
        // There is intentionally no second, direct foreign key from the item to the
        // restaurant: it would add a competing cascade path, and integrity already
        // holds through the category.
        // Target of the composite foreign key from a recipe line, which is what stops
        // a recipe referencing a menu item in a different restaurant.
        builder.HasAlternateKey(item => new { item.Id, item.RestaurantId });

        builder.HasOne(item => item.Category)
            .WithMany(category => category.Items)
            .HasForeignKey(item => new { item.CategoryId, item.RestaurantId })
            .HasPrincipalKey(category => new { category.Id, category.RestaurantId })
            .OnDelete(DeleteBehavior.Cascade);

        // A price is never negative. Zero is allowed on purpose: complimentary
        // items such as table water still belong on a menu.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_MenuItems_Price",
            "[Price] >= 0"));
    }
}

/// <summary>Maps the photograph heading a menu section.</summary>
public sealed class MenuCategoryImageConfiguration
    : IEntityTypeConfiguration<MenuCategoryImage>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MenuCategoryImage> builder)
    {
        builder.ToTable("MenuCategoryImages");

        builder.HasKey(image => image.MenuCategoryId);

        builder.Property(image => image.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(image => image.Content).IsRequired();

        builder.HasIndex(image => image.RestaurantId);
    }
}

/// <summary>Maps the photograph belonging to a menu item.</summary>
public sealed class MenuItemImageConfiguration : IEntityTypeConfiguration<MenuItemImage>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<MenuItemImage> builder)
    {
        builder.ToTable("MenuItemImages");

        // The item identifier is the key, so one picture per item is a fact about the
        // schema rather than a rule somebody has to remember.
        builder.HasKey(image => image.MenuItemId);

        builder.Property(image => image.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(image => image.Content).IsRequired();

        // Denormalised from the item so a request can be authorised without a join;
        // the item already carries the real relationship.
        builder.HasIndex(image => image.RestaurantId);
    }
}
