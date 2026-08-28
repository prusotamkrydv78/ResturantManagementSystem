using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// A restaurant on the platform, created by a Super Admin.
///
/// Ownership is expressed by a single foreign key, <see cref="ManagerId"/>, so there
/// is exactly one source of truth for who manages a restaurant. A filtered unique
/// index on that column guarantees a user manages at most one restaurant.
///
/// Operational concerns (branches, staff, tables, menus, orders) are not modelled
/// here. When staff arrive they will be associated through their own link to a
/// restaurant, which is an additive change.
/// </summary>
public class Restaurant
{
    /// <summary>
    /// What a restaurant is given until somebody sets its timezone.
    ///
    /// UTC rather than a guess: it is unambiguous, it never shifts, and a manager who
    /// has not chosen yet is better served by a boundary they can reason about than
    /// by one inferred from where they happened to sign in.
    /// </summary>
    public const string DefaultTimeZoneId = "UTC";

    /// <summary>Midnight, which is where a day starts unless told otherwise.</summary>
    public const int DefaultDayStartHour = 0;

    /// <summary>Earliest hour a service day may be said to begin.</summary>
    public const int MinDayStartHour = 0;

    /// <summary>Latest hour a service day may be said to begin.</summary>
    public const int MaxDayStartHour = 23;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>Display name of the restaurant.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly unique identifier, derived from the name when not supplied.
    /// Useful for future public routes and for humans referring to a restaurant.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Optional contact email for the restaurant.</summary>
    public string? ContactEmail { get; set; }

    /// <summary>Optional contact phone number.</summary>
    public string? ContactPhone { get; set; }

    /// <summary>Optional street address.</summary>
    public string? AddressLine { get; set; }

    /// <summary>Optional city.</summary>
    public string? City { get; set; }

    /// <summary>Optional country.</summary>
    public string? Country { get; set; }

    /// <summary>
    /// The assigned manager, or null before one has been assigned. This is the only
    /// place restaurant ownership is recorded.
    /// </summary>
    public Guid? ManagerId { get; set; }

    /// <summary>Navigation to the assigned manager.</summary>
    public ApplicationUser? Manager { get; set; }

    /// <summary>
    /// The IANA timezone the restaurant actually operates in, such as
    /// "Asia/Kathmandu".
    ///
    /// Authoritative, and the reason this column exists: the operational day was
    /// previously derived from whatever offset the manager browser reported, so two
    /// managers in different places saw different takings for the same restaurant,
    /// and the figure moved when somebody travelled. A restaurant sits in one place,
    /// so the answer belongs to the restaurant.
    ///
    /// Stored as an identifier rather than an offset so daylight saving is handled by
    /// the zone rules instead of being frozen at the moment it was configured.
    /// </summary>
    public string TimeZoneId { get; set; } = DefaultTimeZoneId;

    /// <summary>
    /// The local hour a service day begins, from 0 to 23.
    ///
    /// Midnight for most places, and later for anywhere that trades past it: a
    /// kitchen closing at two in the morning wants those takings counted against the
    /// evening that earned them rather than against the day that had barely started.
    /// </summary>
    public int DayStartHour { get; set; } = DefaultDayStartHour;

    /// <summary>
    /// Whether the restaurant may take new business.
    ///
    /// The state between trading and gone. A restaurant that stops paying, or is being
    /// looked into, has to be stoppable without destroying the orders and takings
    /// every report is built from - so this is what the platform uses instead of
    /// deleting the record.
    ///
    /// Suspension deliberately blocks only the start of new business: a waiter cannot
    /// open an order and a guest cannot scan a table. Work already underway carries on
    /// to the till, because suspending at eight in the evening must not strand food
    /// that is cooking or a bill nobody can settle. Signing in still works for the
    /// same reason - the manager and their staff need to close the night out and read
    /// their own history afterwards.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When the restaurant was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the restaurant was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// The zone this restaurant operates in, or UTC if the stored identifier is not
    /// one this machine knows.
    ///
    /// The fallback is defensive rather than expected: the identifier is validated
    /// against the same zone database before it is ever stored. It exists because a
    /// database restored onto a machine with a different zone table must still be
    /// able to compute a day boundary instead of throwing on every dashboard load.
    /// </summary>
    public TimeZoneInfo ResolveTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);
        }
        catch (Exception exception) when (
            exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>
    /// When the service day containing <paramref name="now"/> began, as a UTC instant.
    ///
    /// Everything is stored in UTC, so the boundary is shifted rather than the data.
    /// Two things move it: the restaurant own zone, and the hour it considers a day to
    /// start. A restaurant that trades past midnight is still in the previous service
    /// day at one in the morning, and its takings belong to the evening that earned
    /// them.
    ///
    /// The offset is read at the boundary itself rather than at <paramref name="now"/>,
    /// so a day that begins on one side of a daylight saving change is not measured
    /// with the offset from the other. The one case this cannot get right is a
    /// boundary falling inside a skipped or repeated hour, which is a boundary that
    /// does not exist or exists twice; the zone rules pick one, and the figure is out
    /// by an hour on the two days a year that happens.
    /// </summary>
    public DateTimeOffset ServiceDayStart(DateTimeOffset now)
    {
        var zone = ResolveTimeZone();
        var local = TimeZoneInfo.ConvertTime(now, zone);

        var boundary = local.Date.AddHours(DayStartHour);

        // Before today boundary means the day that is running started yesterday.
        if (local.DateTime < boundary)
        {
            boundary = boundary.AddDays(-1);
        }

        return ToInstant(boundary, zone);
    }

    /// <summary>
    /// When the service day for a given local date began, as a UTC instant.
    ///
    /// The date is read in the restaurant own calendar, which is the only reading that
    /// makes sense of a manager asking for a range: they mean their dates, not the
    /// server dates. Pairing this with the day after gives a half-open range that
    /// covers exactly the days asked for and cannot double-count a boundary.
    /// </summary>
    public DateTimeOffset ServiceDayStartOn(DateOnly localDate)
    {
        var zone = ResolveTimeZone();

        return ToInstant(localDate.ToDateTime(TimeOnly.MinValue).AddHours(DayStartHour), zone);
    }

    /// <summary>Today, in the restaurant own calendar rather than the server one.</summary>
    public DateOnly LocalToday(DateTimeOffset now) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, ResolveTimeZone()).Date);

    /// <summary>
    /// A local wall-clock time as a UTC instant.
    ///
    /// The offset is read at the moment in question rather than at the current one, so
    /// a boundary on the far side of a daylight saving change is not measured with
    /// today offset.
    /// </summary>
    private static DateTimeOffset ToInstant(DateTime wallClock, TimeZoneInfo zone)
    {
        var offset = zone.GetUtcOffset(
            DateTime.SpecifyKind(wallClock, DateTimeKind.Unspecified));

        return new DateTimeOffset(wallClock, offset).ToUniversalTime();
    }
}
