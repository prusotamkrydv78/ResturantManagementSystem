using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Ordering from the code printed on a table.
///
/// The only unauthenticated surface in this product apart from signing in, which is why it
/// is deliberately narrow. Two actions, one route parameter, and no way to name a
/// restaurant, a table, an order, a customer or a member of staff: the token in the link is
/// the entire input, so there is nothing here for a caller to substitute.
///
/// <see cref="AllowAnonymousAttribute"/> is on the controller rather than assumed, because
/// no guest has an account. Nothing else about authentication or authorisation changes:
/// every other route in the application still requires a token and a role, and these two
/// reach nothing those routes protect.
/// </summary>
[ApiController]
[Route("api/public/tables")]
[AllowAnonymous]
public sealed class PublicOrderingController : ControllerBase
{
    private readonly IPublicOrderingService _publicOrdering;

    /// <summary>Creates the controller.</summary>
    public PublicOrderingController(IPublicOrderingService publicOrdering)
    {
        _publicOrdering = publicOrdering;
    }

    /// <summary>
    /// What a guest sees when they scan: where they are, what they can order, and their own
    /// order so far.
    /// </summary>
    /// <param name="token">The opaque token from the link. The only input.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{token}")]
    [ProducesResponseType(typeof(PublicTableResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicTableResponse>> GetTable(
        string token,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.GetTableAsync(token, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Places what the guest asked for, adding to their existing order at this table when
    /// they already have one.
    /// </summary>
    /// <param name="token">The opaque token from the link.</param>
    /// <param name="request">What they want.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("{token}/orders")]
    [ProducesResponseType(typeof(PublicOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PublicOrderResponse>> PlaceOrder(
        string token,
        PlacePublicOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.PlaceOrderAsync(
            token,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Which code a failure gets.
    ///
    /// A link that does not resolve is 404 for every reason it might not, which is what
    /// keeps a malformed token, an unknown one, a withdrawn table and a switched-off one
    /// indistinguishable from outside. Everything else is a conflict with what is happening
    /// at the table.
    /// </summary>
    private static int StatusFor(Error error) =>
        error == PublicOrderingErrors.NotFound
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status409Conflict;

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
