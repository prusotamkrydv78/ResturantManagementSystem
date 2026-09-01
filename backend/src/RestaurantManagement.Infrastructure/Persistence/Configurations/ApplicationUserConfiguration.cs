using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps the profile fields added on top of the Identity user.</summary>
public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(user => user.FullName)
            .IsRequired()
            .HasMaxLength(100);

        // Stored as text so the column is readable in the database and adding a role
        // later does not shift the meaning of existing rows.
        builder.Property(user => user.PlatformRole)
            .IsRequired()
            .HasMaxLength(32)
            .HasConversion<string>()
            .HasDefaultValue(PlatformRole.User);

        builder.Property(user => user.StaffRole)
            .HasMaxLength(32)
            .HasConversion<string>();

        builder.Property(user => user.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // Staff membership. Restrict so a restaurant with staff cannot be deleted
        // out from under them, and so removing a person never cascades.
        builder.HasOne(user => user.Restaurant)
            .WithMany()
            .HasForeignKey(user => user.RestaurantId)
            .OnDelete(DeleteBehavior.Restrict);

        // Every staff listing filters on these two together.
        builder.HasIndex(user => new { user.RestaurantId, user.PlatformRole });

        // A staff role without a restaurant, or a restaurant without a staff role,
        // is a meaningless record. Enforced in the database rather than trusted to
        // application code.
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_AspNetUsers_StaffAssignment",
            "([StaffRole] IS NULL AND [RestaurantId] IS NULL) "
            + "OR ([StaffRole] IS NOT NULL AND [RestaurantId] IS NOT NULL)"));

        // One photograph at most, in its own table, and it goes when the account
        // does. Cascade rather than restrict: unlike a movement or an order, nobody
        // needs to look a deleted person's face up afterwards.
        builder.HasOne(user => user.Image)
            .WithOne(image => image.User)
            .HasForeignKey<StaffImage>(image => image.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(user => user.RefreshTokens)
            .WithOne(token => token.User)
            .HasForeignKey(token => token.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>Maps a staff member's photograph.</summary>
public sealed class StaffImageConfiguration : IEntityTypeConfiguration<StaffImage>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<StaffImage> builder)
    {
        builder.ToTable("StaffImages");

        // The account identifier is the key, so one picture per person is a fact
        // about the schema rather than a rule to remember.
        builder.HasKey(image => image.UserId);

        builder.Property(image => image.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(image => image.Content).IsRequired();

        builder.HasIndex(image => image.RestaurantId);
    }
}
