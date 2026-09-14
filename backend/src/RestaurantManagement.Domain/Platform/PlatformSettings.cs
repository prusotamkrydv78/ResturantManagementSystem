using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Platform;

/// <summary>
/// The handful of things that are true of the platform rather than of a restaurant.
///
/// Exactly one row, at <see cref="WellKnownId"/>. A settings table with a primary key
/// nobody chooses is how a second row appears and two halves of the product start
/// disagreeing about the rate of VAT.
///
/// What lives here is only what a platform owner can genuinely change and a restaurant
/// genuinely inherits. There is no global currency, no feature flag and no branding,
/// because none of those exist in this product, and a setting that can hold exactly one
/// correct value is only a way to get it wrong.
/// </summary>
public class PlatformSettings
{
    /// <summary>The one row. Fixed, so the settings are fetched rather than searched for.</summary>
    public static readonly Guid WellKnownId = new("00000000-0000-0000-0000-0000000005E7");

    /// <summary>Identifier. Always <see cref="WellKnownId"/>.</summary>
    public Guid Id { get; set; } = WellKnownId;

    /// <summary>
    /// The VAT rate a newly created restaurant starts on.
    ///
    /// A default, not a rule. Existing restaurants keep whatever they were set to, and
    /// every order already snapshots the rate at the moment it opens, so changing this
    /// cannot reach backwards into a bill that has been printed.
    /// </summary>
    public decimal DefaultVatRate { get; set; } = Restaurant.DefaultVatRate;

    /// <summary>The service charge rate a newly created restaurant starts on.</summary>
    public decimal DefaultServiceChargeRate { get; set; } = Restaurant.DefaultServiceChargeRate;

    /// <summary>When these were last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Who changed them, or null while nobody has.</summary>
    public Guid? UpdatedByUserId { get; set; }
}
