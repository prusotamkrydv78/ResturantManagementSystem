using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Restaurants;

/// <summary>
/// Restaurant use cases. Implemented in the infrastructure layer, which owns EF Core
/// and ASP.NET Core Identity.
///
/// Authorization by role is applied at the API boundary. The one rule enforced here
/// is ownership: <see cref="GetForManagerAsync"/> resolves the restaurant from the
/// caller identity rather than from any client-supplied identifier.
/// </summary>
public interface IRestaurantService
{
    /// <summary>Creates a restaurant with no manager assigned. Super Admin only.</summary>
    Task<Result<RestaurantResponse>> CreateAsync(
        CreateRestaurantRequest request,
        CancellationToken cancellationToken);

    /// <summary>Lists every restaurant. Super Admin only.</summary>
    Task<Result<IReadOnlyList<RestaurantSummaryResponse>>> GetAllAsync(
        CancellationToken cancellationToken);

    /// <summary>Loads one restaurant by identifier. Super Admin only.</summary>
    Task<Result<RestaurantResponse>> GetByIdAsync(
        Guid restaurantId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates any restaurant by identifier. Super Admin only.
    ///
    /// The counterpart to <see cref="UpdateForManagerAsync"/>, and the only path that
    /// can change a slug. Manager assignment is not touched here: ownership moves
    /// through the manager endpoints so there is one way to do it.
    /// </summary>
    Task<Result<RestaurantResponse>> UpdateAsync(
        Guid restaurantId,
        UpdateRestaurantRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes a restaurant. Super Admin only.
    /// </summary>
    /// <remarks>
    /// An escape hatch for a record created by mistake, not a way to close a business
    /// down. Refused once the restaurant has orders, and refused while it still holds
    /// tables, staff, stock, customers or bookings - those are what a real restaurant
    /// is made of, and removing them silently on its behalf would destroy more than
    /// the caller asked for. Only the menu goes automatically, because it cannot
    /// outlive the restaurant and the database already cascades it.
    /// </remarks>
    Task<Result<bool>> DeleteAsync(
        Guid restaurantId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Loads the restaurant managed by the given user. The identifier comes from the
    /// validated access token, so a manager cannot reach another restaurant by
    /// changing a value in the request.
    /// </summary>
    Task<Result<RestaurantResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates the basic details of the restaurant managed by the given user.
    ///
    /// Like <see cref="GetForManagerAsync"/>, the record is found from the caller
    /// identity rather than from anything in the request, so a manager can only ever
    /// edit their own restaurant. Ownership and the slug are not editable here.
    /// </summary>
    Task<Result<RestaurantResponse>> UpdateForManagerAsync(
        Guid managerUserId,
        UpdateMyRestaurantRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// How the caller restaurant is configured to operate.
    ///
    /// Returns the stored settings together with what they currently amount to: the
    /// zone offset in force and the instant the running service day began. Those two
    /// are derived on each read rather than stored, so a manager can see the effect of
    /// a setting instead of having to trust an identifier.
    /// </summary>
    Task<Result<RestaurantSettingsResponse>> GetSettingsAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Changes how the caller restaurant operates.
    ///
    /// The timezone is checked against the zones this machine actually knows, so an
    /// identifier that merely looks plausible is refused rather than stored and then
    /// silently ignored by every later calculation.
    /// </summary>
    Task<Result<RestaurantSettingsResponse>> UpdateSettingsAsync(
        Guid managerUserId,
        UpdateRestaurantSettingsRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// The timezones this server can be configured with.
    ///
    /// Served rather than listed in the client so the options and the validation come
    /// from one zone database and cannot disagree.
    /// </summary>
    Task<Result<IReadOnlyList<TimeZoneOptionResponse>>> GetTimeZonesAsync(
        CancellationToken cancellationToken);
}
