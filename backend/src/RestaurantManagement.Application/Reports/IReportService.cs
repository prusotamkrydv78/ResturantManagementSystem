using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reports;

/// <summary>
/// What a restaurant did over a range of days.
///
/// Read only, and computed on demand from the orders and payments that already exist.
/// Nothing is stored, rolled up or scheduled: a figure kept beside the records it
/// summarises eventually disagrees with them, and a report that disagrees with the
/// billing screen is worse than no report.
///
/// The restaurant is derived from the manager who owns it, and the dates are read in
/// the restaurant own timezone, because a manager asking for a day means their day.
/// </summary>
public interface IReportService
{
    /// <summary>
    /// The summary for a range of the restaurant own days, inclusive of both ends.
    ///
    /// Omitting both dates asks for today. Omitting one asks for the single day the
    /// other names. The range is bounded, so a request cannot walk the whole history.
    /// </summary>
    /// <param name="managerUserId">The authenticated manager.</param>
    /// <param name="from">
    /// First day to include, in the restaurant own calendar. Null means the same day as
    /// <paramref name="to"/>, or today when that is null too.
    /// </param>
    /// <param name="to">Last day to include. Null means today.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<ReportSummaryResponse>> GetSummaryAsync(
        Guid managerUserId,
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken);
}
