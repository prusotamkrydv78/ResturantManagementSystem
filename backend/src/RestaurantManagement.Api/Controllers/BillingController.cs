using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Billing;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Billing and order closure for a restaurant manager.
///
/// Restaurant Manager only, so a waiter, a chef and a platform admin are
/// all refused. No action accepts a restaurant identifier: ownership comes from the
/// restaurant record the caller manages.
///
/// There is no payment collection here on purpose. Payments are created by settling
/// an order and are never listed, edited or deleted through this API: a record that
/// money changed hands is history, and an endpoint that could revise it would make it
/// something less than that.
/// </summary>
[ApiController]
[Route("api/billing")]
// Reading a bill and taking payment for it are floor work as much as counter work, so
// the class admits both. The two actions that are not - calling an order off, and the
// takings history - carry a second attribute of their own, and ASP.NET requires every
// attribute on the path to pass.
[Authorize(Policy = AuthorizationPolicies.Settles)]
public sealed class BillingController : ControllerBase
{
    private readonly IBillingService _billingService;

    /// <summary>Creates the controller.</summary>
    public BillingController(IBillingService billingService)
    {
        _billingService = billingService;
    }

    /// <summary>
    /// The billing queue: open orders, oldest first. Set
    /// <paramref name="includeCompleted"/> to also return the most recently closed
    /// ones, so a manager can confirm what was just settled.
    /// </summary>
    [HttpGet("orders")]
    [ProducesResponseType(
        typeof(IReadOnlyList<BillingOrderSummaryResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<BillingOrderSummaryResponse>>> GetOrders(
        [FromQuery] bool includeCompleted = false,
        CancellationToken cancellationToken = default)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.GetOrdersAsync(
            managerId.Value,
            includeCompleted,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// One order with everything needed to settle it: its lines at the prices they
    /// were ordered at, the kitchen state, the amount due, and whether it may close.
    /// </summary>
    [HttpGet("orders/{id:guid}")]
    [ProducesResponseType(typeof(BillingOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BillingOrderResponse>> GetOrder(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.GetOrderAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Records the payment, closes the order and releases the table, as one
    /// operation.
    ///
    /// The body carries the method only. The amount comes from the stored order
    /// total, so there is no figure here for a client to supply.
    /// </summary>
    [HttpPost("orders/{id:guid}/payment")]
    [ProducesResponseType(typeof(RecordPaymentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RecordPaymentResponse>> RecordPayment(
        Guid id,
        RecordPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.RecordPaymentAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(nameof(GetOrder), new { id }, result.Value);
    }

    /// <summary>
    /// Calls an order off without payment and releases the table, as one operation.
    ///
    /// Nothing is deleted: the order keeps its number and its lines, and any kitchen
    /// tickets keep their own status. A reason is required, because an order that
    /// produced no money and carries no explanation is the gap this state exists to
    /// close.
    /// </summary>
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [HttpPost("orders/{id:guid}/cancellation")]
    [ProducesResponseType(typeof(BillingOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<BillingOrderResponse>> CancelOrder(
        Guid id,
        CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.CancelOrderAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Orders that have ended, newest first, however they ended. Filter by status for
    /// one outcome only.
    ///
    /// A history list rather than a report: one row per order, with no totals or
    /// groupings. The limit is capped by the service whatever is asked for.
    /// </summary>
    [Authorize(Roles = PlatformRoles.RestaurantManager)]
    [HttpGet("history")]
    [ProducesResponseType(
        typeof(IReadOnlyList<OrderHistoryEntryResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<OrderHistoryEntryResponse>>> GetHistory(
        [FromQuery] OrderStatus? status,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.GetHistoryAsync(
            managerId.Value,
            status,
            limit,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// The receipt for an order that was paid for.
    ///
    /// Nothing is created by asking: the document is assembled from the order, its
    /// lines and its payment, so the same request always produces the same receipt.
    /// Refused for an order that is still open or was cancelled, because no money was
    /// taken and a receipt would say otherwise.
    /// </summary>
    [HttpGet("orders/{id:guid}/receipt")]
    [ProducesResponseType(typeof(ReceiptResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReceiptResponse>> GetReceipt(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _billingService.GetReceiptAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error)
    {
        if (error == BillingErrors.NoRestaurantAssigned)
        {
            return StatusCodes.Status404NotFound;
        }

        if (error == BillingErrors.OrderNotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // Already closed, already paid, kitchen still cooking, or someone else got
        // there first: all conflicts with the current state, not bad requests.
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
