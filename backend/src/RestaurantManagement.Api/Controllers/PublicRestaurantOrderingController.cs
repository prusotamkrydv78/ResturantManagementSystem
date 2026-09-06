using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RestaurantManagement.Api.RateLimiting;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
using RestaurantManagement.Application.Reviews;
using RestaurantManagement.Application.Reviews.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Ordering from a restaurant's own website.
///
/// The second unauthenticated way into ordering, beside the code printed on a table.
/// The difference is how the table is decided: a scanned code says where the guest is,
/// and somebody reading a website has to be asked, so these two routes are keyed by
/// the restaurant's public slug and the order request names a table.
///
/// That table identifier is the only new thing an anonymous caller can put in a body
/// here, and it is checked against the restaurant rather than trusted: it has to
/// belong to this slug, be in service, be open to guest ordering, and have nothing
/// running on it. Everything after that - the pricing, the caps, the availability
/// re-check - is the same code the scanned path uses.
///
/// Still nothing here names an order, a customer, a member of staff or a price.
/// </summary>
[ApiController]
[Route("api/public/restaurants")]
[AllowAnonymous]
public sealed class PublicRestaurantOrderingController : ControllerBase
{
    private readonly IPublicOrderingService _publicOrdering;

    /// <summary>Creates the controller.</summary>
    public PublicRestaurantOrderingController(IPublicOrderingService publicOrdering)
    {
        _publicOrdering = publicOrdering;
    }

    /// <summary>
    /// The real menu for a restaurant, and the tables a customer may say they are at.
    /// </summary>
    /// <param name="slug">The restaurant's public slug, from its own web address.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{slug}/menu")]
    [EnableRateLimiting(PublicRateLimiting.PublicRead)]
    [ProducesResponseType(typeof(PublicRestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicRestaurantResponse>> GetMenu(
        string slug,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.GetRestaurantAsync(slug, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Places an order on the table the customer said they were sitting at, or adds to
    /// one they already have there.
    /// </summary>
    /// <remarks>
    /// One route for both, because to a customer they are the same act. Which happens is
    /// decided by whether the body carries the key from an order they already have - the
    /// only thing that can tell the person who started that order from a stranger
    /// claiming the table.
    ///
    /// There is deliberately no route for a customer to remove a line or call an order
    /// off. Adding is safe on its own: nothing agreed is withdrawn and nothing being
    /// cooked is affected. Anything else is a conversation with a waiter, who can see
    /// the whole table and what the kitchen has already started.
    /// </remarks>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="request">The table, and what they want.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/orders")]
    [EnableRateLimiting(PublicRateLimiting.PublicWrite)]
    [ProducesResponseType(typeof(PublicOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PublicOrderResponse>> PlaceOrder(
        string slug,
        PlaceWebsiteOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.PlaceWebsiteOrderAsync(
            slug,
            request,
            // Taken from the connection rather than from a header. A forwarded-for
            // header is written by the caller and can say anything, which is worthless
            // in an audit trail; this is the address the socket actually came from.
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Asks a waiter to bring the bill to the table.
    /// </summary>
    /// <remarks>
    /// The one thing a customer could not do from their phone, and the part of a meal
    /// that goes wrong most often - catching somebody’s eye at the end, once the table
    /// has already decided to leave.
    ///
    /// Recorded on the order as well as announced to the floor, so a waiter who was
    /// carrying plates when it happened still finds the table waiting.
    ///
    /// Asking twice is not an error and keeps the original time: a guest tapping again
    /// is being ignored, not making a mistake, and restarting the clock would hide the
    /// table that has waited longest.
    /// </remarks>
    /// <param name="slug">The restaurant’s public slug.</param>
    /// <param name="request">The key they hold.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/orders/bill-request")]
    [EnableRateLimiting(PublicRateLimiting.PublicWrite)]
    [ProducesResponseType(typeof(PublicOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicOrderResponse>> RequestBill(
        string slug,
        RequestBillRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.RequestBillAsync(
            slug,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Records what a customer thought of their visit.
    /// </summary>
    /// <remarks>
    /// Offered once the bill has been settled, which is the moment a visit becomes a
    /// thing that can be described rather than one still happening.
    ///
    /// Authorised by the key from their own order, like everything else on this side.
    /// That is what makes a review here evidence of a meal rather than an opinion from
    /// nowhere, without asking a guest to sign in or hand over a name - and it is why
    /// there is no moderation queue behind it.
    ///
    /// One per visit. A second submission is somebody changing their mind, and it is
    /// refused rather than quietly replacing the first.
    /// </remarks>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="request">Their key, their scores, and anything they wrote.</param>
    /// <param name="reviews">
    /// Resolved per action rather than injected into the controller, because this is the
    /// one route here that is not about ordering and the class should not carry a
    /// dependency five other actions never touch.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/reviews")]
    [EnableRateLimiting(PublicRateLimiting.PublicWrite)]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReviewResponse>> SubmitReview(
        string slug,
        SubmitReviewRequest request,
        [FromServices] IReviewService reviews,
        CancellationToken cancellationToken)
    {
        var result = await reviews.SubmitAsync(slug, request, cancellationToken);

        if (!result.IsFailure)
        {
            return Ok(result.Value);
        }

        // A key that names nothing is a 404; everything else here is a conflict with
        // the state of the visit - too early, called off, or already reviewed - all of
        // which were well formed requests that would have worked at another moment.
        var status = result.Error! == ReviewErrors.OrderNotFound
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status409Conflict;

        return ProblemFrom(result.Error!, status);
    }

    /// <summary>
    /// Reads back an order from the key the customer holds.
    /// </summary>
    /// <remarks>
    /// How a guest who lost their place picks it up again, and how a page that has been
    /// closed for an hour catches up with what has happened since.
    ///
    /// A POST because the key travels in the body. It reads rather than writes, but a
    /// key in a path would end up in a server log and a browser history, and this one
    /// string is the whole claim that an order belongs to somebody.
    /// </remarks>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="request">The key they hold.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/orders/lookup")]
    [EnableRateLimiting(PublicRateLimiting.PublicRead)]
    [ProducesResponseType(typeof(PublicOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicOrderResponse>> LookupOrder(
        string slug,
        LookupWebsiteOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.LookupWebsiteOrderAsync(
            slug,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Which code a failure gets.
    ///
    /// A slug or a table that does not resolve is 404 for every reason it might not,
    /// which keeps a wrong slug, a withdrawn table, a table with ordering switched off
    /// and a table belonging to another restaurant indistinguishable from outside.
    /// A table somebody else is already ordering at is a conflict, because the request
    /// was well formed and the answer may differ in a minute.
    /// </summary>
    private static int StatusFor(Error error)
    {
        if (error == PublicOrderingErrors.NotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // An addition that came too late is a conflict for the same reason a busy table
        // is: the request was well formed, and it would have worked a minute ago. It is
        // the one failure here whose answer never changes back.
        return error == PublicOrderingErrors.TableInUse ||
            error == PublicOrderingErrors.StaffServing ||
            error == PublicOrderingErrors.CannotAddMore
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest;
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
