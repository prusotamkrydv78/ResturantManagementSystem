using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Staff;
using RestaurantManagement.Application.Staff.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Staff administration for a restaurant manager.
///
/// Restaurant Manager only, so staff accounts and ordinary users cannot read or
/// change a roster. No action accepts a restaurant identifier: the restaurant comes
/// from the access token.
/// </summary>
[ApiController]
[Route("api/staff")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class StaffController : ControllerBase
{
    private readonly IStaffService _staffService;

    /// <summary>Creates the controller.</summary>
    public StaffController(IStaffService staffService)
    {
        _staffService = staffService;
    }

    /// <summary>Lists the staff of the caller restaurant.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<StaffResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<StaffResponse>>> GetAll(
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.GetAllAsync(managerId.Value, search, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Loads one staff member.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.GetByIdAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Creates a staff account in the caller restaurant. The request has no
    /// restaurant or platform role field; both are decided by the server.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StaffResponse>> Create(
        CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.CreateAsync(managerId.Value, request, cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>Updates the name, email and operational role of a staff member.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StaffResponse>> Update(
        Guid id,
        UpdateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.UpdateAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Activates or deactivates a staff account. Nothing is deleted; a deactivated
    /// account keeps its record and its restaurant association.
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffResponse>> SetStatus(
        Guid id,
        SetStaffActiveRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.SetActiveAsync(
            managerId.Value,
            id,
            request.IsActive,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Replaces a staff member password.
    ///
    /// The only way back in for somebody who has forgotten theirs. There is no
    /// self-service reset, and these accounts are issued rather than registered.
    /// </summary>
    [HttpPut("{id:guid}/password")]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffResponse>> ResetPassword(
        Guid id,
        ResetStaffPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.ResetPasswordAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Deletes a staff account added by mistake.
    ///
    /// Refused once the account has taken an order, recorded a payment or moved
    /// stock. Deactivate somebody who has actually worked and then left.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.DeleteAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : NoContent();
    }

    /* --------------------------------------------------------------------- Images */

    /// <summary>Puts a photograph on a staff account, replacing any it already had.</summary>
    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(StaffImage.MaxBytes + 8192)]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffResponse>> SetImage(
        Guid id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        if (file is null || file.Length == 0)
        {
            return ProblemFrom(StaffErrors.ImageEmpty, StatusCodes.Status400BadRequest);
        }

        await using var stream = file.OpenReadStream();

        var result = await _staffService.SetImageAsync(
            managerId.Value,
            id,
            file.FileName,
            file.ContentType ?? string.Empty,
            stream,
            file.Length,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, ImageStatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Takes the photograph off a staff account.</summary>
    [HttpDelete("{id:guid}/image")]
    [ProducesResponseType(typeof(StaffResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffResponse>> RemoveImage(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _staffService.RemoveImageAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, ImageStatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// The bytes of a staff photograph.
    ///
    /// Open, unlike everything else on this controller, because an image tag cannot
    /// send an access token and there is no other way for a browser to draw one.
    ///
    /// Worth being plain about: this is the most personal thing the product serves
    /// without a session, and the only thing standing in front of it is that the
    /// account identifier is handed out to nobody but the manager who runs that
    /// roster. Nothing else about the person - their name, their email, their shifts -
    /// is reachable here, and that is deliberate.
    /// </summary>
    [HttpGet("{id:guid}/image")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid id, CancellationToken cancellationToken)
    {
        var result = await _staffService.GetImageBytesAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound();
        }

        var (content, contentType) = result.Value;

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return File(content, contentType);
    }

    /// <summary>
    /// Which code an image failure gets. A missing picture or person is a 404; a file
    /// too big or of the wrong kind is the caller sending something wrong.
    /// </summary>
    private static int ImageStatusFor(Error error) =>
        error == StaffErrors.NotFound ||
        error == StaffErrors.ImageNotFound ||
        error == StaffErrors.NoRestaurantAssigned
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status400BadRequest;

    private static int StatusFor(Error error) =>
        error == StaffErrors.NotFound || error == StaffErrors.NoRestaurantAssigned
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
