using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Inventory.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// The shelves, and what has moved on them.
///
/// Restaurant Manager only. No action accepts a restaurant identifier: the restaurant
/// comes from the record the caller manages.
///
/// There is no endpoint that sets a stock figure directly. Every change goes through a
/// movement, so a balance that nothing accounts for cannot be created. Consumption is
/// not here at all: it is written when a waiter sends an order to the kitchen, and a
/// second route to it would let the same food be deducted twice.
/// </summary>
[ApiController]
[Route("api/inventory")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    /// <summary>Creates the controller.</summary>
    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    /// <summary>
    /// The shelves, with the counts that decide what needs attention. Archived items are
    /// left out unless asked for.
    /// </summary>
    [HttpGet("items")]
    [ProducesResponseType(typeof(InventoryOverviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryOverviewResponse>> GetItems(
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.GetItemsAsync(
            managerId.Value,
            includeArchived,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>One item with its history, newest first.</summary>
    [HttpGet("items/{id:guid}")]
    [ProducesResponseType(typeof(InventoryItemDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDetailResponse>> GetItem(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.GetItemAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Adds an item. Any opening quantity is written as a movement, so the ledger
    /// accounts for the whole balance from the start.
    /// </summary>
    [HttpPost("items")]
    [ProducesResponseType(typeof(InventoryItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryItemResponse>> CreateItem(
        CreateInventoryItemRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.CreateItemAsync(
            managerId.Value,
            request,
            cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(
            nameof(GetItem),
            new { id = result.Value.Id },
            result.Value);
    }

    /// <summary>
    /// Renames an item or changes its reorder level.
    ///
    /// The payload has no unit and no stock figure. Changing the unit would reinterpret
    /// every quantity already recorded, and the figure moves only through a movement.
    /// </summary>
    [HttpPut("items/{id:guid}")]
    [ProducesResponseType(typeof(InventoryItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryItemResponse>> UpdateItem(
        Guid id,
        UpdateInventoryItemRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.UpdateItemAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Archives or restores an item.</summary>
    [HttpPut("items/{id:guid}/status")]
    [ProducesResponseType(typeof(InventoryItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemResponse>> SetItemStatus(
        Guid id,
        SetInventoryItemActiveRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.SetItemActiveAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Deletes an item outright, which is only possible while it has no history and no
    /// recipe naming it. Anything else is archived.
    /// </summary>
    [HttpDelete("items/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteItem(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.DeleteItemAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : NoContent();
    }

    /// <summary>
    /// Moves stock: a delivery, a correction after counting, or something thrown away.
    ///
    /// Consumption cannot be recorded here.
    /// </summary>
    [HttpPost("items/{id:guid}/movements")]
    [ProducesResponseType(typeof(InventoryItemDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryItemDetailResponse>> RecordMovement(
        Guid id,
        RecordStockMovementRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.RecordMovementAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Which menu items have a recipe, and how many of each could be made. For the menu
    /// screen, so it does not need a request per row.
    /// </summary>
    [HttpGet("recipes")]
    [ProducesResponseType(
        typeof(IReadOnlyList<RecipeSummaryResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<RecipeSummaryResponse>>> GetRecipes(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.GetRecipeSummariesAsync(
            managerId.Value,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error)
    {
        if (error == InventoryErrors.NoRestaurantAssigned ||
            error == InventoryErrors.ItemNotFound ||
            error == InventoryErrors.MenuItemNotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        if (error == InventoryErrors.ReasonRequired ||
            error == InventoryErrors.ConsumptionIsAutomatic ||
            error == InventoryErrors.OpeningIsAutomatic ||
            error == InventoryErrors.IngredientNotFound ||
            error == InventoryErrors.DuplicateIngredient ||
            error.Code == "inventory.incompatible_unit")
        {
            return StatusCodes.Status400BadRequest;
        }

        // A name already taken, history that cannot be discarded, a recipe still using
        // the item, or somebody else moving it first: all conflicts with the current
        // state rather than malformed requests.
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
