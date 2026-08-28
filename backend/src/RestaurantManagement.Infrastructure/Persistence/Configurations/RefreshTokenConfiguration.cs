using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>Maps the refresh token table.</summary>
public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");

        builder.HasKey(token => token.Id);

        // SHA-256 as Base64 is always 44 characters.
        builder.Property(token => token.TokenHash)
            .IsRequired()
            .HasMaxLength(64);

        // Lookups happen by hash on every refresh, and the value must be unique.
        builder.HasIndex(token => token.TokenHash).IsUnique();

        builder.HasIndex(token => token.UserId);
    }
}
