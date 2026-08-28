using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Tables;
using RestaurantManagement.Application.Tables.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Table administration for a restaurant manager.
///
/// Restaurant Manager only. No action accepts a restaurant identifier: the
/// restaurant comes from the access token, so a manager can only ever reach their
/// own tables.
/// </summary>
[ApiController]
[Route("api/tables")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class TablesController : ControllerBase
{
    private readonly ITableService _tableService;

    /// <summary>Creates the controller.</summary>
    public TablesController(ITableService tableService)
    {
        _tableService = tableService;
    }

    /// <summary>Lists the tables of the caller restaurant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TableResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<TableResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.GetAllAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Loads one table.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.GetByIdAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Adds a table to the caller restaurant. The request has no restaurant field;
    /// it is decided by the server.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TableResponse>> Create(
        CreateTableRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.CreateAsync(managerId.Value, request, cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>Updates the name and capacity of a table.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TableResponse>> Update(
        Guid id,
        UpdateTableRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.UpdateAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Puts a table in or out of service. Nothing is deleted; an inactive table
    /// keeps its record.
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableResponse>> SetStatus(
        Guid id,
        SetTableActiveRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.SetActiveAsync(
            managerId.Value,
            id,
            request.IsActive,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Switches guest ordering on or off for one table.
    ///
    /// Separate from active status: a restaurant can have a code on the terrace and none in
    /// the private room without taking the private room out of service.
    /// </summary>
    [HttpPut("{id:guid}/ordering")]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableResponse>> SetOrdering(
        Guid id,
        SetTableOrderingRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.SetOrderingAsync(
            managerId.Value,
            id,
            request.IsOrderingEnabled,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Issues a new ordering token for a table, invalidating every code already printed
    /// for it.
    /// </summary>
    [HttpPost("{id:guid}/ordering/token")]
    [ProducesResponseType(typeof(TableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableResponse>> RegenerateOrderingToken(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _tableService.RegenerateOrderingTokenAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    private static int StatusFor(Error error) =>
        error == TableErrors.NotFound || error == TableErrors.NoRestaurantAssigned
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
