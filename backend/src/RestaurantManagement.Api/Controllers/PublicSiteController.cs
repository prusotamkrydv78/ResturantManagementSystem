using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Application.Sites;
using RestaurantManagement.Application.Sites.Dtos;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Restaurant websites, as a visitor reads them.
///
/// Anonymous, like the guest ordering endpoints. Nothing here takes an identifier
/// that means anything to the platform: a page is addressed by the restaurant's
/// slug, and an image by an identifier nothing enumerates.
/// </summary>
[ApiController]
[Route("api/public")]
public sealed class PublicSiteController : ControllerBase
{
    private readonly ISiteService _siteService;

    /// <summary>Creates the controller.</summary>
    public PublicSiteController(ISiteService siteService)
    {
        _siteService = siteService;
    }

    /// <summary>
    /// The published page for a restaurant.
    ///
    /// An unknown slug, an unpublished page and a suspended restaurant are all the
    /// same 404, so nothing here reveals which of the three it was.
    /// </summary>
    [HttpGet("sites/{slug}")]
    [ProducesResponseType(typeof(PublicSiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicSiteResponse>> GetSite(
        string slug,
        CancellationToken cancellationToken)
    {
        var result = await _siteService.GetPublishedAsync(slug, cancellationToken);

        if (result.IsFailure)
        {
            return Problem(
                detail: result.Error!.Message,
                statusCode: StatusCodes.Status404NotFound,
                title: "Not found",
                type: null,
                instance: Request.Path);
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// The bytes of one uploaded image.
    ///
    /// Cached hard and immutably, which is safe because the bytes behind an
    /// identifier never change: replacing a picture creates a new row with a new
    /// identifier, and this one is either there or deleted. Without this every
    /// visitor would pull every photograph out of a remote database on every view.
    /// </summary>
    [HttpGet("site-images/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _siteService.GetImageBytesAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound();
        }

        var (content, contentType) = result.Value;

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return File(content, contentType);
    }
}
