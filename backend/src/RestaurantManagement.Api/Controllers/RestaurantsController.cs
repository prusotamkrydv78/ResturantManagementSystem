using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Restaurants;
using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Application.Staff;
using RestaurantManagement.Application.Staff.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Restaurant endpoints.
///
/// Every action is gated by platform role at the boundary. The administrative
/// actions are Super Admin only; the manager action derives its restaurant from the
/// access token and accepts no identifier, so ownership cannot be manipulated by
/// changing a value in the request.
/// </summary>
[ApiController]
[Route("api/restaurants")]
public sealed class RestaurantsController : ControllerBase
{
    private readonly IRestaurantService _restaurantService;
    private readonly IStaffService _staffService;

    /// <summary>Creates the controller.</summary>
    public RestaurantsController(
        IRestaurantService restaurantService,
        IStaffService staffService)
    {
        _restaurantService = restaurantService;
        _staffService = staffService;
    }

    /// <summary>Creates a restaurant. No manager is assigned yet.</summary>
    [HttpPost]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(typeof(RestaurantResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RestaurantResponse>> Create(
        CreateRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.CreateAsync(request, cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusCodes.Status409Conflict);
        }

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value.Id },
            result.Value);
    }

    /// <summary>Lists every restaurant on the platform.</summary>
    [HttpGet]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(typeof(IReadOnlyList<RestaurantSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<RestaurantSummaryResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.GetAllAsync(cancellationToken);

        return Ok(result.Value);
    }

    /// <summary>Loads one restaurant with its assigned manager.</summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(typeof(RestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RestaurantResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.GetByIdAsync(id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Lists the staff of one restaurant. Super Admin only, and read-only.
    ///
    /// The platform owner can see who works where without being able to change a
    /// roster: hiring and suspending stay with the manager who works with these
    /// people. The same projection the manager sees, so there is one answer to the
    /// question rather than two that can disagree.
    /// </summary>
    [HttpGet("{id:guid}/staff")]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(typeof(IReadOnlyList<StaffResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<StaffResponse>>> GetStaff(
        Guid id,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var result = await _staffService.GetForRestaurantAsync(id, search, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Edits any restaurant. Super Admin only, and the only route that can change a
    /// slug.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(typeof(RestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RestaurantResponse>> Update(
        Guid id,
        UpdateRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.UpdateAsync(id, request, cancellationToken);

        if (result.IsFailure)
        {
            var error = result.Error!;

            return ProblemFrom(
                error,
                error == RestaurantErrors.NotFound
                    ? StatusCodes.Status404NotFound
                    : StatusCodes.Status409Conflict);
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Deletes a restaurant that was created by mistake. Super Admin only.
    ///
    /// Refused once it has orders, and refused while it still holds tables, staff,
    /// stock, customers or bookings.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = PlatformRoles.SuperAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.DeleteAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            var error = result.Error!;

            return ProblemFrom(
                error,
                error == RestaurantErrors.NotFound
                    ? StatusCodes.Status404NotFound
                    : StatusCodes.Status409Conflict);
        }

        return NoContent();
    }

    /// <summary>
    /// Returns the restaurant managed by the caller. Takes no identifier: the
    /// restaurant is resolved from the access token.
    /// </summary>
    [HttpGet("mine")]
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [ProducesResponseType(typeof(RestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RestaurantResponse>> GetMine(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _restaurantService.GetForManagerAsync(userId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Updates the basic details of the restaurant managed by the caller.
    ///
    /// Takes no identifier: the record is resolved from the access token, and the
    /// payload has no field for ownership or the slug, so neither can be changed
    /// from here.
    /// </summary>
    [HttpPut("mine")]
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [ProducesResponseType(typeof(RestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RestaurantResponse>> UpdateMine(
        UpdateMyRestaurantRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _restaurantService.UpdateForManagerAsync(
            userId.Value,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// How the caller restaurant is configured to operate.
    ///
    /// Separate from the profile above because the two are different things: one is
    /// what a guest would recognise, this is what the system computes with.
    /// </summary>
    [HttpGet("mine/settings")]
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [ProducesResponseType(typeof(RestaurantSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RestaurantSettingsResponse>> GetMySettings(
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _restaurantService.GetSettingsAsync(
            userId.Value,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Changes how the caller restaurant operates.
    ///
    /// Takes no identifier, and an unrecognised timezone is refused rather than
    /// stored: a zone nothing knows would be accepted once and then quietly ignored
    /// by every day calculation afterwards.
    /// </summary>
    [HttpPut("mine/settings")]
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [ProducesResponseType(typeof(RestaurantSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RestaurantSettingsResponse>> UpdateMySettings(
        UpdateRestaurantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _restaurantService.UpdateSettingsAsync(
            userId.Value,
            request,
            cancellationToken);

        if (result.IsFailure)
        {
            // An unknown zone is a bad value in the request; anything else here means
            // the caller has no restaurant to configure.
            var status = result.Error == RestaurantErrors.UnknownTimeZone
                ? StatusCodes.Status400BadRequest
                : StatusCodes.Status404NotFound;

            return ProblemFrom(result.Error!, status);
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// The timezones this server can be configured with, offset first.
    ///
    /// Served so the settings screen offers exactly what the validation accepts.
    /// </summary>
    [HttpGet("timezones")]
    [Authorize(Roles = PlatformRoles.SuperAdminOrManager)]
    [ProducesResponseType(
        typeof(IReadOnlyList<TimeZoneOptionResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<TimeZoneOptionResponse>>> GetTimeZones(
        CancellationToken cancellationToken)
    {
        var result = await _restaurantService.GetTimeZonesAsync(cancellationToken);

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
