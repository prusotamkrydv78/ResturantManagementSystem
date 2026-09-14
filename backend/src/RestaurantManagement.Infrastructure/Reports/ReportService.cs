using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Application.Reports;
using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Reports;

/// <summary>
/// What a restaurant did over a range of days.
///
/// Every figure is computed from the orders and payments themselves at the moment of
/// asking. Nothing is rolled up or stored, which is the only way a report and the
/// billing screen can be guaranteed to agree.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// manager who owns it and every query is filtered by it. The dates are read in the
/// restaurant own timezone, so a manager asking for the 3rd gets their 3rd.
/// </summary>
public sealed class ReportService : IReportService
{
    /// <summary>
    /// The longest range one request will cover.
    ///
    /// There is no pagination in this product, so the bound lives here. A quarter is
    /// long enough to be useful and short enough that the rows behind the figures stay
    /// a list rather than an archive.
    /// </summary>
    private const int MaxRangeDays = 92;

    /// <summary>
    /// How many rows to list behind each figure. The totals cover the whole range; the
    /// lists are there to recognise and open individual orders, not to be paged
    /// through.
    /// </summary>
    private const int RowLimit = 50;

    private readonly ApplicationDbContext _dbContext;

    /// <summary>Creates the service.</summary>
    public ReportService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<Result<ReportSummaryResponse>> GetSummaryAsync(
        Guid managerUserId,
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken)
    {
        // The whole record, because the range boundaries are the restaurant own
        // configuration rather than the server calendar.
        var restaurant = await _dbContext.Restaurants
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.ManagerId == managerUserId,
                cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<ReportSummaryResponse>(
                ReportErrors.NoRestaurantAssigned);
        }

        var today = ServiceDay.LocalToday(DateTimeOffset.UtcNow);

        // Nothing asked for means today. One end asked for means that single day, which
        // is what a manager typing one date almost always wants.
        var last = to ?? from ?? today;
        var first = from ?? last;

        if (first > last)
        {
            return Result.Failure<ReportSummaryResponse>(ReportErrors.RangeBackwards);
        }

        var dayCount = last.DayNumber - first.DayNumber + 1;

        if (dayCount > MaxRangeDays)
        {
            return Result.Failure<ReportSummaryResponse>(
                ReportErrors.RangeTooLong(MaxRangeDays));
        }

        // Half open: from the boundary of the first day up to the boundary of the day
        // after the last, so every service day is covered once and no boundary is
        // counted twice.
        var start = ServiceDay.StartOn(first);
        var end = ServiceDay.StartOn(last.AddDays(1));

        // The period of the same length, immediately before. Not "last month" and not
        // "this week last year": a manager who asked for eleven days gets eleven days
        // to read them against, and no calendar rule has to be explained on screen
        // before the comparison can be trusted.
        var previousLast = first.AddDays(-1);
        var previousFirst = previousLast.AddDays(-(dayCount - 1));
        var previousStart = ServiceDay.StartOn(previousFirst);

