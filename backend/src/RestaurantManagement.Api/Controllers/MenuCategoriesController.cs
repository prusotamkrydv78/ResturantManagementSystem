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
/// Menu category administration for a restaurant manager.
///
/// Restaurant Manager only. No action accepts a restaurant identifier: the
/// restaurant comes from the access token.
/// </summary>
[ApiController]
[Route("api/menu/categories")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class MenuCategoriesController : ControllerBase
{
    private readonly IMenuService _menuService;

    /// <summary>Creates the controller.</summary>
    public MenuCategoriesController(IMenuService menuService)
    {
        _menuService = menuService;
    }

    /// <summary>Lists the categories of the caller restaurant, in menu order.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MenuCategoryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MenuCategoryResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.GetCategoriesAsync(managerId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Loads one category.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuCategoryResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.GetCategoryAsync(managerId.Value, id, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>Adds a category to the caller restaurant.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MenuCategoryResponse>> Create(
        CreateMenuCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.CreateCategoryAsync(
            managerId.Value,
            request,
            cancellationToken);

        if (result.IsFailure)
        {
            return ProblemFrom(result.Error!, StatusFor(result.Error!));
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>Updates a category name, description and position.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<MenuCategoryResponse>> Update(
        Guid id,
        UpdateMenuCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.UpdateCategoryAsync(
            managerId.Value,
            id,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Puts a category on or off the menu. Its items are left untouched; whether
    /// they can be ordered is derived from both the item and the category.
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuCategoryResponse>> SetStatus(
        Guid id,
        SetMenuActiveRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.SetCategoryActiveAsync(
            managerId.Value,
            id,
            request.IsActive,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Sets the order categories appear in, from the full list of identifiers.
    ///
    /// The whole order rather than one position: a place only means anything relative
    /// to the others, so moving them one at a time passes through states where two
    /// categories claim the same spot.
    /// </summary>
    [HttpPut("order")]
    [ProducesResponseType(typeof(IReadOnlyList<MenuCategoryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<MenuCategoryResponse>>> Reorder(
        ReorderCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.ReorderCategoriesAsync(
            managerId.Value,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status404NotFound)
            : Ok(result.Value);
    }

    /// <summary>
    /// Deletes an empty category. Refused while it still holds items.
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

        var result = await _menuService.DeleteCategoryAsync(
            managerId.Value,
            id,
            cancellationToken);

        if (result.IsFailure)
        {
            var error = result.Error!;

            return ProblemFrom(
                error,
                error == MenuErrors.CategoryNotEmpty
                    ? StatusCodes.Status409Conflict
                    : StatusCodes.Status404NotFound);
        }

        return NoContent();
    }

    /* --------------------------------------------------------------------- Images */

    /// <summary>Puts a photograph on a menu section, replacing any it already had.</summary>
    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(MenuCategory.MaxImageBytes + 8192)]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuCategoryResponse>> SetImage(
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

        var result = await _menuService.SetCategoryImageAsync(
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

    /// <summary>Takes the photograph off a menu section.</summary>
    [HttpDelete("{id:guid}/image")]
    [ProducesResponseType(typeof(MenuCategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MenuCategoryResponse>> RemoveImage(
        Guid id,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _menuService.RemoveCategoryImageAsync(
            managerId.Value,
            id,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, ImageStatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// The bytes of a section photograph.
    ///
    /// Open, like the dish photographs, and for the same reason: this is drawn above
    /// the section on the page a guest reaches by scanning their table, and that guest
    /// has no account. Cached for a year, safe only because the URL carries a stamp
    /// that moves whenever the bytes do.
    /// </summary>
    [HttpGet("{id:guid}/image")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid id, CancellationToken cancellationToken)
    {
        var result = await _menuService.GetCategoryImageBytesAsync(id, cancellationToken);

        if (result.IsFailure)
        {
            return NotFound();
        }

        var (content, contentType) = result.Value;

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return File(content, contentType);
    }

    /// <summary>
    /// Which code an image failure gets. A missing picture or section is a 404; a file
    /// that is too big or the wrong kind is the caller sending something wrong.
    /// </summary>
    private static int ImageStatusFor(Error error) =>
        error == MenuErrors.CategoryNotFound ||
        error == MenuErrors.ImageNotFound ||
        error == MenuErrors.NoRestaurantAssigned
            ? StatusCodes.Status404NotFound
            : StatusCodes.Status400BadRequest;

    private static int StatusFor(Error error) =>
        error == MenuErrors.CategoryNameTaken
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status404NotFound;

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
