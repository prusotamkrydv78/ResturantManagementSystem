using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RestaurantManagement.Domain.Platform;

namespace RestaurantManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// The append-only record of what platform administrators have done.
/// </summary>
public sealed class AdminActivityConfiguration : IEntityTypeConfiguration<AdminActivity>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<AdminActivity> builder)
    {
        builder.HasKey(activity => activity.Id);

        builder.Property(activity => activity.ActorName).HasMaxLength(200).IsRequired();
        builder.Property(activity => activity.Action).HasMaxLength(60).IsRequired();
        builder.Property(activity => activity.Subject).HasMaxLength(200).IsRequired();
        builder.Property(activity => activity.Detail).HasMaxLength(500);

        // Newest first is the only way this table is ever read, so the index is built
        // for that rather than for the primary key it will never be searched by.
        builder
            .HasIndex(activity => activity.AtUtc)
            .IsDescending()
            .HasDatabaseName("IX_AdminActivities_AtUtc_Desc");

        // Deliberately no foreign key to the acting account. The name is snapshotted,
        // and a log that a deletion could cascade away is not a log.
        builder.HasIndex(activity => activity.Action);
    }
}

/// <summary>
/// The single row of platform-wide defaults.
/// </summary>
public sealed class PlatformSettingsConfiguration : IEntityTypeConfiguration<PlatformSettings>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<PlatformSettings> builder)
    {
        builder.HasKey(settings => settings.Id);

        // The same precision the rates carry everywhere else in the schema, so a value
        // written here and a value copied onto a restaurant cannot round differently.
        builder.Property(settings => settings.DefaultVatRate).HasPrecision(6, 4);
        builder.Property(settings => settings.DefaultServiceChargeRate).HasPrecision(6, 4);
    }
}
