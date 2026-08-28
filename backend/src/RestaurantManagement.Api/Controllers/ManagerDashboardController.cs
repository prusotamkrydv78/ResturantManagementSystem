using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Dashboard;
using RestaurantManagement.Application.Dashboard.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The manager operational overview.
///
/// Restaurant Manager only, so a waiter, a chef and a platform admin are
/// all refused. There is deliberately no platform-wide equivalent of this: the
/// question it answers is about one restaurant floor.
///
/// Read only. One route, one response, no writes, and no restaurant identifier: the
/// restaurant comes from the record the caller manages.
/// </summary>
[ApiController]
[Route("api/manager")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class ManagerDashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    /// <summary>Creates the controller.</summary>
    public ManagerDashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    /// <summary>
    /// What is happening in this restaurant right now, and what it has done today.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ManagerDashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ManagerDashboardResponse>> GetDashboard(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _dashboardService.GetAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
