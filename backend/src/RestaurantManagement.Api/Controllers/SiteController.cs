using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Sites;
using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Domain.Sites;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The restaurant's public one-page website, as its manager edits it.
///
/// Restaurant Manager only. No action accepts a restaurant identifier: the
/// restaurant comes from the access token, so a manager can only ever edit their
/// own page.
/// </summary>
[ApiController]
[Route("api/site")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class SiteController : ControllerBase
{
    private readonly ISiteService _siteService;

    /// <summary>Creates the controller.</summary>
    public SiteController(ISiteService siteService)
    {
        _siteService = siteService;
    }

    /// <summary>
    /// The caller's page. Creates an empty, unpublished one the first time.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SiteResponse>> Get(CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _siteService.GetForManagerAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// The designs on offer.
    ///
    /// Served from the API rather than hardcoded in the client so the picker and the
    /// values the server will accept come from one place.
    /// </summary>
    [HttpGet("templates")]
    [ProducesResponseType(typeof(IReadOnlyList<SiteTemplateResponse>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<SiteTemplateResponse>> GetTemplates() =>
        Ok(new SiteTemplateResponse[]
        {
            new(
                SiteTemplate.Aurora,
                "Aurora",
                "Warm and photographic. A full-bleed hero, generous spacing. The safe choice when you have good pictures."),
            new(
                SiteTemplate.Slate,
                "Slate",
                "Dark and editorial. Type-led and restrained, for a place that wants to look expensive."),
            new(
                SiteTemplate.Terrace,
                "Terrace",
                "Rustic and split. Alternating text and image bands on a paper ground, for somewhere with a story."),
            new(
                SiteTemplate.Lantern,
                "Lantern",
                "Bright and blocky. Strong colour and big numerals, for cafes and street food."),
            new(
                SiteTemplate.Press,
                "Press",
                "Classical and centred. Ruled borders and small caps, like a printed menu."),
        });

    /// <summary>Saves the content and the chosen design.</summary>
    [HttpPut]
    [ProducesResponseType(typeof(SiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SiteResponse>> Save(
        SaveSiteRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _siteService.SaveAsync(managerId.Value, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusForSave(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Publishes the page, or takes it back down.</summary>
    [HttpPut("status")]
    [ProducesResponseType(typeof(SiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SiteResponse>> SetPublished(
        SetSitePublishedRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _siteService.SetPublishedAsync(
            managerId.Value,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>The images the caller has uploaded.</summary>
    [HttpGet("images")]
    [ProducesResponseType(typeof(IReadOnlyList<SiteImageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<SiteImageResponse>>> GetImages(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _siteService.GetImagesAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Uploads one image and returns the URL to reference it by.
    ///
    /// The request size is capped at the action as well as in the service, so an
    /// oversized body is rejected by the framework before it is buffered rather than
    /// after.
    /// </summary>
    [HttpPost("images")]
    [RequestSizeLimit(SiteImageLimits.MaxBytes + 8192)]
    [ProducesResponseType(typeof(SiteImageResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SiteImageResponse>> UploadImage(
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
            return ProblemFrom(SiteErrors.ImageEmpty, StatusCodes.Status400BadRequest);
        }

        await using var stream = file.OpenReadStream();

        var result = await _siteService.AddImageAsync(
            managerId.Value,
            file.FileName,
            file.ContentType ?? string.Empty,
            stream,
            file.Length,
            cancellationToken);

        if (result.IsFailure)
        {
            var error = result.Error!;

            return ProblemFrom(
                error,
                error == SiteErrors.ImageLimitReached
                    ? StatusCodes.Status409Conflict
                    : StatusCodes.Status400BadRequest);
        }

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    /// <summary>Deletes one of the caller's images.</summary>
    [HttpDelete("images/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteImage(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _siteService.DeleteImageAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : NoContent();
    }

    /// <summary>
    /// Bad content is the caller's mistake and gets a 400; anything else means the
    /// restaurant could not be resolved.
    /// </summary>
    private static int StatusForSave(Error error) =>
        error == SiteErrors.NoRestaurantAssigned
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
