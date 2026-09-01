using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
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
    /// Places an order on the table the customer said they were sitting at.
    /// </summary>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="request">The table, and what they want.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{slug}/orders")]
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

        return error == PublicOrderingErrors.TableInUse ||
            error == PublicOrderingErrors.StaffServing
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
