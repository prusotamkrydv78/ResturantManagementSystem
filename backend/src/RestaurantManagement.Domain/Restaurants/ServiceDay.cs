namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// The day a figure is counted against.
///
/// Every daily total in the product - a dashboard tile, a report row, today's
/// bookings - needs one answer to "when did today start". This is that answer.
///
/// The product is hosted for Nepal only, so the boundary is local midnight in Nepal
/// and is not configurable. It used to be two columns on the restaurant, a timezone
/// identifier and an hour the service day began; both were removed because a single
/// deployment in a single country cannot disagree with itself about what day it is,
/// and a setting that can only hold one correct value is a way to get it wrong.
///
/// Deliberately a fixed offset rather than a lookup in the machine zone database.
/// Nepal has never observed daylight saving and has been UTC+05:45 since 1986, so an
/// offset is exactly as correct as a zone rule and cannot fail: no dependency on ICU
/// being present, and no difference between the Windows identifier
/// ("Nepal Standard Time") and the IANA one ("Asia/Kathmandu"), which is a real
/// difference that already had to be worked around once.
/// </summary>
public static class ServiceDay
{
    /// <summary>Nepal Standard Time. No daylight saving, so this never varies.</summary>
    public static readonly TimeSpan Offset = TimeSpan.FromMinutes(345);

    /// <summary>How the offset reads to a person, for display.</summary>
    public const string Label = "Nepal Standard Time (UTC+05:45)";

    /// <summary>The local date it is now.</summary>
    public static DateOnly LocalToday(DateTimeOffset now) =>
        DateOnly.FromDateTime(now.ToOffset(Offset).DateTime);

    /// <summary>
    /// The instant a given local date began.
    ///
    /// Take care with the exclusive end of a range: the day after
    /// <paramref name="localDate"/> starts where this one ends, so a range is built as
    /// <c>StartOn(first) .. StartOn(last.AddDays(1))</c> rather than by adding
    /// twenty-four hours, which would be wrong the moment a boundary ever moved.
    /// </summary>
    public static DateTimeOffset StartOn(DateOnly localDate) =>
        new DateTimeOffset(localDate.ToDateTime(TimeOnly.MinValue), Offset).ToUniversalTime();

    /// <summary>The instant the day containing <paramref name="now"/> began.</summary>
    public static DateTimeOffset Start(DateTimeOffset now) => StartOn(LocalToday(now));
}
