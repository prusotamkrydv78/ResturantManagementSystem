using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Sites;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// A restaurant's page.
///
/// The key is the restaurant, which is what makes "one page per restaurant" a fact
/// about the schema rather than a rule somebody has to remember.
/// </summary>
public sealed class RestaurantSiteConfiguration : IEntityTypeConfiguration<RestaurantSite>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<RestaurantSite> builder)
    {
        builder.ToTable("RestaurantSites");

        builder.HasKey(site => site.RestaurantId);

        builder.Property(site => site.Design).IsRequired().HasMaxLength(40);
        builder.Property(site => site.PublishedDesign).HasMaxLength(40);

        // No length on either column. The cap is enforced in the service, in bytes,
        // before anything is written; declaring a character length here as well would
        // be a second limit in a different unit, and the two would disagree the first
        // time somebody wrote an accented character.
        builder.Property(site => site.DraftJson).IsRequired();

        builder
            .HasOne(site => site.Restaurant)
            .WithOne()
            .HasForeignKey<RestaurantSite>(site => site.RestaurantId)
            .OnDelete(DeleteBehavior.Cascade);

        // Every public read is by slug and published flag, and it is the one query on
        // this table that a stranger can cause.
        builder.HasIndex(site => site.IsPublished);
    }
}
