using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Restaurants;

/// <summary>
/// Failures the restaurant module can report. Assignment failures live in
/// <c>ManagerErrors</c>, since the manager module owns those rules.
/// </summary>
public static class RestaurantErrors
{
    /// <summary>No restaurant exists with the supplied identifier.</summary>
    public static readonly Error NotFound =
        new("restaurant.not_found", "The restaurant could not be found.");

    /// <summary>The slug is already used by another restaurant.</summary>
    public static readonly Error SlugTaken =
        new("restaurant.slug_taken", "A restaurant with this slug already exists.");

    /// <summary>The signed-in manager has no restaurant assigned to them.</summary>
    /// <summary>
    /// The submitted timezone is not one this machine recognises.
    ///
    /// Refused rather than stored, because an identifier no zone database knows would
    /// be accepted once and then quietly fall back to UTC on every day calculation
    /// afterwards, which is worse than saying no.
    /// </summary>
    public static readonly Error UnknownTimeZone =
        new(
            "restaurant.unknown_timezone",
            "That is not a timezone this server recognises. Choose one from the list.");

    public static readonly Error NoRestaurantAssigned =
        new("restaurant.not_assigned", "No restaurant is assigned to this account.");

    /// <summary>
    /// The restaurant has taken orders, so the record is history and not a mistake to
    /// tidy away.
    ///
    /// Deleting it would strand the takings that every report is built from. A
    /// restaurant that has traded is edited, never removed.
    /// </summary>
    public static readonly Error HasTraded =
        new(
            "restaurant.has_traded",
            "This restaurant has orders against it and cannot be deleted.");

    /// <summary>
    /// The restaurant has been set up but has not traded yet.
    ///
    /// Named separately from <see cref="HasTraded"/> because the answer differs: this
    /// one can be deleted once its setup is cleared, and saying so saves the
    /// administrator guessing which of the two applies.
    /// </summary>
    public static readonly Error HasSetupData =
        new(
            "restaurant.has_setup_data",
            "This restaurant still has tables, staff, stock or customers. "
            + "Remove those first, or edit the restaurant instead of deleting it.");
}
