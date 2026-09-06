using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Reviews;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// How a review is stored.
/// </summary>
public sealed class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.HasKey(review => review.Id);

        builder.Property(review => review.Comment).HasMaxLength(Review.MaxCommentLength);

        // One review per order, held in the schema rather than only in the service.
        // A party leaves one view of one visit, and this is the check a retry or a
        // double tap runs into - which an application check alone cannot hold, because
        // two requests can both read "no review yet" before either writes.
        builder.HasIndex(review => review.OrderId).IsUnique();

        // What the manager's screen asks for: this restaurant's reviews, newest first.
        builder.HasIndex(review => new { review.RestaurantId, review.SubmittedAtUtc });

        // Bound to the restaurant on both sides, so a review cannot claim one restaurant
        // while pointing at another restaurant's order - that pair does not exist to
        // reference.
        builder.HasOne(review => review.Order)
            .WithMany()
            .HasForeignKey(review => new { review.OrderId, review.RestaurantId })
            .HasPrincipalKey(order => new { order.Id, order.RestaurantId })
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(review => review.Restaurant)
            .WithMany()
            .HasForeignKey(review => review.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);

        // Every scale is one to five, and the two optional ones are either a score in
        // that range or absent. Expressed in the schema as well as in the request
        // validation, because a rating of forty would quietly ruin every average a
        // manager ever reads and nothing downstream would notice.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Reviews_Ratings",
            $"[Rating] BETWEEN {Review.MinRating} AND {Review.MaxRating} " +
            $"AND ([FoodRating] IS NULL OR [FoodRating] BETWEEN {Review.MinRating} AND {Review.MaxRating}) " +
            $"AND ([ServiceRating] IS NULL OR [ServiceRating] BETWEEN {Review.MinRating} AND {Review.MaxRating})"));
    }
}
