using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Application.Platform.Dtos;
using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Domain.Reviews;
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
    private readonly ICurrentUser _currentUser;
    private readonly IAdminActivityLog _activity;
    private readonly ILogger<PlatformService> _logger;

    /// <summary>Creates the service.</summary>
    public PlatformService(
        ApplicationDbContext dbContext,
        ICurrentUser currentUser,
        IAdminActivityLog activity,
        ILogger<PlatformService> logger)
    {
        _currentUser = currentUser;
        _activity = activity;
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

        var restaurantsTotal = await _dbContext.Restaurants
            .AsNoTracking()
            .CountAsync(cancellationToken);

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

        // The period of the same length, immediately before. Not "last month" and not
        // "the same days a year ago": somebody who asked for eleven days gets eleven
        // days to read them against, whatever eleven days those are, and no calendar
        // rule has to be explained on screen before the comparison can be trusted.
        var previousLast = first.AddDays(-1);
        var previousFirst = previousLast.AddDays(-(dayCount - 1));
        var previousStart = ServiceDay.StartOn(previousFirst);

        var rows = new List<PlatformRestaurantRowResponse>(restaurants.Count);
        var byMethod = new Dictionary<PaymentMethod, (int Count, decimal Total)>();

        // Declared out here and filled inside the block below, which only runs when
        // there is at least one restaurant. An empty platform then reads as a range of
        // zeroes rather than as a missing section, which is what a chart needs.
        var dayTotals = new Dictionary<DateOnly, DayTotals>();
        var reasons = new Dictionary<string, (int Count, decimal Value)>();
        var previousByRestaurant = new Dictionary<Guid, decimal>();
        var previousCompleted = 0;
        var previousCancelled = 0;
        var previousCancelledValue = 0m;
        var previousTotal = 0m;
        var previousCount = 0;

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
                    order.CancellationReason,
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

            // Both reads above are unbounded by restaurant, while every total below is
            // accumulated over the capped list. Anything outside it has to be dropped
            // here, or a platform past the cap would show a headline that disagreed
            // with the rows underneath it - which is the one thing a report may never do.
            var included = restaurants.Select(restaurant => restaurant.Id).ToHashSet();

            foreach (var order in closed.Where(order => included.Contains(order.RestaurantId)))
            {
                var moment = order.Status == OrderStatus.Completed
                    ? order.CompletedAtUtc
                    : order.CancelledAtUtc;

                if (moment is not { } ended)
                {
                    continue;
                }

                var date = ServiceDay.LocalToday(ended);
                var running = dayTotals.GetValueOrDefault(date);

                if (order.Status == OrderStatus.Completed)
                {
                    // Counted the way the headline counts it: a settled order with a
                    // payment against it. The two figures are then the same figure cut
                    // two ways, and the days add up to the total by construction.
                    if (order.PaymentAmount is { } amount)
                    {
                        dayTotals[date] = running with
                        {
                            Bills = running.Bills + 1,
                            Takings = running.Takings + amount,
                        };
                    }

                    continue;
                }

                dayTotals[date] = running with
                {
                    Cancelled = running.Cancelled + 1,
                    CancelledValue = running.CancelledValue + order.Subtotal,
                };

                var reason = string.IsNullOrWhiteSpace(order.CancellationReason)
                    ? NoReasonGiven
                    : order.CancellationReason.Trim();

                var soFar = reasons.GetValueOrDefault(reason);

                reasons[reason] = (soFar.Count + 1, soFar.Value + order.Subtotal);
            }

            // The period before, thinner: it only ever appears as a total and a total
            // per restaurant, so it is projected down to what a subtraction needs
            // rather than to what a table would. Same selection rule as above - by when
            // an order ended, not when it was placed.
            var previous = await _dbContext.Orders
                .AsNoTracking()
                .Where(order =>
                    (order.CompletedAtUtc != null &&
                     order.CompletedAtUtc >= previousStart &&
                     order.CompletedAtUtc < start) ||
                    (order.CancelledAtUtc != null &&
                     order.CancelledAtUtc >= previousStart &&
                     order.CancelledAtUtc < start))
                .Select(order => new
                {
                    order.RestaurantId,
                    order.Status,
                    order.Subtotal,
                    PaymentAmount = !order.Payments.Any()
                        ? (decimal?)null
                        : order.Payments.Sum(payment => payment.Amount),
                })
                .ToListAsync(cancellationToken);

            foreach (var order in previous.Where(order => included.Contains(order.RestaurantId)))
            {
                if (order.Status == OrderStatus.Cancelled)
                {
                    previousCancelled++;
                    previousCancelledValue += order.Subtotal;

                    continue;
                }

                if (order.Status != OrderStatus.Completed)
                {
                    continue;
                }

                previousCompleted++;

                if (order.PaymentAmount is not { } amount)
                {
                    continue;
                }

                previousCount++;
                previousTotal += amount;
                previousByRestaurant[order.RestaurantId] =
                    previousByRestaurant.GetValueOrDefault(order.RestaurantId) + amount;
            }

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
                    completed.Count,
                    cancelled.Count,
                    takings,
                    previousByRestaurant.GetValueOrDefault(restaurant.Id),
                    Average(takings, payments.Count)));
            }
        }

        // Every day present, oldest first. A gap in a series reads as missing data
        // rather than as a day on which nobody ate out, and the chart drawing this
        // cannot tell the difference.
        var days = Enumerable
            .Range(0, dayCount)
            .Select(offset =>
            {
                var date = first.AddDays(offset);
                var totals = dayTotals.GetValueOrDefault(date);

                return new PlatformReportDayResponse(
                    date,
                    totals.Bills,
                    totals.Takings,
                    totals.Cancelled,
                    totals.CancelledValue);
            })
            .ToList();

        // Seven rows, always, in the order a week is spoken. Derived from the days
        // rather than from the orders again: same source, and it cannot drift.
        var byWeekday = Enum.GetValues<DayOfWeek>()
            .Select(weekday =>
            {
                var matching = days
                    .Where(day => day.LocalDate.DayOfWeek == weekday)
                    .ToList();

                return new PlatformWeekdayResponse(
                    weekday,
                    matching.Sum(day => day.Bills),
                    matching.Sum(day => day.Takings));
            })
            .ToList();

        return Result.Success(new PlatformReportResponse(
            first,
            last,
            dayCount,
            restaurants.Count,
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
            restaurantsTotal,
            new PlatformPeriodResponse(
                previousFirst,
                previousLast,
                previousCompleted,
                previousCancelled,
                previousCancelledValue,
                previousTotal,
                previousCount,
                Average(previousTotal, previousCount)),
            days,
            byWeekday,
            // Heaviest first by value, not by count: ten tables walking out on a
            // misheard order costs less than one banquet called off, and the figure
            // this page exists to explain is money.
            reasons
                .Select(entry => new PlatformCancellationReasonResponse(
                    entry.Key,
                    entry.Value.Count,
                    entry.Value.Value))
                .OrderByDescending(reason => reason.Value)
                .ThenByDescending(reason => reason.Count)
                .ToList(),
            // Busiest first: on a platform screen the question is which restaurants are
            // trading, not what they are called.
            rows.OrderByDescending(row => row.PaymentTotal)
                .ThenBy(row => row.Name, StringComparer.OrdinalIgnoreCase)
                .ToList()));
    }

    /// <inheritdoc />
    public async Task<Result<PlatformRestaurantDetailResponse>> GetRestaurantAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var today = ServiceDay.LocalToday(now);
        var todayStart = ServiceDay.StartOn(today);
        var tomorrowStart = ServiceDay.StartOn(today.AddDays(1));
        var windowStart = ServiceDay.StartOn(today.AddDays(-(TrendDays - 1)));

        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(row => row.Id == restaurantId)
            .Select(row => new
            {
                row.Id,
                row.Name,
                row.Slug,
                row.IsActive,
                row.ContactEmail,
                row.ContactPhone,
                row.AddressLine,
                row.City,
                row.Country,
                row.CreatedAtUtc,
                row.UpdatedAtUtc,
                row.ManagerId,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<PlatformRestaurantDetailResponse>(
                PlatformErrors.RestaurantNotFound);
        }

        var manager = restaurant.ManagerId is null
            ? null
            : await _dbContext.Users
                .AsNoTracking()
                .Where(user => user.Id == restaurant.ManagerId)
                .Select(user => new PlatformRestaurantPersonResponse(
                    user.Id,
                    user.FullName,
                    user.Email ?? string.Empty,
                    StaffRole.Waiter,
                    user.IsActive))
                .FirstOrDefaultAsync(cancellationToken);

        var staff = await _dbContext.Users
            .AsNoTracking()
            .Where(user =>
                user.RestaurantId == restaurantId &&
                user.PlatformRole == PlatformRole.Staff)
            .OrderBy(user => user.FullName)
            .Select(user => new PlatformRestaurantPersonResponse(
                user.Id,
                user.FullName,
                user.Email ?? string.Empty,
                user.StaffRole ?? StaffRole.Waiter,
                user.IsActive))
            .ToListAsync(cancellationToken);

        // How far the room has actually been set up.
        //
        // Six counts in one round trip rather than six. Almost every "this restaurant
        // isn't working" report resolves to one of these being zero - no table taking
        // orders, an empty menu - and none of them are visible from the estate list.
        var setup = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(row => row.Id == restaurantId)
            .Select(row => new PlatformRestaurantSetupResponse(
                _dbContext.RestaurantTables.Count(table =>
                    table.RestaurantId == restaurantId),
                _dbContext.RestaurantTables.Count(table =>
                    table.RestaurantId == restaurantId && table.IsActive),
                _dbContext.RestaurantTables.Count(table =>
                    table.RestaurantId == restaurantId &&
                    table.IsActive &&
                    table.IsOrderingEnabled),
                _dbContext.MenuCategories.Count(category =>
                    category.RestaurantId == restaurantId),
                _dbContext.MenuItems.Count(item => item.RestaurantId == restaurantId),
                _dbContext.MenuItems.Count(item =>
                    item.RestaurantId == restaurantId && item.IsActive),
                _dbContext.InventoryItems.Count(item =>
                    item.RestaurantId == restaurantId),
                _dbContext.Users.Count(user =>
                    user.RestaurantId == restaurantId &&
                    user.PlatformRole == PlatformRole.Staff)))
            .FirstAsync(cancellationToken);

        // The fortnight, read once and cut several ways - the same shape the platform
        // pulse uses, for the same reason: one set of rows cannot disagree with itself.
        var windowOrders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                order.CreatedAtUtc >= windowStart &&
                order.CreatedAtUtc < tomorrowStart)
            .Select(order => new { order.CreatedAtUtc, order.Status })
            .ToListAsync(cancellationToken);

        var windowPayments = await _dbContext.Payments
            .AsNoTracking()
            .Where(payment =>
                payment.RestaurantId == restaurantId &&
                payment.RecordedAtUtc >= windowStart &&
                payment.RecordedAtUtc < tomorrowStart)
            .Select(payment => new
            {
                payment.RecordedAtUtc,
                payment.Amount,
                payment.Method,
            })
            .ToListAsync(cancellationToken);

        var ordersByDay = windowOrders
            .GroupBy(order => ServiceDay.LocalToday(order.CreatedAtUtc))
            .ToDictionary(
                group => group.Key,
                group => new DayOrders(
                    group.Count(),
                    group.Count(order => order.Status == OrderStatus.Completed),
                    group.Count(order => order.Status == OrderStatus.Cancelled)));

        var paymentsByDay = windowPayments
            .GroupBy(payment => ServiceDay.LocalToday(payment.RecordedAtUtc))
            .ToDictionary(
                group => group.Key,
                group => new DayTakings(
                    group.Sum(payment => payment.Amount),
                    group.Count()));

        var days = Enumerable
            .Range(0, TrendDays)
            .Select(offset =>
            {
                var date = today.AddDays(offset - (TrendDays - 1));
                var orders = ordersByDay.GetValueOrDefault(date);
                var takings = paymentsByDay.GetValueOrDefault(date);

                return new PlatformTrendDayResponse(
                    date,
                    orders.Placed,
                    orders.Completed,
                    orders.Cancelled,
                    takings.Total);
            })
            .ToList();

        // Tender over the fortnight rather than over today. One restaurant on one day
        // may take three payments, and a pie of three slices says nothing about
        // whether this is a cash house.
        var methods = windowPayments
            .GroupBy(payment => payment.Method)
            .ToDictionary(
                group => group.Key,
                group => new DayTakings(
                    group.Sum(payment => payment.Amount),
                    group.Count()));

        var byMethod = Enum.GetValues<PaymentMethod>()
            .Select(method =>
            {
                var totals = methods.GetValueOrDefault(method);

                return new MethodTotalResponse(method, totals.Count, totals.Total);
            })
            .ToList();

        var platesAtPass = await _dbContext.KitchenTicketItems
            .AsNoTracking()
            .CountAsync(
                item =>
                    item.KitchenTicket.RestaurantId == restaurantId &&
                    item.ReadyAtUtc != null &&
                    item.ServedAtUtc == null,
                cancellationToken);

        var lastOrderAtUtc = await _dbContext.Orders
            .AsNoTracking()
            .Where(order => order.RestaurantId == restaurantId)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Select(order => (DateTimeOffset?)order.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        // Oldest first. On a floor the order that has been open longest is the one
        // somebody needs to go and look at.
        var running = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId && order.Status == OrderStatus.Open)
            .OrderBy(order => order.CreatedAtUtc)
            .Select(order => new PlatformRestaurantOrderResponse(
                order.Id,
                order.OrderNumber,
                order.Table.Name,
                order.Status,
                order.Items.Count,
                order.KitchenTickets
                    .SelectMany(ticket => ticket.Items)
                    .Count(item => item.ReadyAtUtc != null && item.ServedAtUtc == null),
                order.Total,
                order.CreatedAtUtc,
                null))
            .ToListAsync(cancellationToken);

        var recent = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId && order.Status != OrderStatus.Open)
            .OrderByDescending(order =>
                order.CompletedAtUtc ?? order.CancelledAtUtc ?? order.CreatedAtUtc)
            .Take(RecentOrders)
            .Select(order => new PlatformRestaurantOrderResponse(
                order.Id,
                order.OrderNumber,
                order.Table.Name,
                order.Status,
                order.Items.Count,
                0,
                order.Total,
                order.CreatedAtUtc,
                order.CompletedAtUtc ?? order.CancelledAtUtc))
            .ToListAsync(cancellationToken);

        var recentFrom = now.AddDays(-30);

        // Two plain aggregates rather than one clever one. A filtered Average inside a
        // group projection is not an aggregate any provider translates, and the version
        // that tried it would have compiled perfectly and thrown on the first
        // restaurant that had a review.
        var reviews = await RatingOf(
            _dbContext.Reviews.Where(review => review.RestaurantId == restaurantId),
            cancellationToken);

        var recentReviews = await RatingOf(
            _dbContext.Reviews.Where(review =>
                review.RestaurantId == restaurantId &&
                review.SubmittedAtUtc >= recentFrom),
            cancellationToken);

        return Result.Success(new PlatformRestaurantDetailResponse(
            restaurant.Id,
            restaurant.Name,
            restaurant.Slug,
            restaurant.IsActive,
            restaurant.ContactEmail,
            restaurant.ContactPhone,
            restaurant.AddressLine,
            restaurant.City,
            restaurant.Country,
            restaurant.CreatedAtUtc,
            restaurant.UpdatedAtUtc,
            now,
            today,
            manager,
            setup,
            staff,
            DayOf(ordersByDay.GetValueOrDefault(today), paymentsByDay.GetValueOrDefault(today)),
            DayOf(
                ordersByDay.GetValueOrDefault(today.AddDays(-1)),
                paymentsByDay.GetValueOrDefault(today.AddDays(-1))),
            running.Count,
            platesAtPass,
            lastOrderAtUtc,
            days,
            byMethod,
            running,
            recent,
            new PlatformRestaurantReviewsResponse(
                reviews.Count,
                reviews.Average,
                recentReviews.Count,
                recentReviews.Average)));
    }

    /// <summary>
    /// How far back the pulse trend line reaches.
    ///
    /// One week. It used to be a fortnight, and the fortnight was the reason this
    /// endpoint and the platform report had grown into two answers to the same
    /// question. They are split along what a reader is actually doing: the overview is
    /// today and the days either side of it, the report is any range at all, compared
    /// with the range before it. A week is the shortest span that still shows a
    /// weekend, which is the only rhythm an operator needs from a live screen.
    ///
    /// It also halves both window reads, which is the cheapest thing on this page.
    /// </summary>
    private const int TrendDays = 7;

    /// <summary>
    /// How many closed orders the restaurant page lists.
    ///
    /// Ten: enough to see the shape of a service, few enough that anybody mistakes it
    /// for the ledger. A full list is a question for the report, which can be paged.
    /// </summary>
    private const int RecentOrders = 10;

    /// <summary>
    /// The most entries one activity request will return.
    ///
    /// A ceiling rather than paging: this is a recent-activity list on a settings
    /// screen, not an archive. When somebody needs the archive, it wants a date range
    /// and a filter, which is a different endpoint and a different screen.
    /// </summary>
    private const int ActivityLimit = 200;

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<PlatformActivityResponse>>> GetActivityAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.AdminActivities
            .AsNoTracking()
            .OrderByDescending(activity => activity.AtUtc)
            .ThenByDescending(activity => activity.Id)
            .Take(Math.Clamp(limit, 1, ActivityLimit))
            .Select(activity => new PlatformActivityResponse(
                activity.Id,
                activity.ActorName,
                activity.Action,
                activity.Subject,
                activity.SubjectId,
                activity.Detail,
                activity.AtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<PlatformActivityResponse>>(rows);
    }

    /// <inheritdoc />
    public async Task<Result<PlatformSettingsResponse>> GetSettingsAsync(
        CancellationToken cancellationToken)
    {
        var settings = await LoadSettingsAsync(cancellationToken);

        return Result.Success(new PlatformSettingsResponse(
            settings.DefaultVatRate,
            settings.DefaultServiceChargeRate,
            settings.UpdatedAtUtc == default ? null : settings.UpdatedAtUtc));
    }

    /// <inheritdoc />
    public async Task<Result<PlatformSettingsResponse>> UpdateSettingsAsync(
        UpdatePlatformSettingsRequest request,
        CancellationToken cancellationToken)
    {
        // A rate is a fraction. Guarded here rather than left to the database, because
        // a service charge of 1300% saved successfully is a worse outcome than a
        // rejected request, and the person typing it meant 13.
        if (request.DefaultVatRate is < 0m or > 1m ||
            request.DefaultServiceChargeRate is < 0m or > 1m)
        {
            return Result.Failure<PlatformSettingsResponse>(PlatformErrors.RateOutOfRange);
        }

        var settings = await LoadSettingsAsync(cancellationToken);
        var tracked = await _dbContext.PlatformSettings
            .FirstOrDefaultAsync(row => row.Id == Domain.Platform.PlatformSettings.WellKnownId, cancellationToken);

        if (tracked is null)
        {
            tracked = settings;
            _dbContext.PlatformSettings.Add(tracked);
        }

        tracked.DefaultVatRate = request.DefaultVatRate;
        tracked.DefaultServiceChargeRate = request.DefaultServiceChargeRate;
        tracked.UpdatedAtUtc = DateTimeOffset.UtcNow;
        tracked.UpdatedByUserId = _currentUser.UserId;

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _activity.RecordAsync(
            AdminActions.SettingsUpdated,
            "Platform defaults",
            null,
            $"VAT {request.DefaultVatRate:P2}, service charge {request.DefaultServiceChargeRate:P2}",
            cancellationToken);

        return Result.Success(new PlatformSettingsResponse(
            tracked.DefaultVatRate,
            tracked.DefaultServiceChargeRate,
            tracked.UpdatedAtUtc));
    }

    /// <summary>
    /// The one settings row, or the defaults it would hold if nobody has written it.
    ///
    /// Not created on read. A GET that writes is a GET that fails on a read replica and
    /// surprises whoever profiles it, and the entity already knows what it starts as.
    /// </summary>
    private async Task<Domain.Platform.PlatformSettings> LoadSettingsAsync(
        CancellationToken cancellationToken) =>
        await _dbContext.PlatformSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                row => row.Id == Domain.Platform.PlatformSettings.WellKnownId,
                cancellationToken)
        ?? new Domain.Platform.PlatformSettings();

    /// <inheritdoc />
    public async Task<Result<PlatformSystemResponse>> GetSystemAsync(
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        var reachable = await _dbContext.Database.CanConnectAsync(cancellationToken);

        // Both lists are empty rather than thrown when the database is unreachable.
        // A health screen that fails to load is the least useful thing it could do,
        // and "cannot connect" is itself the answer somebody came for.
        var applied = reachable
            ? await _dbContext.Database.GetAppliedMigrationsAsync(cancellationToken)
            : [];

        var pending = reachable
            ? await _dbContext.Database.GetPendingMigrationsAsync(cancellationToken)
            : [];

        return Result.Success(new PlatformSystemResponse(
            now,
            ServiceDay.LocalToday(now),
            ServiceDay.Label,
            (int)ServiceDay.Offset.TotalMinutes,
            // Read from the environment rather than through IHostEnvironment, which
            // would put a hosting dependency into a layer that has no business
            // knowing it is hosted at all.
            System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
            Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "Unknown",
            reachable,
            applied.Count(),
            pending.ToList()));
    }

    /// <inheritdoc />
    public async Task<Result<PlatformPulseResponse>> GetPulseAsync(
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var today = ServiceDay.LocalToday(now);

        // Built from the service day rather than from twenty-four hours ago, so "today"
        // here means the same thing it means to a restaurant closing its till.
        var todayStart = ServiceDay.StartOn(today);
        var tomorrowStart = ServiceDay.StartOn(today.AddDays(1));
        var windowStart = ServiceDay.StartOn(today.AddDays(-(TrendDays - 1)));

        var restaurants = await _dbContext.Restaurants
            .AsNoTracking()
            .OrderBy(restaurant => restaurant.Name)
            .Select(restaurant => new
            {
                restaurant.Id,
                restaurant.Name,
                restaurant.Slug,
                restaurant.IsActive,
                HasManager = restaurant.ManagerId != null,
            })
            .ToListAsync(cancellationToken);

        // Everything about the fortnight, today and yesterday included, comes out of
        // these two reads.
        //
        // They are projected down to the handful of columns the arithmetic needs and
        // then grouped in memory, for two reasons. The service day boundary is a fixed
        // offset that no provider turns into a GROUP BY without a cast nobody could
        // read a year from now. And every figure on this screen - the trend, the hours,
        // the tender split, each restaurant's day - is a different slice of the same
        // fortnight, so asking for it once and cutting it several ways is both fewer
        // round trips and one set of numbers that cannot disagree with itself.
        //
        // The window is a fortnight of one platform's orders, which is small. If this
        // ever stops being true the fix is a rolled-up table, not a cleverer query.
        var windowOrders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.CreatedAtUtc >= windowStart && order.CreatedAtUtc < tomorrowStart)
            .Select(order => new
            {
                order.CreatedAtUtc,
                order.RestaurantId,
                order.Status,
            })
            .ToListAsync(cancellationToken);

        var windowPayments = await _dbContext.Payments
            .AsNoTracking()
            .Where(payment =>
                payment.RecordedAtUtc >= windowStart &&
                payment.RecordedAtUtc < tomorrowStart)
            .Select(payment => new
            {
                payment.RecordedAtUtc,
                payment.RestaurantId,
                payment.Amount,
                payment.Method,
            })
            .ToListAsync(cancellationToken);

        var openOrders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order => order.Status == OrderStatus.Open)
            .GroupBy(order => order.RestaurantId)
            .Select(group => new { RestaurantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.RestaurantId, row => row.Count, cancellationToken);

        // Counted per dish rather than per slip, because that is what is physically
        // sitting under the lamp since the kitchen started working line by line.
        var platesAtPass = await _dbContext.KitchenTicketItems
            .AsNoTracking()
            .Where(item => item.ReadyAtUtc != null && item.ServedAtUtc == null)
            .GroupBy(item => item.KitchenTicket.RestaurantId)
            .Select(group => new { RestaurantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.RestaurantId, row => row.Count, cancellationToken);

        // The whole point of the screen, and the one read not bounded by the window: a
        // restaurant that last traded a week ago is exactly the one worth knowing about.
        var lastOrder = await _dbContext.Orders
            .AsNoTracking()
            .GroupBy(order => order.RestaurantId)
            .Select(group => new
            {
                RestaurantId = group.Key,
                At = group.Max(order => order.CreatedAtUtc),
            })
            .ToDictionaryAsync(row => row.RestaurantId, row => row.At, cancellationToken);

        // Bucketed by the local date of the instant, which is the rule StartOn draws
        // its boundaries with, so a day in the trend holds exactly what a day on the
        // report would.
        var ordersByDay = windowOrders
            .GroupBy(order => ServiceDay.LocalToday(order.CreatedAtUtc))
            .ToDictionary(
                group => group.Key,
                group => new DayOrders(
                    group.Count(),
                    group.Count(order => order.Status == OrderStatus.Completed),
                    group.Count(order => order.Status == OrderStatus.Cancelled)));

        var paymentsByDay = windowPayments
            .GroupBy(payment => ServiceDay.LocalToday(payment.RecordedAtUtc))
            .ToDictionary(
                group => group.Key,
                group => new DayTakings(
                    group.Sum(payment => payment.Amount),
                    group.Count()));

        var todayOrders = windowOrders.Where(order => order.CreatedAtUtc >= todayStart).ToList();
        var todayPaymentRows = windowPayments
            .Where(payment => payment.RecordedAtUtc >= todayStart)
            .ToList();

        var ordersTodayByRestaurant = todayOrders
            .GroupBy(order => order.RestaurantId)
            .ToDictionary(group => group.Key, group => group.Count());

        var takingsTodayByRestaurant = todayPaymentRows
            .GroupBy(payment => payment.RestaurantId)
            .ToDictionary(group => group.Key, group => group.Sum(payment => payment.Amount));

        // Oldest first, every day present. A chart reading this can draw a flat stretch
        // for a week nobody traded; it cannot draw a day that was simply left out.
        var dates = Enumerable
            .Range(0, TrendDays)
            .Select(offset => today.AddDays(offset - (TrendDays - 1)))
            .ToList();

        var days = dates
            .Select(date =>
            {
                var orders = ordersByDay.GetValueOrDefault(date);
                var payments = paymentsByDay.GetValueOrDefault(date);

                return new PlatformTrendDayResponse(
                    date,
                    orders.Placed,
                    orders.Completed,
                    orders.Cancelled,
                    payments.Total);
            })
            .ToList();

        // All twenty-four, including the ones still to come, so a chart drawing this
        // has the shape of a whole day from the moment it is opened.
        var ordersByHour = todayOrders
            .GroupBy(order => order.CreatedAtUtc.ToOffset(ServiceDay.Offset).Hour)
            .ToDictionary(group => group.Key, group => group.Count());

        var takingsByHour = todayPaymentRows
            .GroupBy(payment => payment.RecordedAtUtc.ToOffset(ServiceDay.Offset).Hour)
            .ToDictionary(group => group.Key, group => group.Sum(payment => payment.Amount));

        var hours = Enumerable
            .Range(0, 24)
            .Select(hour => new PlatformHourResponse(
                hour,
                ordersByHour.GetValueOrDefault(hour),
                takingsByHour.GetValueOrDefault(hour)))
            .ToList();

        // Every method listed even at zero, the same rule the reports follow: a missing
        // row would leave a screen guessing whether nothing was taken or the field was
        // dropped.
        var methodsToday = todayPaymentRows
            .GroupBy(payment => payment.Method)
            .ToDictionary(
                group => group.Key,
                group => new DayTakings(
                    group.Sum(payment => payment.Amount),
                    group.Count()));

        var byMethodToday = Enum.GetValues<PaymentMethod>()
            .Select(method =>
            {
                var totals = methodsToday.GetValueOrDefault(method);

                return new MethodTotalResponse(method, totals.Count, totals.Total);
            })
            .ToList();

        var rows = restaurants
            .Select(restaurant => new PlatformPulseRestaurantResponse(
                restaurant.Id,
                restaurant.Name,
                restaurant.Slug,
                restaurant.IsActive,
                restaurant.HasManager,
                ordersTodayByRestaurant.GetValueOrDefault(restaurant.Id),
                takingsTodayByRestaurant.GetValueOrDefault(restaurant.Id),
                openOrders.GetValueOrDefault(restaurant.Id),
                platesAtPass.GetValueOrDefault(restaurant.Id),
                lastOrder.TryGetValue(restaurant.Id, out var at) ? at : null))
            .ToList();

        return Result.Success(new PlatformPulseResponse(
            today,
            now,
            DayOf(ordersByDay.GetValueOrDefault(today), paymentsByDay.GetValueOrDefault(today)),
            DayOf(
                ordersByDay.GetValueOrDefault(today.AddDays(-1)),
                paymentsByDay.GetValueOrDefault(today.AddDays(-1))),
            openOrders.Values.Sum(),
            platesAtPass.Values.Sum(),
            rows.Count(row => row.OrdersToday > 0),
            days,
            hours,
            byMethodToday,
            rows));
    }

    /// <summary>How many reviews, and what they average.</summary>
    private readonly record struct Rating(int Count, double? Average);

    /// <summary>
    /// Count and mean rating over a set of reviews, rounded for display.
    ///
    /// Null rather than zero when there are none: a restaurant nobody has reviewed has
    /// no rating, and drawing that as nought out of five would libel it.
    /// </summary>
    private static async Task<Rating> RatingOf(
        IQueryable<Review> reviews,
        CancellationToken cancellationToken)
    {
        var totals = await reviews
            .AsNoTracking()
            .GroupBy(review => 1)
            .Select(group => new
            {
                Count = group.Count(),
                Average = group.Average(review => (double)review.Rating),
            })
            .SingleOrDefaultAsync(cancellationToken);

        return totals is null || totals.Count == 0
            ? new Rating(0, null)
            : new Rating(totals.Count, Math.Round(totals.Average, 2));
    }

    /// <summary>
    /// What a manager typed when they did not type anything.
    ///
    /// A named bucket rather than a blank row, so the reason list still adds up to the
    /// cancellation count and "nobody says why" is itself visible as a figure.
    /// </summary>
    private const string NoReasonGiven = "No reason given";

    /// <summary>One service day inside a report range, as it is accumulated.</summary>
    private readonly record struct DayTotals(
        int Bills,
        decimal Takings,
        int Cancelled,
        decimal CancelledValue);

    /// <summary>One day's orders, split by what became of them.</summary>
    private readonly record struct DayOrders(int Placed, int Completed, int Cancelled);

    /// <summary>One day's money, and how many bills it arrived on.</summary>
    private readonly record struct DayTakings(decimal Total, int Count);

    /// <summary>
    /// One day, as the response carries it.
    ///
    /// Value types rather than anonymous ones, so a day nobody traded reads as zeroes
    /// without a null check at every use. There is no difference here between "no
    /// orders" and "no row", and pretending otherwise only invites a null reference on
    /// the quietest day of the year.
    /// </summary>
    private static PlatformDayResponse DayOf(DayOrders orders, DayTakings takings) =>
        new(
            orders.Placed,
            orders.Completed,
            orders.Cancelled,
            takings.Total,
            takings.Count == 0 ? 0m : Math.Round(takings.Total / takings.Count, 2));

    /// <summary>
    /// An average that does not divide by nothing.
    ///
    /// Computed on the server so every screen shows the same figure rather than each
    /// dividing for itself and rounding differently.
    /// </summary>
    private static decimal Average(decimal total, int count) =>
        count == 0 ? 0m : decimal.Round(total / count, 2, MidpointRounding.AwayFromZero);
}
