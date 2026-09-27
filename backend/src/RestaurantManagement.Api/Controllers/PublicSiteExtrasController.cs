using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RestaurantManagement.Api.RateLimiting;
using RestaurantManagement.Application.PublicSite;
using RestaurantManagement.Application.PublicSite.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// What a restaurant's website can do for a visitor beyond showing itself: ask for a
/// table, and read what guests have said.
///
/// Unauthenticated, rate limited, and keyed by the address the site answers on. A
/// booking is only ever a pending request; confirming it stays with the restaurant.
/// </summary>
[ApiController]
[Route("api/public/restaurants")]
[AllowAnonymous]
public sealed class PublicSiteExtrasController : ControllerBase
{
    private readonly IPublicSiteService _publicSite;

    /// <summary>Creates the controller.</summary>
    /// <param name="publicSite">The public website service.</param>
    public PublicSiteExtrasController(IPublicSiteService publicSite)
    {
        _publicSite = publicSite;
    }

    /// <summary>Asks the restaurant for a table. Recorded as a pending booking.</summary>
    /// <param name="slug">The restaurant's slug or subdomain.</param>
    /// <param name="request">Who, when and how many.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/reservations")]
    [EnableRateLimiting(PublicRateLimiting.PublicWrite)]
    [ProducesResponseType(typeof(PublicBookingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicBookingResponse>> RequestBooking(
        string slug,
        PublicBookingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _publicSite.RequestBookingAsync(slug, request, cancellationToken);

        if (result.IsSuccess)
        {
            return Ok(result.Value);
        }

        return result.Error == PublicSiteErrors.NotFound
            ? Problem(result.Error!, StatusCodes.Status404NotFound)
            : Problem(result.Error!, StatusCodes.Status400BadRequest);
    }

    /// <summary>The average score and the latest reviews that left a comment.</summary>
    /// <param name="slug">The restaurant's slug or subdomain.</param>
    /// <param name="limit">How many commented reviews to return, at most twenty.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{slug}/reviews")]
    [EnableRateLimiting(PublicRateLimiting.PublicRead)]
    [ProducesResponseType(typeof(PublicReviewsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicReviewsResponse>> GetReviews(
        string slug,
        [FromQuery] int limit = 6,
        CancellationToken cancellationToken = default)
    {
        var result = await _publicSite.GetReviewsAsync(slug, limit, cancellationToken);

        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error!, StatusCodes.Status404NotFound);
    }

    private ObjectResult Problem(Error error, int status) =>
        Problem(title: error.Message, statusCode: status, type: error.Code);
}
