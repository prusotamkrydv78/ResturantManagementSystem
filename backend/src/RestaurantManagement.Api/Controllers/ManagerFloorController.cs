using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Floor;
using RestaurantManagement.Application.Floor.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The live floor, for the manager of the restaurant.
///
/// Restaurant Manager only. Read only: there is no action here that changes a table.
/// Occupancy is set by placing an order and cleared by closing or cancelling one, and
/// this route deliberately offers no way round that.
///
/// No action accepts a restaurant identifier: ownership comes from the restaurant
/// record the caller manages.
/// </summary>
[ApiController]
[Route("api/manager")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class ManagerFloorController : ControllerBase
{
    private readonly IFloorService _floorService;

    /// <summary>Creates the controller.</summary>
    public ManagerFloorController(IFloorService floorService)
    {
        _floorService = floorService;
    }

    /// <summary>Every table and what is happening at it right now.</summary>
    [HttpGet("floor")]
    [ProducesResponseType(typeof(FloorOverviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FloorOverviewResponse>> GetFloor(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _floorService.GetForManagerAsync(
            managerId.Value,
            cancellationToken);

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