        // Selected by when they ended rather than when they were placed, so a table
        // that opened before a boundary and settled after it belongs to the day it was
        // paid on. That is the same rule the dashboard uses.
        var closed = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurant.Id &&
                ((order.CompletedAtUtc != null &&
                  order.CompletedAtUtc >= start &&
                  order.CompletedAtUtc < end) ||
                 (order.CancelledAtUtc != null &&
                  order.CancelledAtUtc >= start &&
                  order.CancelledAtUtc < end)))
            .Include(order => order.Items)
            .Include(order => order.Table)
            .Include(order => order.Payments)
            .ToListAsync(cancellationToken);

        var completed = closed
            .Where(order => order.Status == OrderStatus.Completed)
            .OrderByDescending(order => order.CompletedAtUtc)
            .ToList();

        var cancelled = closed
            .Where(order => order.Status == OrderStatus.Cancelled)
            .OrderByDescending(order => order.CancelledAtUtc)
            .ToList();

        // Money that actually arrived, read from the payment records rather than from
        // the order totals. The two agree today, and reading the payments means this
        // figure stays honest if they ever cannot.
        var payments = completed
            .SelectMany(order => order.Payments)
            .ToList();

        var paymentTotal = payments.Sum(payment => payment.Amount);

        // One extra read, deliberately thinner than the one above: the previous period
        // only ever appears as a handful of totals, so it is projected down to what a
        // subtraction needs rather than to what a table would. Same selection rule -
        // by when an order ended, not when it was placed.
        var before = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurant.Id &&
                ((order.CompletedAtUtc != null &&
                  order.CompletedAtUtc >= previousStart &&
                  order.CompletedAtUtc < start) ||
                 (order.CancelledAtUtc != null &&
                  order.CancelledAtUtc >= previousStart &&
                  order.CancelledAtUtc < start)))
            .Select(order => new
            {
                order.Status,
                order.Subtotal,
                Paid = order.Payments.Sum(payment => (decimal?)payment.Amount) ?? 0m,
                PaymentCount = order.Payments.Count(),
            })
            .ToListAsync(cancellationToken);

        var beforeCompleted = before.Where(row => row.Status == OrderStatus.Completed).ToList();
        var beforeCancelled = before.Where(row => row.Status == OrderStatus.Cancelled).ToList();
        var beforeTotal = beforeCompleted.Sum(row => row.Paid);
        var beforeCount = beforeCompleted.Sum(row => row.PaymentCount);

        // Every day present, oldest first. A gap in a chart reads as missing data
        // rather than as a day the restaurant was shut, and the chart cannot tell the
        // difference.
        var byDay = closed
            .Select(order => new
            {
                Date = ServiceDay.LocalToday(
                    order.CompletedAtUtc ?? order.CancelledAtUtc ?? order.CreatedAtUtc),
                order.Status,
                order.Subtotal,
                Paid = order.Payments.Sum(payment => payment.Amount),
                PaymentCount = order.Payments.Count,
            })
            .GroupBy(row => row.Date)
            .ToDictionary(group => group.Key, group => group.ToList());

        var days = Enumerable
            .Range(0, dayCount)
            .Select(offset =>
            {
                var date = first.AddDays(offset);
                var rows = byDay.GetValueOrDefault(date) ?? [];

                return new ReportDayResponse(
                    date,
                    rows.Where(row => row.Status == OrderStatus.Completed)
                        .Sum(row => row.PaymentCount),
                    rows.Where(row => row.Status == OrderStatus.Completed)
                        .Sum(row => row.Paid),
                    rows.Count(row => row.Status == OrderStatus.Cancelled),
                    rows.Where(row => row.Status == OrderStatus.Cancelled)
                        .Sum(row => row.Subtotal));
            })
            .ToList();

        // Derived from the days rather than from the orders again: one source, so the
        // week profile and the chart above it cannot drift apart.
        var byWeekday = Enum.GetValues<DayOfWeek>()
            .Select(weekday =>
            {
                var matching = days.Where(day => day.LocalDate.DayOfWeek == weekday).ToList();

                return new ReportWeekdayResponse(
                    weekday,
                    matching.Sum(day => day.Bills),
                    matching.Sum(day => day.Takings));
            })
            .ToList();

        // Heaviest first by value rather than by count: ten tables walking out on a
        // misheard order costs less than one banquet called off, and this is a page
        // about money.
        var cancellations = cancelled
            .GroupBy(order =>
                string.IsNullOrWhiteSpace(order.CancellationReason)
                    ? NoReasonGiven
                    : order.CancellationReason.Trim())
            .Select(group => new ReportCancellationResponse(
                group.Key,
                group.Count(),
                group.Sum(order => order.Subtotal)))
            .OrderByDescending(reason => reason.Value)
            .ThenByDescending(reason => reason.Count)
            .ToList();

        return Result.Success(new ReportSummaryResponse(
            first,
            last,
            start,
            end,
            dayCount,
            completed.Count,
            cancelled.Count,
            paymentTotal,
            payments.Count,
            // Never added to the takings. This is money that did not arrive.
            cancelled.Sum(order => order.Subtotal),
            payments.Count == 0
                ? 0m
                : decimal.Round(paymentTotal / payments.Count, 2),
            ByMethod(payments),
            new ReportPeriodResponse(
                previousFirst,
                previousLast,
                beforeCompleted.Count,
                beforeCancelled.Count,
                beforeCancelled.Sum(row => row.Subtotal),
                beforeTotal,
                beforeCount,
                beforeCount == 0 ? 0m : decimal.Round(beforeTotal / beforeCount, 2)),
            days,
            byWeekday,
            cancellations,
            completed.Take(RowLimit).Select(ToCompletedRow).ToList(),
            cancelled.Take(RowLimit).Select(ToCancelledRow).ToList()));
    }

    /// <summary>
    /// What a manager typed when they typed nothing.
    ///
    /// A named bucket rather than a blank row, so the reasons still add up to the
    /// cancellation count and "nobody says why" is itself a figure on the page.
    /// </summary>
    private const string NoReasonGiven = "No reason given";

    /// <summary>
    /// The takings split by tender, with every method present even at zero.
    ///
    /// A missing row would read as missing data rather than as nothing taken, and the
    /// shape of the breakdown would change with the range.
    /// </summary>
    private static List<MethodTotalResponse> ByMethod(IReadOnlyList<Payment> payments) =>
        Enum.GetValues<PaymentMethod>()
            .Select(method =>
            {
                var taken = payments.Where(payment => payment.Method == method).ToList();

                return new MethodTotalResponse(
                    method,
                    taken.Count,
                    taken.Sum(payment => payment.Amount));
            })
            .ToList();

    private static ReportOrderResponse ToCompletedRow(Order order) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Table.Name,
            // What was taken, not what the order came to. They match today, and this
            // reads the record that actually says how much money changed hands.
            order.Payments.Count == 0 ? order.Total : order.AmountPaid,
            order.Items.Sum(item => item.Quantity),
            order.CompletedAtUtc ?? order.UpdatedAtUtc,
            order.Payments.Count == 1 ? order.Payments.First().Method : null,
            null);

    private static ReportOrderResponse ToCancelledRow(Order order) =>
        new(
            order.Id,
            order.OrderNumber,
            order.Table.Name,
            // What it would have come to. Shown so the row means something, and kept
            // out of every total.
            order.Subtotal,
            order.Items.Sum(item => item.Quantity),
            order.CancelledAtUtc ?? order.UpdatedAtUtc,
            null,
            order.CancellationReason);
}
