using RestaurantManagement.Application.Platform.Dtos;
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
    /// One restaurant, whole: how it is configured, who works there, what it has
    /// taken, and what is running on its floor at this moment.
    ///
    /// The only way a platform administrator can see any of it. Every other module
    /// scopes its reads to the caller own restaurant, and an administrator has none.
    /// </summary>
    Task<Result<PlatformRestaurantDetailResponse>> GetRestaurantAsync(
        Guid restaurantId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The most recent things platform administrators have done, newest first.
    /// </summary>
    Task<Result<IReadOnlyList<PlatformActivityResponse>>> GetActivityAsync(
        int limit,
        CancellationToken cancellationToken);

    /// <summary>The platform-wide defaults a new restaurant inherits.</summary>
    Task<Result<PlatformSettingsResponse>> GetSettingsAsync(CancellationToken cancellationToken);

    /// <summary>Changes the platform-wide defaults.</summary>
    Task<Result<PlatformSettingsResponse>> UpdateSettingsAsync(
        UpdatePlatformSettingsRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Whether the deployment itself is healthy: its clock, its build, and whether the
    /// database has every migration the running code expects.
    /// </summary>
    Task<Result<PlatformSystemResponse>> GetSystemAsync(CancellationToken cancellationToken);

    /// <summary>
    /// What the estate is doing right now.
    ///
    /// Today against yesterday, what is still running, and when each restaurant last
    /// took an order. The overview below says how the platform is set up; this says
    /// whether it is working, which is the question after the first week.
    /// </summary>
    Task<Result<PlatformPulseResponse>> GetPulseAsync(
        CancellationToken cancellationToken);

}
