using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Application.Platform.Dtos;
using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Platform;

/// <summary>
/// What a platform administrator can see across every restaurant.
///
/// The only module here that is not scoped to one restaurant, because the account it
/// serves owns none. Every method reads the whole estate deliberately; the Super Admin
/// role gate at the API boundary is what keeps that from being a leak.
///
/// Two decisions worth knowing before reading a figure out of this file:
///
/// Every restaurant range is read in that restaurant own timezone and service day. The
/// platform total is therefore the sum of exactly what each manager sees on their own
/// report, at the price of two rows covering slightly different absolute windows when
/// their zones differ. The alternative was one absolute window for everybody, which
/// produces a headline that disagrees with every manager in the estate, and a number
/// nobody can reconcile is worse than no number.
///
/// Nothing is stored or rolled up. Every figure is computed from the orders and payments
/// themselves at the moment of asking, which is the only way this report and the billing
/// screen can be guaranteed to agree.
/// </summary>
public sealed class PlatformService : IPlatformService
{
    /// <summary>
    /// The longest range one request will cover.
    ///
    /// The same quarter the per-restaurant report allows. The bound matters more here,
    /// because this query walks every restaurant on the platform at once.
    /// </summary>
    private const int MaxRangeDays = 92;

    /// <summary>
    /// How many restaurants to list rows for.
    ///
    /// There is no pagination in this product, so the bound lives here. Well above any
    /// plausible estate for a system with no multi-branch support.
    /// </summary>
    private const int RestaurantLimit = 200;

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PlatformService> _logger;

