using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Media;
using RestaurantManagement.Application.Media.Dtos;
using RestaurantManagement.Domain.Media;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// A restaurant's picture library.
///
/// Managing it is the manager's, and reading a picture is everybody's. That split runs
/// through this whole controller: the class is closed, and exactly one action opens
/// itself, because the pictures here are drawn on a public page by people who have no
/// account and whose browser could not send a token if they did.
///
/// No restaurant identifier is accepted anywhere. Every managing action resolves the
/// restaurant from the signed-in account, so there is nothing to tamper with.
/// </summary>
[ApiController]
[Route("api/media")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class MediaController : ControllerBase
{
    private readonly IMediaService _media;

    /// <summary>Creates the controller.</summary>
    public MediaController(IMediaService media)
    {
        _media = media;
    }

    /// <summary>Everything this restaurant holds, newest first, with what is left.</summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet]
    [ProducesResponseType(typeof(MediaLibraryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaLibraryResponse>> GetLibrary(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _media.GetLibraryAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Adds a picture to the library.
    ///
    /// The size limit is on the action as well as in the service, so an oversized body
    /// is rejected by the framework before it is buffered rather than after.
    /// </summary>
    /// <param name="file">The picture.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost]
    [RequestSizeLimit(RestaurantMedia.MaxBytes + 8192)]
    [ProducesResponseType(typeof(MediaResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaResponse>> Add(
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
            return ProblemFrom(MediaErrors.Empty, StatusCodes.Status400BadRequest);
        }

        await using var stream = file.OpenReadStream();

        var result = await _media.AddAsync(
            managerId.Value,
            file.FileName,
            file.ContentType ?? string.Empty,
            stream,
            file.Length,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Created(result.Value!.Url, result.Value);
    }

    /// <summary>
    /// Removes a picture permanently.
    ///
    /// Nothing checks whether it is still in use, and nothing can: a page stores the
    /// address of a picture, not a reference to it, and the service has no idea what a
    /// page is made of. The editor is where that warning belongs.
    /// </summary>
    /// <param name="id">Which picture.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Remove(Guid id, CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _media.RemoveAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : NoContent();
    }

    /// <summary>
    /// The picture itself.
    ///
    /// Open, unlike everything else on this controller, and by necessity rather than
    /// convenience: these are drawn on a restaurant's public page by strangers, and an
    /// image tag cannot send a token.
    ///
    /// Nothing about the picture beyond its bytes is reachable here — not which
    /// restaurant owns it, not what it is called, not when it arrived. Cached for a
    /// year, which is safe because a row is never rewritten: replacing a picture means
    /// uploading a new one, which has a new identifier and therefore a new address.
    /// </summary>
    /// <param name="id">Which picture.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBytes(Guid id, CancellationToken cancellationToken)
    {
        var result = await _media.GetBytesAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound();
        }

        var (content, contentType) = result.Value;

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return File(content, contentType);
    }

    /// <summary>
    /// Which code a failure gets.
    ///
    /// A missing picture or a missing restaurant is a 404; everything else here is the
    /// caller having sent something the library will not take.
    /// </summary>
    private static int StatusFor(Error error) =>
        error == MediaErrors.NotFound || error == MediaErrors.NoRestaurantAssigned
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
