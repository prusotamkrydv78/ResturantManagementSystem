using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Reports;

/// <summary>Failures the reporting module can report.</summary>
public static class ReportErrors
{
    /// <summary>
    /// The caller manages no restaurant, so there is nothing to report on.
    /// </summary>
    public static readonly Error NoRestaurantAssigned =
        new("report.no_restaurant", "No restaurant is assigned to this account yet.");

    /// <summary>
    /// The range runs backwards.
    ///
    /// Refused rather than quietly swapped: a manager who typed the dates the wrong
    /// way round should be told, not handed figures for a range they did not ask for.
    /// </summary>
    public static readonly Error RangeBackwards =
        new(
            "report.range_backwards",
            "The start of the range comes after its end. Check the dates.");

    /// <summary>
    /// The range is longer than the report will cover in one request.
    ///
    /// There is no pagination anywhere in this product, so an unbounded range would be
    /// an unbounded query. Refused with the limit named, rather than silently
    /// truncated, because a report that quietly covered less than it was asked for
    /// would be read as if it covered everything.
    /// </summary>
    public static Error RangeTooLong(int maximumDays) =>
        new(
            "report.range_too_long",
            $"A report covers at most {maximumDays} days at a time. Narrow the range.");
}
