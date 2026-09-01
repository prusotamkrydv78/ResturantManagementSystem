using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Menu;
using RestaurantManagement.Application.Menu.Dtos;
using RestaurantManagement.Domain.Menu;
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

    /* --------------------------------------------------------------------- Images */

    /// <summary>
    /// Puts a photograph on a menu item, replacing any it already had.
    ///
    /// The size limit is on the action as well as in the service, so an oversized body
    /// is rejected by the framework before it is buffered rather than after.
    /// </summary>
    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(MenuItem.MaxImageBytes + 8192)]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> SetImage(
        Guid id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        if (file is null || file.Length == 0)
        {
            return ProblemFrom(MenuErrors.ImageEmpty, StatusCodes.Status400BadRequest);
        }

        await using var stream = file.OpenReadStream();

        var result = await _menuService.SetItemImageAsync(
            managerId.Value,
            id,
            file.FileName,
            file.ContentType ?? string.Empty,
            stream,
            file.Length,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, ImageStatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>Takes the photograph off a menu item.</summary>
    [HttpDelete("{id:guid}/image")]
    [ProducesResponseType(typeof(MenuItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuItemResponse>> RemoveImage(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.RemoveItemImageAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, ImageStatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// The bytes of a menu item photograph.
    ///
    /// Open, unlike everything else on this controller, and by necessity rather than
    /// convenience: this picture is drawn on the page a guest reaches by scanning the
    /// code on their table, and that guest has no account at all. An image tag could
    /// not send a token even if they did.
    ///
    /// Nothing about the item beyond the picture is reachable here - not its price, not
    /// its restaurant, not whether it is on sale. Cached for a year, which is safe only
    /// because the URL carries a stamp that moves whenever the bytes do.
    /// </summary>
    [HttpGet("{id:guid}/image")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid id, CancellationToken cancellationToken)
    {
        var result = await _menuService.GetItemImageBytesAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound();
        }

        var (content, contentType) = result.Value;

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return File(content, contentType);
    }

    /// <summary>
    /// Which code an image failure gets. A missing picture or a missing item is a 404;
    /// a file that is too big or the wrong kind is the caller sending something wrong.
    /// </summary>
    private static int ImageStatusFor(Error error) =>
        error == MenuErrors.ItemNotFound ||
        error == MenuErrors.ImageNotFound ||
        error == MenuErrors.NoRestaurantAssigned
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status400BadRequest;

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
