using RestaurantManagement.Application.Platform.Dtos;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Platform;

/// <summary>
/// What a platform administrator can see and configure across every restaurant.
///
/// This is the one module in the product that is deliberately not scoped to a single
/// restaurant, and it exists because a platform administrator owns none. Everywhere else
/// the restaurant is derived from the caller and a foreign identifier is unfindable; here
/// the caller legitimately reaches all of them, and the whole surface is gated on the
/// Super Admin role at the API boundary.
///
/// Nothing here can reach into a restaurant operations. There is no way to raise an
/// order, settle a bill, move stock or take a booking from this module: a platform
/// administrator who could quietly alter a restaurant takings would make every figure in
/// the product unaccountable. What they can do is read, and correct the operational
/// configuration a restaurant was set up with.
/// </summary>
public interface IPlatformService
{
    /// <summary>
    /// What every restaurant took over a range of days, with one row each.
    ///
    /// Each restaurant range is read in its own timezone and service day, so the
    /// platform total is the sum of exactly what each manager sees. Omitting both dates
    /// asks for today; omitting one asks for the single day the other names.
    /// </summary>
    Task<Result<PlatformReportResponse>> GetReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken);

    /// <summary>
    /// The shape of the estate, and how each restaurant is configured to operate.
    /// </summary>
    Task<Result<PlatformOverviewResponse>> GetOverviewAsync(
        CancellationToken cancellationToken);

    /// <summary>
    /// Changes how one restaurant operates: its timezone and the hour its day begins.
    ///
    /// The same two values a manager can set for themselves, reachable here because a
    /// restaurant set up in the wrong zone reports wrong figures from the first day and
    /// may have no manager yet to fix it. The timezone is checked against the zones this
    /// machine actually knows.
    /// </summary>
    Task<Result<PlatformRestaurantSettingsResponse>> UpdateRestaurantSettingsAsync(
        Guid restaurantId,
        UpdateRestaurantSettingsRequest request,
        CancellationToken cancellationToken);
}