    /// <summary>Creates the service.</summary>
    public PlatformService(
        ApplicationDbContext dbContext,
        ILogger<PlatformService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<PlatformReportResponse>> GetReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var restaurants = await _dbContext.Restaurants
            .AsNoTracking()
            .Include(restaurant => restaurant.Manager)
            .OrderBy(restaurant => restaurant.Name)
            .Take(RestaurantLimit)
            .ToListAsync(cancellationToken);

        // The dates are validated against the server calendar rather than any one
        // restaurant, because the range asked for spans all of them. Each restaurant then
        // reads those same dates in its own zone.
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var last = to ?? from ?? today;
        var first = from ?? last;

        if (first > last)
        {
            return Result.Failure<PlatformReportResponse>(PlatformErrors.RangeBackwards);
        }

        var dayCount = last.DayNumber - first.DayNumber + 1;

        if (dayCount > MaxRangeDays)
        {
            return Result.Failure<PlatformReportResponse>(
                PlatformErrors.RangeTooLong(MaxRangeDays));
        }

        // One window per restaurant, in its own calendar. The widest of them bounds the
        // single query below, so the whole report is one round trip rather than one per
        // restaurant.
        var windows = restaurants.ToDictionary(
            restaurant => restaurant.Id,
            restaurant => (
                Start: restaurant.ServiceDayStartOn(first),
                End: restaurant.ServiceDayStartOn(last.AddDays(1))));

        var rows = new List<PlatformRestaurantRowResponse>(restaurants.Count);
        var byMethod = new Dictionary<PaymentMethod, (int Count, decimal Total)>();

        var platformCompleted = 0;
        var platformCancelled = 0;
        var platformPaymentTotal = 0m;
        var platformPaymentCount = 0;
        var platformCancelledValue = 0m;
        var trading = 0;

        if (windows.Count > 0)
        {
            var earliest = windows.Values.Min(window => window.Start);
            var latest = windows.Values.Max(window => window.End);

            // Selected by when they ended rather than when they were placed, so a table
            // that opened before a boundary and settled after it belongs to the day it
            // was paid on. The same rule the dashboard and the manager report use.
            var closed = await _dbContext.Orders
                .AsNoTracking()
                .Where(order =>
                    (order.CompletedAtUtc != null &&
                     order.CompletedAtUtc >= earliest &&
                     order.CompletedAtUtc < latest) ||
                    (order.CancelledAtUtc != null &&
                     order.CancelledAtUtc >= earliest &&
                     order.CancelledAtUtc < latest))
                .Include(order => order.Payment)
                .Select(order => new
                {
                    order.RestaurantId,
                    order.Status,
                    order.Subtotal,
                    order.CompletedAtUtc,
                    order.CancelledAtUtc,
                    PaymentAmount = order.Payment == null
                        ? (decimal?)null
                        : order.Payment.Amount,
                    PaymentMethod = order.Payment == null
                        ? (PaymentMethod?)null
                        : order.Payment.Method,
                })
                .ToListAsync(cancellationToken);

            var byRestaurant = closed
                .GroupBy(order => order.RestaurantId)
                .ToDictionary(group => group.Key, group => group.ToList());

            foreach (var restaurant in restaurants)
            {
                var window = windows[restaurant.Id];

                // The widest window was only a bound for the query. Each restaurant now
                // keeps just the orders that fall inside its own, or a restaurant in a
                // later zone would pick up somebody else early morning.
                var mine = byRestaurant.TryGetValue(restaurant.Id, out var found)
                    ? found
                    : [];

                var completed = mine
                    .Where(order =>
                        order.Status == OrderStatus.Completed &&
                        order.CompletedAtUtc >= window.Start &&
                        order.CompletedAtUtc < window.End)
                    .ToList();

                var cancelled = mine
                    .Where(order =>
                        order.Status == OrderStatus.Cancelled &&
                        order.CancelledAtUtc >= window.Start &&
                        order.CancelledAtUtc < window.End)
                    .ToList();

                var payments = completed
                    .Where(order => order.PaymentAmount is not null)
                    .ToList();

                var takings = payments.Sum(order => order.PaymentAmount ?? 0m);
                var cancelledValue = cancelled.Sum(order => order.Subtotal);

                foreach (var payment in payments)
                {
                    if (payment.PaymentMethod is not { } method)
                    {
                        continue;
                    }

                    var current = byMethod.GetValueOrDefault(method);

                    byMethod[method] = (
                        current.Count + 1,
                        current.Total + (payment.PaymentAmount ?? 0m));
                }

                platformCompleted += completed.Count;
                platformCancelled += cancelled.Count;
                platformPaymentTotal += takings;
                platformPaymentCount += payments.Count;
                platformCancelledValue += cancelledValue;

                if (payments.Count > 0)
                {
                    trading++;
                }

                rows.Add(new PlatformRestaurantRowResponse(
                    restaurant.Id,
                    restaurant.Name,
                    restaurant.Slug,
                    restaurant.Manager?.FullName,
                    restaurant.TimeZoneId,
                    restaurant.DayStartHour,
                    window.Start,
                    window.End,
                    completed.Count,
                    cancelled.Count,
                    takings,
                    cancelledValue,
                    Average(takings, payments.Count)));
            }
        }

        return Result.Success(new PlatformReportResponse(
            first,
            last,
            dayCount,
            restaurants.Count,
            restaurants.Count(restaurant => restaurant.ManagerId is not null),
            restaurants.Count(restaurant => restaurant.ManagerId is null),
            trading,
            platformCompleted,
            platformCancelled,
            platformPaymentTotal,
            platformPaymentCount,
            platformCancelledValue,
            Average(platformPaymentTotal, platformPaymentCount),
            // Every method listed even at zero, so the shape of the response does not
            // change with the range and a screen never has to guess whether a missing
            // row means nothing was taken or the field was dropped.
            Enum.GetValues<PaymentMethod>()
                .Select(method =>
                {
                    var totals = byMethod.GetValueOrDefault(method);

                    return new MethodTotalResponse(method, totals.Count, totals.Total);
                })
                .ToList(),
            // Busiest first: on a platform screen the question is which restaurants are
            // trading, not what they are called.
            rows.OrderByDescending(row => row.PaymentTotal)
                .ThenBy(row => row.Name, StringComparer.OrdinalIgnoreCase)
                .ToList()));
    }

    /// <inheritdoc />
    public async Task<Result<PlatformOverviewResponse>> GetOverviewAsync(
        CancellationToken cancellationToken)
    {
        var restaurants = await _dbContext.Restaurants
            .AsNoTracking()
            .Include(restaurant => restaurant.Manager)
            .OrderBy(restaurant => restaurant.Name)
            .Take(RestaurantLimit)
            .ToListAsync(cancellationToken);

        var tableCounts = await _dbContext.RestaurantTables
            .AsNoTracking()
            .GroupBy(table => table.RestaurantId)
            .Select(group => new { RestaurantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.RestaurantId, row => row.Count, cancellationToken);

        var staffCounts = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.PlatformRole == PlatformRole.Staff && user.RestaurantId != null)
            .GroupBy(user => user.RestaurantId!.Value)
            .Select(group => new { RestaurantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.RestaurantId, row => row.Count, cancellationToken);

        var managers = await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.PlatformRole == PlatformRole.RestaurantManager)
            .Select(user => user.Id)
            .ToListAsync(cancellationToken);

        var assignedManagers = restaurants
            .Where(restaurant => restaurant.ManagerId is not null)
            .Select(restaurant => restaurant.ManagerId!.Value)
            .ToHashSet();

        return Result.Success(new PlatformOverviewResponse(
            restaurants.Count,
            restaurants.Count(restaurant => restaurant.ManagerId is null),
            managers.Count,
            managers.Count(id => !assignedManagers.Contains(id)),
            staffCounts.Values.Sum(),
            tableCounts.Values.Sum(),
            restaurants
                .Select(restaurant => restaurant.TimeZoneId)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count(),
            DateTimeOffset.UtcNow,
            restaurants
                .Select(restaurant => ToSettings(
                    restaurant,
                    tableCounts.GetValueOrDefault(restaurant.Id),
                    staffCounts.GetValueOrDefault(restaurant.Id)))
                .ToList()));
    }

