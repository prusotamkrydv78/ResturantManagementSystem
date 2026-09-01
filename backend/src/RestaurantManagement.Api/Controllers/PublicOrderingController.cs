using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.PublicOrdering.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The order pad behind the code printed on a table.
///
/// One printed code, two people. A member of staff who scans it gets the pad below: the
/// menu, and whatever is already running on that table. Anybody else has no session, so
/// they are turned away and sent to the restaurant own ordering page instead - which is
/// what <see cref="ResolveRestaurant"/> exists to make possible, and the only action here
/// that still answers without a session.
///
/// The token used to be the entire authorisation. It is now half of it: the caller has to
/// hold a session as well, and the table has to belong to the restaurant they work at.
/// A card from another restaurant is refused and told nothing about whether it was real.
/// </summary>
[ApiController]
[Route("api/public/tables")]
[Authorize(Roles = PlatformRoles.RestaurantManager + "," + PlatformRoles.Staff)]
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
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _publicOrdering.GetTableAsync(
            staffId.Value,
            token,
            cancellationToken);

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
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _publicOrdering.PlaceOrderAsync(
            staffId.Value,
            token,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Which restaurant a printed code belongs to.
    ///
    /// The one action here without a session, and the hinge the whole arrangement turns
    /// on: a customer scanning a table has no account, and the page they land on needs
    /// the restaurant slug before it can send them to the right ordering page.
    ///
    /// It gives away nothing that somebody holding the printed card does not already
    /// have. The slug is the restaurant public web address. Nothing about the table, the
    /// menu or anybody order is reachable through it.
    /// </summary>
    /// <param name="token">The opaque token from the link.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{token}/restaurant")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ScannedTableRestaurantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ScannedTableRestaurantResponse>> ResolveRestaurant(
        string token,
        CancellationToken cancellationToken)
    {
        var result = await _publicOrdering.ResolveScannedRestaurantAsync(
            token,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
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
