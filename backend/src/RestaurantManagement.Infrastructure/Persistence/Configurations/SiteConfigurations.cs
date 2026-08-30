using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Sites;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps the one-page website belonging to a restaurant.</summary>
public sealed class RestaurantSiteConfiguration : IEntityTypeConfiguration<RestaurantSite>
{
    /// <summary>Applies the configuration.</summary>
    public void Configure(EntityTypeBuilder<RestaurantSite> builder)
    {
        builder.ToTable("RestaurantSites");

        builder.HasKey(site => site.Id);

        // One page per restaurant, in the schema rather than only in the service.
        // The service creates the row lazily on first read, so two requests arriving
        // together would otherwise both find nothing and both insert.
        builder.HasIndex(site => site.RestaurantId).IsUnique();

        builder.Property(site => site.Template)
            .HasConversion<int>()
            .IsRequired();

        // Unbounded on purpose: this is the whole page, and a restaurant with a long
        // story should not lose the end of it to a column width.
        builder.Property(site => site.ContentJson)
            .IsRequired();

        builder.Property(site => site.IsPublished)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(site => site.CreatedAtUtc).IsRequired();
        builder.Property(site => site.UpdatedAtUtc).IsRequired();

        builder.HasOne(site => site.Restaurant)
            .WithOne()
            .HasForeignKey<RestaurantSite>(site => site.RestaurantId)
            // A restaurant is never deleted in this product, only suspended, so this
            // is a statement of ownership rather than a path anything walks.
            .OnDelete(DeleteBehavior.Cascade);

        // Answering a visitor is a lookup by slug on the restaurant filtered to
        // published, which is the only query that runs on a request nobody
        // authenticated. Published pages are the small half of this table.
        builder.HasIndex(site => site.IsPublished)
            .HasFilter("[IsPublished] = 1");
    }
}

/// <summary>Maps the images uploaded for a website.</summary>
public sealed class SiteImageConfiguration : IEntityTypeConfiguration<SiteImage>
{
    /// <summary>Applies the configuration.</summary>
    public void Configure(EntityTypeBuilder<SiteImage> builder)
    {
        builder.ToTable("SiteImages");

        builder.HasKey(image => image.Id);

        builder.Property(image => image.FileName)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(image => image.ContentType)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(image => image.ByteCount).IsRequired();

        builder.Property(image => image.Content)
            .IsRequired();

        builder.Property(image => image.CreatedAtUtc).IsRequired();

        builder.HasOne(image => image.RestaurantSite)
            .WithMany(site => site.Images)
            .HasForeignKey(image => image.RestaurantSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        // Every manager-facing query filters on this: the picker lists by restaurant,
        // the cap counts by restaurant, and a delete is scoped by it so an identifier
        // from elsewhere finds nothing.
        builder.HasIndex(image => image.RestaurantId);
    }
}
