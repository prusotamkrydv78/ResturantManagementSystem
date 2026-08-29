using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Menu;
using RestaurantManagement.Application.Menu.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Menu item administration for a restaurant manager.
///
/// Restaurant Manager only. No action accepts a restaurant identifier, and the
/// category on a create or update must be one of the caller own categories.
/// </summary>
[ApiController]
[Route("api/menu/items")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class MenuItemsController : ControllerBase
{
    private readonly IMenuService _menuService;

    /// <summary>Creates the controller.</summary>
    public MenuItemsController(IMenuService menuService)
    {
        _menuService = menuService;
    }

    /// <summary>
    /// Lists the items of the caller restaurant, optionally narrowed by a name
    /// fragment and by category.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MenuItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MenuItemResponse>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] Guid? categoryId,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.GetItemsAsync(
            managerId.Value,
            search,
            categoryId,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Loads one item.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.GetItemAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Adds an item to one of the caller own categories.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> Create(
        CreateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.CreateItemAsync(
            managerId.Value,
            request,
            cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusCodes.Status404NotFound);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>
    /// Updates an item, including moving it between the caller own categories.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> Update(
        Guid id,
        UpdateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.UpdateItemAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Puts an item on or off the menu.</summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> SetStatus(
        Guid id,
        SetMenuActiveRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.SetItemActiveAsync(
            managerId.Value,
            id,
            request.IsActive,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Adds several items to one category at once.
    ///
    /// Entering a menu a dish at a time is the longest job in setting a restaurant up.
    /// The batch saves together, so a rejected row takes the whole paste back rather
    /// than leaving half a course entered.
    /// </summary>
    [HttpPost("bulk")]
    [ProducesResponseType(typeof(IReadOnlyList<MenuItemResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MenuItemResponse>>> CreateMany(
        CreateMenuItemsRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.CreateItemsAsync(
            managerId.Value,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : StatusCode(StatusCodes.Status201Created, result.Value);
    }

    /// <summary>
    /// Deletes an item added by mistake. Refused once it has been ordered.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.DeleteItemAsync(managerId.Value, id, cancellationToken);

        if (result.IsFailure)
        {
            var error = result.Error!;

            return ProblemFrom(
                error,
                error == MenuErrors.ItemHasHistory
                    ? StatusCodes.Status409Conflict
                    : StatusCodes.Status404NotFound);
        }

        return NoContent();
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
