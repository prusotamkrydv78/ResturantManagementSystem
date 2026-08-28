using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Reports;
using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// What a restaurant did over a range of days.
///
/// Restaurant Manager only, read only, and no restaurant identifier: the restaurant
/// comes from the record the caller manages.
///
/// The dates are the restaurant own days rather than the server calendar, because a
/// manager asking for the 3rd means their 3rd. Which instants that resolved to is sent
/// back with the figures, so what was counted is auditable rather than implied.
/// </summary>
[ApiController]
[Route("api/reports")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    /// <summary>Creates the controller.</summary>
    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    /// <summary>
    /// The summary for a range of days, inclusive of both ends.
    /// </summary>
    /// <param name="from">
    /// First day to include, as a date. Omit both to get today; omit this one to get
    /// the single day <paramref name="to"/> names.
    /// </param>
    /// <param name="to">Last day to include. Omit for today.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(ReportSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReportSummaryResponse>> GetSummary(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _reportService.GetSummaryAsync(
            managerId.Value,
            from,
            to,
            cancellationToken);

        if (result.IsFailure)
        {
            // A range the caller got wrong is a bad request; anything else here means
            // there is no restaurant to report on.
            var status = result.Error == ReportErrors.NoRestaurantAssigned
                ? StatusCodes.Status404NotFound
                : StatusCodes.Status400BadRequest;

            return ProblemFrom(result.Error!, status);
        }

        return Ok(result.Value);
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