    /// <inheritdoc />
    public async Task<Result<PlatformRestaurantSettingsResponse>> UpdateRestaurantSettingsAsync(
        Guid restaurantId,
        UpdateRestaurantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var restaurant = await _dbContext.Restaurants
            .Include(candidate => candidate.Manager)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == restaurantId,
                cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PlatformRestaurantSettingsResponse>(
                PlatformErrors.RestaurantNotFound);
        }

        var zoneId = request.TimeZoneId.Trim();

        // Checked against the zone database rather than a pattern, for the same reason
        // the manager path checks it: a well-formed identifier nothing recognises would
        // pass validation and then be silently replaced by UTC on every later
        // calculation.
        if (!TryFindZone(zoneId, out var zone))
        {
            return Result.Failure<PlatformRestaurantSettingsResponse>(
                PlatformErrors.UnknownTimeZone);
        }

        restaurant.TimeZoneId = zone.Id;
        restaurant.DayStartHour = request.DayStartHour;
        restaurant.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "A platform administrator set restaurant {RestaurantId} to {TimeZoneId} " +
            "with a service day starting at {DayStartHour}.",
            restaurant.Id,
            restaurant.TimeZoneId,
            restaurant.DayStartHour);

        var tableCount = await _dbContext.RestaurantTables
            .AsNoTracking()
            .CountAsync(table => table.RestaurantId == restaurant.Id, cancellationToken);

        var staffCount = await _dbContext.Users
            .AsNoTracking()
            .CountAsync(
                user =>
                    user.RestaurantId == restaurant.Id &&
                    user.PlatformRole == PlatformRole.Staff,
                cancellationToken);

        return Result.Success(ToSettings(restaurant, tableCount, staffCount));
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// The settings, plus what they currently amount to.
    ///
    /// The offset and the day boundary are derived on each read rather than stored, so
    /// they cannot go stale against the zone rules or against the clock. The day boundary
    /// in particular is the one figure that proves a configuration is doing what somebody
    /// intended.
    /// </summary>
    private static PlatformRestaurantSettingsResponse ToSettings(
        Restaurant restaurant,
        int tableCount,
        int staffCount)
    {
        var now = DateTimeOffset.UtcNow;
        var zone = restaurant.ResolveTimeZone();

        return new PlatformRestaurantSettingsResponse(
            restaurant.Id,
            restaurant.Name,
            restaurant.Slug,
            restaurant.Manager?.FullName,
            restaurant.Manager?.Email,
            restaurant.TimeZoneId,
            zone.DisplayName,
            (int)zone.GetUtcOffset(now).TotalMinutes,
            restaurant.DayStartHour,
            restaurant.ServiceDayStart(now),
            tableCount,
            staffCount);
    }

    /// <summary>
    /// Whether this machine knows the identifier, and the zone if it does.
    ///
    /// Wrapped because the lookup signals an unknown zone by throwing, and an unknown
    /// zone here is an ordinary validation failure rather than an exceptional event.
    /// </summary>
    private static bool TryFindZone(string id, out TimeZoneInfo zone)
    {
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (Exception exception) when (
            exception is TimeZoneNotFoundException
                or InvalidTimeZoneException
                or ArgumentException)
        {
            zone = TimeZoneInfo.Utc;
            return false;
        }
    }

    /// <summary>
    /// An average that does not divide by nothing.
    ///
    /// Computed on the server so every screen shows the same figure rather than each
    /// dividing for itself and rounding differently.
    /// </summary>
    private static decimal Average(decimal total, int count) =>
        count == 0 ? 0m : decimal.Round(total / count, 2, MidpointRounding.AwayFromZero);
}
