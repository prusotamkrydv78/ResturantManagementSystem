using RestaurantManagement.Application.Reports.Dtos;

namespace RestaurantManagement.Application.Platform.Dtos;

/// <summary>
/// What one restaurant did over the range, as the platform sees it.
///
/// Carries the restaurant own timezone and day-start hour alongside the figures, and
/// not as decoration: each restaurant range is read in its own calendar, so two rows in
/// the same report can cover different absolute windows. Showing the configuration next
/// to the number is what makes that legible rather than mysterious.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the restaurant is called.</param>
/// <param name="Slug">Its platform-wide handle.</param>
/// <param name="ManagerName">Who runs it, or null while nobody has been assigned.</param>
/// <param name="TimeZoneId">The zone its days were read in.</param>
/// <param name="DayStartHour">The local hour its service day begins.</param>
/// <param name="RangeStartUtc">The instant its range opened.</param>
/// <param name="RangeEndUtc">The instant its range closes, exclusive.</param>
/// <param name="CompletedCount">Orders paid for and closed in the range.</param>
/// <param name="CancelledCount">Orders called off in the range.</param>
/// <param name="PaymentTotal">Everything taken.</param>
/// <param name="CancelledValue">What the cancelled orders would have come to.</param>
/// <param name="AverageOrderValue">Payment total over payment count, or zero.</param>
public sealed record PlatformRestaurantRowResponse(
    Guid Id,
    string Name,
    string Slug,
    string? ManagerName,
    string TimeZoneId,
    int DayStartHour,
    DateTimeOffset RangeStartUtc,
    DateTimeOffset RangeEndUtc,
    int CompletedCount,
    int CancelledCount,
    decimal PaymentTotal,
    decimal CancelledValue,
    decimal AverageOrderValue);

/// <summary>
/// What the whole platform did over a range of days.
///
/// The one thing worth knowing about this figure before reading it: every restaurant
/// range is read in that restaurant own timezone and service day, so the platform total
/// is the sum of exactly what each manager sees on their own report. The alternative was
/// one absolute window for everybody, which would have produced a headline figure that
/// disagreed with every single manager. A number nobody can reconcile is worse than no
/// number.
///
/// Deliberately thin, for the same reasons the per-restaurant report is: no tax, no
/// cost, no margin, no comparison with another period. None of those exist in this
/// product.
/// </summary>
/// <param name="FromLocalDate">First day asked for.</param>
/// <param name="ToLocalDate">Last day asked for, inclusive.</param>
/// <param name="DayCount">How many days the range covers.</param>
/// <param name="RestaurantCount">Restaurants on the platform.</param>
/// <param name="WithManagerCount">How many have a manager assigned.</param>
/// <param name="WithoutManagerCount">
/// How many are still waiting for one. These cannot trade at all, which is why the
/// figure sits beside the takings rather than in a settings screen.
/// </param>
/// <param name="TradingCount">How many took at least one payment in the range.</param>
/// <param name="CompletedCount">Orders closed across the platform.</param>
/// <param name="CancelledCount">Orders called off across the platform.</param>
/// <param name="PaymentTotal">Everything taken, across every restaurant.</param>
/// <param name="PaymentCount">How many bills were settled.</param>
/// <param name="CancelledValue">
/// What the cancelled orders would have come to. Never added to the total, here or
/// anywhere else.
/// </param>
/// <param name="AverageOrderValue">Payment total over payment count, or zero.</param>
/// <param name="ByMethod">The total split by tender, every method listed even at zero.</param>
/// <param name="Restaurants">One row per restaurant, busiest first.</param>
public sealed record PlatformReportResponse(
    DateOnly FromLocalDate,
    DateOnly ToLocalDate,
    int DayCount,
    int RestaurantCount,
    int WithManagerCount,
    int WithoutManagerCount,
    int TradingCount,
    int CompletedCount,
    int CancelledCount,
    decimal PaymentTotal,
    int PaymentCount,
    decimal CancelledValue,
    decimal AverageOrderValue,
    IReadOnlyList<MethodTotalResponse> ByMethod,
    IReadOnlyList<PlatformRestaurantRowResponse> Restaurants);

/// <summary>
/// One restaurant operational configuration, as the platform settings screen lists it.
///
/// The same three derived values the manager own settings screen shows, because the
/// point of them is identical: a zone identifier is unreadable on its own, and what
/// proves a configuration is doing what somebody intended is the instant its current
/// service day began.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the restaurant is called.</param>
/// <param name="Slug">Its handle.</param>
/// <param name="ManagerName">Who runs it, or null.</param>
/// <param name="ManagerEmail">How to reach them, or null.</param>
/// <param name="TimeZoneId">The IANA zone it operates in.</param>
/// <param name="TimeZoneDisplayName">A readable name for that zone.</param>
/// <param name="CurrentUtcOffsetMinutes">What the zone is worth against UTC right now.</param>
/// <param name="DayStartHour">The local hour a service day begins.</param>
/// <param name="ServiceDayStartedAtUtc">When its running service day began.</param>
/// <param name="TableCount">Tables it has, in service or not.</param>
/// <param name="StaffCount">Staff accounts attached to it.</param>
public sealed record PlatformRestaurantSettingsResponse(
    Guid Id,
    string Name,
    string Slug,
    string? ManagerName,
    string? ManagerEmail,
    string TimeZoneId,
    string TimeZoneDisplayName,
    int CurrentUtcOffsetMinutes,
    int DayStartHour,
    DateTimeOffset ServiceDayStartedAtUtc,
    int TableCount,
    int StaffCount);

/// <summary>
/// The platform as a whole: what exists on it, and how each restaurant is configured.
///
/// This is the closest thing this product has to platform settings, and it is honest
/// about that. There is no platform-wide configuration to edit — no global currency, no
/// global tax, no feature flags — because none of those exist. What a platform
/// administrator can usefully do here is see the shape of the estate and fix a
/// restaurant that was set up in the wrong timezone, which is the setting most likely to
/// be wrong and the one that quietly makes every figure wrong with it.
/// </summary>
/// <param name="RestaurantCount">Restaurants on the platform.</param>
/// <param name="WithoutManagerCount">Restaurants nobody has been assigned to yet.</param>
/// <param name="ManagerCount">Manager accounts.</param>
/// <param name="UnassignedManagerCount">
/// Managers who own no restaurant. A real state rather than a fault: an account can be
/// created before the restaurant it will run.
/// </param>
/// <param name="StaffCount">Staff accounts across every restaurant.</param>
/// <param name="TableCount">Tables across every restaurant.</param>
/// <param name="DistinctTimeZoneCount">
/// How many different zones the estate spans. One is the simple case; more than one is
/// why the platform report reads each restaurant range in its own calendar.
/// </param>
/// <param name="ServerUtcNow">
/// The server clock, so a reader can tell the difference between a restaurant being
/// configured oddly and the machine itself being wrong.
/// </param>
/// <param name="Restaurants">Every restaurant configuration, by name.</param>
public sealed record PlatformOverviewResponse(
    int RestaurantCount,
    int WithoutManagerCount,
    int ManagerCount,
    int UnassignedManagerCount,
    int StaffCount,
    int TableCount,
    int DistinctTimeZoneCount,
    DateTimeOffset ServerUtcNow,
    IReadOnlyList<PlatformRestaurantSettingsResponse> Restaurants);
