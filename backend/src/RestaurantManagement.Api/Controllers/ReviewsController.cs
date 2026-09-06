using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Reviews;
using RestaurantManagement.Application.Reviews.Dtos;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// What tables thought of their visit, as the restaurant reads them.
///
/// Manager only. A waiter can see a table's order and take its money; how the restaurant
/// is being scored is a different question, and one a manager acts on rather than the
/// person being scored.
/// </summary>
[ApiController]
[Route("api/reviews")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviews;

    /// <summary>Creates the controller.</summary>
    public ReviewsController(IReviewService reviews)
    {
        _reviews = reviews;
    }

    /// <summary>
    /// The reviews this restaurant has received, newest first, with their averages.
    /// </summary>
    /// <param name="limit">How many to return. Clamped by the service.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet]
    [ProducesResponseType(typeof(ReviewSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ReviewSummaryResponse>> Get(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _reviews.GetForRestaurantAsync(
            managerId.Value,
            limit,
            cancellationToken);

        return result.IsFailure
            ? Problem(
                detail: result.Error!.Message,
                statusCode: StatusCodes.Status403Forbidden,
                title: "Request failed",
                type: null,
                instance: Request.Path)
            : Ok(result.Value);
    }
}
