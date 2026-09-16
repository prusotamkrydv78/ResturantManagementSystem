using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Media;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// The picture library.
///
/// The index is on the restaurant and the date together, because every read of this
/// table is "this restaurant's pictures, newest first" and nothing else ever queries
/// it another way.
/// </summary>
public sealed class RestaurantMediaConfiguration : IEntityTypeConfiguration<RestaurantMedia>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<RestaurantMedia> builder)
    {
        builder.ToTable("RestaurantMedia");

        builder.HasKey(media => media.Id);

        builder.Property(media => media.ContentType).IsRequired().HasMaxLength(100);
        builder.Property(media => media.FileName).IsRequired().HasMaxLength(128);
        builder.Property(media => media.Content).IsRequired();

        builder
            .HasOne(media => media.Restaurant)
            .WithMany()
            .HasForeignKey(media => media.RestaurantId)
            // A restaurant being removed takes its pictures with it. Nothing else
            // points at them, so there is nothing left to orphan.
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(media => new { media.RestaurantId, media.CreatedAtUtc });
    }
}
