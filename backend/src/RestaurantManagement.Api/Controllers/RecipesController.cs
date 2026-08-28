using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Inventory.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// What a menu item is made from.
///
/// Nested under the menu item rather than sitting in the inventory module, because a
/// recipe belongs to the thing being made: there is exactly one per menu item, it has
/// no identity of its own, and it is edited from the menu.
///
/// Restaurant Manager only, and no restaurant identifier: both the menu item and every
/// ingredient are resolved within the restaurant the caller manages, so a recipe cannot
/// reach across restaurants in either direction.
/// </summary>
[ApiController]
[Route("api/menu/items/{menuItemId:guid}/recipe")]
[Authorize(Roles = PlatformRoles.RestaurantManager)]
public sealed class RecipesController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    /// <summary>Creates the controller.</summary>
    public RecipesController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    /// <summary>
    /// The recipe, with how many could be made from what is on the shelves.
    ///
    /// An item with no ingredients returns an empty recipe rather than a not-found: not
    /// having one is a legitimate state for anything sold as it comes.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(RecipeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RecipeResponse>> GetRecipe(
        Guid menuItemId,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.GetRecipeAsync(
            managerId.Value,
            menuItemId,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    /// <summary>
    /// Saves the whole recipe, replacing whatever it was.
    ///
    /// The submitted lines become the recipe and anything left out is removed, so an
    /// editor is one save rather than a sequence that could fail half way and leave a
    /// recipe nobody intended. An empty list means the item consumes nothing.
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(RecipeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RecipeResponse>> SaveRecipe(
        Guid menuItemId,
        SaveRecipeRequest request,
        CancellationToken cancellationToken)
    {
        var managerId = User.GetUserId();

        if (managerId is null)
        {
            return Unauthorized();
        }

        var result = await _inventoryService.SaveRecipeAsync(
            managerId.Value,
            menuItemId,
            request,
            cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusFor(result.Error!))
            : Ok(result.Value);
    }

    private static int StatusFor(Error error)
    {
        if (error == InventoryErrors.NoRestaurantAssigned ||
            error == InventoryErrors.MenuItemNotFound)
        {
            return StatusCodes.Status404NotFound;
        }

        // A missing ingredient, a duplicate, or a unit that cannot describe the thing:
        // all of them mean the submitted recipe is wrong rather than the state being in
        // the way.
        return StatusCodes.Status400BadRequest;
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Request failed",
            type: null,
            instance: Request.Path);
}
