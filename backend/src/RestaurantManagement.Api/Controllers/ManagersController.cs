using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Managers;
using RestaurantManagement.Application.Managers.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Restaurant manager administration.
///
/// The whole controller is Super Admin only, so restaurant managers and ordinary
/// users cannot read the manager list or change assignments. It stays thin: every
/// rule lives in <see cref="IManagerService"/>.
/// </summary>
[ApiController]
[Route("api/managers")]
[Authorize(Roles = PlatformRoles.SuperAdmin)]
public sealed class ManagersController : ControllerBase
{
    private readonly IManagerService _managerService;

    /// <summary>Creates the controller.</summary>
    public ManagersController(IManagerService managerService)
    {
        _managerService = managerService;
    }

    /// <summary>Lists managers, optionally filtered by search text and assignment.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ManagerResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ManagerResponse>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] ManagerAssignmentFilter status,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.GetAllAsync(search, status, cancellationToken);

        return Ok(result.Value);
    }

    /// <summary>Loads one manager with their current assignment.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ManagerResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.GetByIdAsync(id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Creates a manager. The platform role is set by the server; the request has no
    /// field for it.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> Create(
        CreateManagerRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.CreateAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>Updates the name and email of a manager.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> Update(
        Guid id,
        UpdateManagerRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.UpdateAsync(id, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Assigns or reassigns the manager to a restaurant. Moving them off a previous
    /// restaurant is handled here; taking over an occupied restaurant is refused.
    /// </summary>
    [HttpPut("{id:guid}/assignment")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> Assign(
        Guid id,
        AssignRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.AssignAsync(
            id,
            request.RestaurantId,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Removes the assignment. The account stays active.</summary>
    [HttpDelete("{id:guid}/assignment")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ManagerResponse>> Unassign(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.UnassignAsync(id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Replaces the password. The only way back in for a manager who lost it.</summary>
    [HttpPut("{id:guid}/password")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ManagerResponse>> ResetPassword(
        Guid id,
        ResetManagerPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.ResetPasswordAsync(id, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Suspends or restores the account. Refused while they still run a restaurant.</summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(ManagerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagerResponse>> SetStatus(
        Guid id,
        SetManagerActiveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _managerService.SetActiveAsync(id, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error) =>
        error == ManagerErrors.NotFound || error == ManagerErrors.RestaurantNotFound
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status409Conflict;

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
