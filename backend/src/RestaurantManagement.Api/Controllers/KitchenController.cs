using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Kitchen;
using RestaurantManagement.Application.Kitchen.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The chef kitchen workflow.
///
/// Its own controller rather than more routes on the waiter one: the two jobs share
/// the ticket and nothing else. A waiter decides what the kitchen is asked to cook
/// and never touches the cooking; a chef moves tickets through the kitchen and never
/// changes what was ordered. Keeping them apart means the Chef policy guards this
/// whole surface, with no per-action exceptions to get wrong.
///
/// Nothing here accepts a restaurant identifier: the restaurant comes from the
/// authenticated chef.
/// </summary>
[ApiController]
[Route("api/kitchen")]
[Authorize(Policy = AuthorizationPolicies.Chef)]
public sealed class KitchenController : ControllerBase
{
    private readonly IKitchenService _kitchenService;

    /// <summary>Creates the controller.</summary>
    public KitchenController(IKitchenService kitchenService)
    {
        _kitchenService = kitchenService;
    }

    /// <summary>
    /// The kitchen queue: tickets being cooked first, then tickets waiting, oldest
    /// first within each group.
    ///
    /// Ready tickets are left out by default, since they are finished work. Asking
    /// for a status explicitly returns just that status.
    /// </summary>
    [HttpGet("tickets")]
    [ProducesResponseType(
        typeof(IReadOnlyList<KitchenTicketResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<KitchenTicketResponse>>> GetTickets(
        [FromQuery] KitchenTicketStatus? status,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _kitchenService.GetQueueAsync(
            staffId.Value,
            status,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>Loads one ticket from the caller restaurant.</summary>
    [HttpGet("tickets/{id:guid}")]
    [ProducesResponseType(typeof(KitchenTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KitchenTicketResponse>> GetTicket(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _kitchenService.GetByIdAsync(
            staffId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Starts cooking a waiting ticket. Refused when someone else already has it.
    /// </summary>
    [HttpPut("tickets/{id:guid}/start")]
    [ProducesResponseType(typeof(KitchenTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<KitchenTicketResponse>> StartTicket(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _kitchenService.StartAsync(
            staffId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Sends a ticket being cooked to the pass. This is a kitchen state only: the
    /// order stays open and nothing is marked served.
    /// </summary>
    [HttpPut("tickets/{id:guid}/ready")]
    [ProducesResponseType(typeof(KitchenTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<KitchenTicketResponse>> MarkTicketReady(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _kitchenService.MarkReadyAsync(
            staffId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error)
    {
        if (error == KitchenErrors.NotAnActiveChef)
        {
            return StatusCodes.Status403Forbidden;
        }

        if (error == KitchenErrors.NotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // A ticket someone else already moved is a conflict with the current state of
        // the kitchen, not a malformed request.
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
