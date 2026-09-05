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
/// Every range is read against the one service day boundary the product has, so a
/// platform total is exactly the sum of what each manager sees on their own report. This
/// used to be a window per restaurant in its own timezone, reconciled afterwards; the
/// product is hosted for Nepal only, so there is one calendar and nothing to reconcile.
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

        // One window for the whole platform. This used to be a window per restaurant in
        // its own calendar, with a widest-of-them bound on the query and a second pass
        // to trim each restaurant back to its own dates. With a single day boundary
        // across the estate there is nothing to reconcile: the query bound and every
        // restaurant window are the same two instants.
        var start = ServiceDay.StartOn(first);
        var end = ServiceDay.StartOn(last.AddDays(1));

        var rows = new List<PlatformRestaurantRowResponse>(restaurants.Count);
        var byMethod = new Dictionary<PaymentMethod, (int Count, decimal Total)>();

        var platformCompleted = 0;
        var platformCancelled = 0;
        var platformPaymentTotal = 0m;
        var platformPaymentCount = 0;
        var platformCancelledValue = 0m;
        var trading = 0;

        if (restaurants.Count > 0)
        {
            // Selected by when they ended rather than when they were placed, so a table
            // that opened before a boundary and settled after it belongs to the day it
            // was paid on. The same rule the dashboard and the manager report use.
            var closed = await _dbContext.Orders
                .AsNoTracking()
                .Where(order =>
                    (order.CompletedAtUtc != null &&
                     order.CompletedAtUtc >= start &&
                     order.CompletedAtUtc < end) ||
                    (order.CancelledAtUtc != null &&
                     order.CancelledAtUtc >= start &&
                     order.CancelledAtUtc < end))
                // No Include for the payment: the projection below reaches it through
                // the navigation, which EF turns into the join by itself. An Include
                // in front of a Select is discarded, so leaving it here only suggests
                // the query needs something it does not.
                //
                // Bounded by MaxRangeDays and RestaurantLimit rather than by paging,
                // because the totals below are computed across the whole result.
                .Select(order => new
                {
                    order.RestaurantId,
                    order.Status,
                    order.Subtotal,
                    order.CompletedAtUtc,
                    order.CancelledAtUtc,
                    PaymentAmount = !order.Payments.Any()
                        ? (decimal?)null
                        : order.Payments.Sum(payment => payment.Amount),
                    PaymentMethod = order.Payments.Count() != 1
                        ? (PaymentMethod?)null
                        : order.Payments.First().Method,
                })
                .ToListAsync(cancellationToken);

            var byRestaurant = closed
                .GroupBy(order => order.RestaurantId)
                .ToDictionary(group => group.Key, group => group.ToList());

            foreach (var restaurant in restaurants)
            {
                // The query window is already this restaurant's window, so the rows it
                // returned need no second date filter - only splitting by status.
                var mine = byRestaurant.TryGetValue(restaurant.Id, out var found)
                    ? found
                    : [];

                var completed = mine
                    .Where(order => order.Status == OrderStatus.Completed)
                    .ToList();

                var cancelled = mine
                    .Where(order => order.Status == OrderStatus.Cancelled)
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
                    start,
                    end,
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
            DateTimeOffset.UtcNow,
            restaurants
                .Select(restaurant => ToOverviewRow(
                    restaurant,
                    tableCounts.GetValueOrDefault(restaurant.Id),
                    staffCounts.GetValueOrDefault(restaurant.Id)))
                .ToList()));
    }

    private static PlatformRestaurantOverviewResponse ToOverviewRow(
        Restaurant restaurant,
        int tableCount,
        int staffCount) =>
        new(
            restaurant.Id,
            restaurant.Name,
            restaurant.Slug,
            restaurant.Manager?.FullName,
            restaurant.Manager?.Email,
            tableCount,
            staffCount);

    /// <summary>
    /// An average that does not divide by nothing.
    ///
    /// Computed on the server so every screen shows the same figure rather than each
    /// dividing for itself and rounding differently.
    /// </summary>
    private static decimal Average(decimal total, int count) =>
        count == 0 ? 0m : decimal.Round(total / count, 2, MidpointRounding.AwayFromZero);
}
