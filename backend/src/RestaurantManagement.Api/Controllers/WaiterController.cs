using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Floor;
using RestaurantManagement.Application.Floor.Dtos;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The waiter ordering workflow.
///
/// Gated by the Waiter policy, so a chef, a restaurant manager and a
/// platform admin are all refused. Nothing here accepts a restaurant identifier:
/// the restaurant comes from the authenticated waiter.
///
/// The reads are purpose-built for ordering rather than reusing the manager
/// administration endpoints, so a waiter never receives an out-of-service table or
/// an unavailable item.
/// </summary>
[ApiController]
[Route("api/waiter")]
[Authorize(Policy = AuthorizationPolicies.Waiter)]
public sealed class WaiterController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IFloorService _floorService;

    /// <summary>Creates the controller.</summary>
    public WaiterController(IOrderService orderService, IFloorService floorService)
    {
        _orderService = orderService;
        _floorService = floorService;
    }

    /// <summary>Restaurant name and counts for the waiter workspace.</summary>
    [HttpGet("context")]
    [ProducesResponseType(typeof(WaiterContextResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<WaiterContextResponse>> GetContext(
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetContextAsync(staffId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>Tables in service, the only ones that can take a new order.</summary>
    [HttpGet("tables")]
    [ProducesResponseType(typeof(IReadOnlyList<WaiterTableResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<WaiterTableResponse>>> GetTables(
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetTablesAsync(staffId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>
    /// The live floor: every table and what is happening at it right now.
    ///
    /// Read only, and separate from the tables route above. That one lists where a new
    /// order may be placed and so returns only tables in service; this one shows the
    /// whole room, including tables that are closed or already working, so a waiter
    /// can see the floor rather than just their next options.
    /// </summary>
    [HttpGet("floor")]
    [ProducesResponseType(typeof(FloorOverviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<FloorOverviewResponse>> GetFloor(
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _floorService.GetForWaiterAsync(staffId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>The orderable menu: active categories with their active items.</summary>
    [HttpGet("menu")]
    [ProducesResponseType(
        typeof(IReadOnlyList<WaiterMenuCategoryResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<WaiterMenuCategoryResponse>>> GetMenu(
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetMenuAsync(staffId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>
    /// Places an order. The request carries no prices and no total: the server reads
    /// the menu itself, stores name and price snapshots, and calculates the amount.
    /// </summary>
    [HttpPost("orders")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> CreateOrder(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.CreateAsync(staffId.Value, request, cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(
            nameof(GetOrder),
            new { id = result.Value.Id },
            result.Value);
    }

    /// <summary>Loads one order placed in the caller restaurant.</summary>
    [HttpGet("orders/{id:guid}")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponse>> GetOrder(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetByIdAsync(staffId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Open orders for this restaurant, newest first. Restaurant-wide so whoever is
    /// on the floor can pick up a table; who placed each one is still shown.
    /// </summary>
    [HttpGet("orders")]
    [ProducesResponseType(typeof(IReadOnlyList<OrderSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<OrderSummaryResponse>>> GetOpenOrders(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.GetOpenAsync(staffId.Value, limit, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status403Forbidden)
            : Ok(result.Value);
    }

    /// <summary>
    /// Applies the submitted state to an open order: quantities and notes on the
    /// lines kept, removal of the ones left out, and any newly added items.
    ///
    /// Existing lines keep the name and price they were created with; only new items
    /// take today prices. The server recalculates every total.
    /// </summary>
    [HttpPut("orders/{id:guid}")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> UpdateOrder(
        Guid id,
        UpdateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.UpdateAsync(
            staffId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

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
    /// Confirms a customer's order after checking it with the table.
    /// </summary>
    /// <remarks>
    /// The step that lets an order placed from a phone reach the kitchen. Until it is
    /// taken, a submission is refused: somebody has to go to the table and agree what
    /// was ordered, because a phone order is often almost - but not quite - what the
    /// table meant.
    ///
    /// Adjusting the order is the ordinary update, not part of this. A waiter standing
    /// at the table fixes the quantities first and confirms once it is right.
    ///
    /// Takes no body. There is nothing to say beyond who confirmed it, and that comes
    /// from the token.
    /// </remarks>
    /// <param name="id">The order.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("orders/{id:guid}/confirmation")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> ConfirmOrder(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.ConfirmAsync(
            staffId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Sends every line not yet on a ticket to the kitchen as one submission.
    ///
    /// Returns the ticket that was created together with the refreshed order, so the
    /// interface can show the ticket number and lock the submitted lines without a
    /// second call.
    ///
    /// Refused while a customer's order still needs confirming, which is the one thing
    /// standing between a phone order and a pan.
    /// </summary>
    [HttpPost("orders/{id:guid}/kitchen-tickets")]
    [ProducesResponseType(typeof(SubmitToKitchenResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SubmitToKitchenResponse>> SubmitToKitchen(
        Guid id,
        CancellationToken cancellationToken)
    {
        var staffId = User.GetUserId();

        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _orderService.SubmitToKitchenAsync(
            staffId.Value,
            id,
            cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(
            nameof(GetOrder),
            new { id },
            result.Value);
    }

    private static int StatusFor(Error error)
    {
        if (error == OrderErrors.NotAnActiveWaiter ||
            error == OrderErrors.NotOnTheFloor)
        {
            return StatusCodes.Status403Forbidden;
        }

        if (error == OrderErrors.NotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // A table or item that is no longer available is a conflict with the current
        // state of the restaurant, not a malformed request.
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
