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
            .Include(order => order.Payment)
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
            .Where(order => order.Payment is not null)
            .Select(order => order.Payment!)
            .ToList();

        var paymentTotal = payments.Sum(payment => payment.Amount);

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
            completed.Take(RowLimit).Select(ToCompletedRow).ToList(),
            cancelled.Take(RowLimit).Select(ToCancelledRow).ToList()));
    }

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
            order.Payment?.Amount ?? order.Subtotal,
            order.Items.Sum(item => item.Quantity),
            order.CompletedAtUtc ?? order.UpdatedAtUtc,
            order.Payment?.Method,
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
