using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Sites;
using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// A restaurant's own website, as its manager builds it.
///
/// No restaurant identifier is accepted anywhere: the record is resolved from the
/// signed-in account, so there is nothing here to tamper with.
///
/// Saving and publishing are separate, and that is the point of the whole feature. The
/// draft is written continuously while somebody types; the public copy only moves when
/// Publish is pressed.
/// </summary>
[ApiController]
[Route("api/site")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class SiteController : ControllerBase
{
    private readonly ISiteService _sites;

    /// <summary>Creates the controller.</summary>
    public SiteController(ISiteService sites)
    {
        _sites = sites;
    }

    /// <summary>The draft, created empty the first time it is asked for.</summary>
    /// <param name="cancellationToken">Cancellation token.</param>
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

        var result = await _sites.GetForManagerAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Replaces the draft.
    ///
    /// Called as the manager works, so it is a whole-record write rather than a patch:
    /// the editor holds the page in front of it and knows the truth, and a merge on
    /// this side would be a second opinion about what the page currently says.
    /// </summary>
    /// <param name="request">The design and the whole content record.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPut]
    [ProducesResponseType(typeof(SiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SiteResponse>> SaveDraft(
        SaveSiteDraftRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _sites.SaveDraftAsync(managerId.Value, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Publishes the draft as it stands, or takes the page down.</summary>
    /// <param name="request">Which way.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPut("published")]
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

        var result = await _sites.SetPublishedAsync(managerId.Value, request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error) =>
        error == SiteErrors.NoRestaurantAssigned || error == SiteErrors.NotFound
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

/// <summary>
/// What a visitor is served at a restaurant's address.
///
/// Open to everybody, because everybody is who it is for. It answers with the published
/// copy and nothing else — no draft, no dates, no indication that a newer version
/// exists — and an unpublished or suspended restaurant is a not-found rather than a
/// page with a notice on it.
/// </summary>
[ApiController]
[Route("api/public/sites")]
[AllowAnonymous]
public sealed class PublicSiteController : ControllerBase
{
    private readonly ISiteService _sites;

    /// <summary>Creates the controller.</summary>
    public PublicSiteController(ISiteService sites)
    {
        _sites = sites;
    }

    /// <summary>The published page at this slug.</summary>
    /// <param name="slug">The restaurant's address.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(PublicSiteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicSiteResponse>> Get(
        string slug,
        CancellationToken cancellationToken)
    {
        var result = await _sites.GetPublishedAsync(slug, cancellationToken);

        return result.IsFailure ? NotFound() : Ok(result.Value);
    }
}
