using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The pass: food the kitchen has finished, and the record of it being carried out.
///
/// Its own controller rather than three actions on the waiter one, and the reason is a
/// rule about how authorisation stacks rather than a matter of taste. An Authorize
/// attribute on an action does not replace the one on its controller - both are
/// evaluated and both have to pass. WaiterController is gated on the Waiter policy,
/// which is a staff role plus a claim, so a manager failed it before the wider policy
/// on the action was ever considered. These endpoints answered 403 with no message at
/// all, because the refusal came from the pipeline rather than from anything that had
/// run.
///
/// Carrying a cooked plate raises none of the questions taking an order does - nobody
/// is deciding who placed what - so the pass is deliberately wider than the rest of
/// the floor: a manager standing next to food going cold can pick it up.
///
/// The route prefix is unchanged, so every path a client already calls still works.
/// </summary>
[ApiController]
[Route("api/waiter")]
[Authorize(Policy = AuthorizationPolicies.Serves)]
public sealed class PassController : ControllerBase
{
    private readonly IOrderService _orderService;

    /// <summary>Creates the controller.</summary>
    public PassController(IOrderService orderService) => _orderService = orderService;

    /// <summary>
    /// Food cooked and waiting for somebody to carry it to a table.
    /// </summary>
    /// <remarks>
    /// The floor's half of the kitchen rail, and what makes the "your food is ready"
    /// alert survive a locked phone: the notification is a courtesy, this is the record.
    /// Restaurant-wide, because a plate going cold while its waiter is busy elsewhere is
    /// the problem rather than the solution.
    /// </remarks>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("pass")]
    // Wider than the rest of this controller on purpose. Taking an order stays a
    // waiter's job so that "who placed this" cannot become ambiguous; carrying a
    // cooked plate to a table raises no such question, and a manager standing next to
    // a pass full of food going cold should be able to pick it up.
    [Authorize(Policy = AuthorizationPolicies.Serves)]
    [ProducesResponseType(typeof(IReadOnlyList<PassTicketResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<PassTicketResponse>>> GetPass(
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetPassAsync(staffId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Records that one dish off a cooked ticket has been carried to the table.
    /// </summary>
    /// <remarks>
    /// A table's momo and samosa are on one slip and cooked fifteen minutes apart. The
    /// ticket counts as served on its own once nothing is left at the pass.
    /// </remarks>
    /// <param name="id">The kitchen ticket.</param>
    /// <param name="itemId">The dish on it.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("pass/{id:guid}/items/{itemId:guid}/served")]
    [Authorize(Policy = AuthorizationPolicies.Serves)]
    [ProducesResponseType(typeof(PassTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PassTicketResponse>> MarkItemServed(
        Guid id,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.MarkTicketItemServedAsync(
            staffId.Value,
            id,
            itemId,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Records that this waiter took every remaining dish on a ticket to the table.
    /// </summary>
    /// <remarks>
    /// The shorthand for clearing a whole slip at once, when everything on it is
    /// cooked and going to the same table in one trip.
    ///
    /// Does not move the ticket's status - that belongs to the kitchen, and Ready is
    /// still true. A ticket somebody else already carried answers as success rather
    /// than as an error: two waiters reaching the same pass is an ordinary service, and
    /// the second one wanted the plate delivered, which it is.
    /// </remarks>
    /// <param name="id">The kitchen ticket.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("pass/{id:guid}/served")]
    [Authorize(Policy = AuthorizationPolicies.Serves)]
    [ProducesResponseType(typeof(PassTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PassTicketResponse>> MarkServed(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.MarkTicketServedAsync(
            staffId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }
    /// <summary>
    /// Which status a failure deserves.
    ///
    /// The same mapping the waiter endpoints use, repeated rather than shared through a
    /// base class: two small controllers agreeing on four error codes reads more plainly
    /// than an inheritance chain for it.
    /// </summary>
    private static int StatusFor(Error error)
    {
        if (error == OrderErrors.NotAnActiveWaiter || error == OrderErrors.NotOnTheFloor)
        {
            return StatusCodes.Status403Forbidden;
        }

        if (error == OrderErrors.NotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // A plate somebody else already carried, or a ticket the kitchen pulled back,
        // is a conflict with the state of the restaurant rather than a bad request.
        return StatusCodes.Status409Conflict;
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
