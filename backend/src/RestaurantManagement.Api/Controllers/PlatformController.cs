using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Application.Platform.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// What a platform administrator can see and configure across the whole estate.
///
/// Super Admin only, and the only surface in the product that is not scoped to one
/// restaurant. That is not an exception to the isolation rule so much as the other side
/// of it: every restaurant belongs to exactly one manager, and somebody has to be able to
/// create them, hand them out, and fix one that was set up wrong.
///
/// Nothing here reaches into a restaurant operations. There is no route to raise an
/// order, settle a bill, move stock or take a booking, because a platform administrator
/// who could quietly alter a restaurant takings would make every figure in the product
/// unaccountable.
/// </summary>
[ApiController]
[Route("api/platform")]
[Authorize(Roles = PlatformRoles.SuperAdmin)]
public sealed class PlatformController : ControllerBase
{
    private readonly IPlatformService _platformService;

    /// <summary>Creates the controller.</summary>
    public PlatformController(IPlatformService platformService)
    {
        _platformService = platformService;
    }

    /// <summary>
    /// What every restaurant took over a range of days.
    /// </summary>
    /// <param name="from">
    /// First day to include. Read in each restaurant own calendar, so the platform total
    /// is the sum of exactly what each manager sees. Null means the same day as
    /// <paramref name="to"/>, or today when that is null too.
    /// </param>
    /// <param name="to">Last day to include, inclusive. Null means today.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("reports")]
    [ProducesResponseType(typeof(PlatformReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PlatformReportResponse>> GetReport(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetReportAsync(from, to, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    /// <summary>
    /// One restaurant, whole: its settings, its people, its trading and its floor.
    /// </summary>
    [HttpGet("restaurants/{id:guid}")]
    [ProducesResponseType(typeof(PlatformRestaurantDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PlatformRestaurantDetailResponse>> GetRestaurant(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetRestaurantAsync(id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// The most recent things platform administrators have done, newest first.
    /// </summary>
    [HttpGet("activity")]
    [ProducesResponseType(typeof(IReadOnlyList<PlatformActivityResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<PlatformActivityResponse>>> GetActivity(
        [FromQuery] int limit,
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetActivityAsync(
            limit <= 0 ? 50 : limit,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    /// <summary>The platform-wide defaults a new restaurant inherits.</summary>
    [HttpGet("settings")]
    [ProducesResponseType(typeof(PlatformSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PlatformSettingsResponse>> GetSettings(
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetSettingsAsync(cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    /// <summary>Changes the platform-wide defaults.</summary>
    [HttpPut("settings")]
    [ProducesResponseType(typeof(PlatformSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PlatformSettingsResponse>> UpdateSettings(
        UpdatePlatformSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _platformService.UpdateSettingsAsync(request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    /// <summary>
    /// Whether the deployment itself is healthy.
    /// </summary>
    [HttpGet("system")]
    [ProducesResponseType(typeof(PlatformSystemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PlatformSystemResponse>> GetSystem(
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetSystemAsync(cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    /// <summary>
    /// What the estate is doing right now, and what it did today against yesterday.
    /// </summary>
    [HttpGet("pulse")]
    [ProducesResponseType(typeof(PlatformPulseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PlatformPulseResponse>> GetPulse(
        CancellationToken cancellationToken)
    {
        var result = await _platformService.GetPulseAsync(cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status400BadRequest)
            : Ok(result.Value);
    }

    private static int StatusFor(Error error) =>
        error == PlatformErrors.RestaurantNotFound
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status400BadRequest;

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
