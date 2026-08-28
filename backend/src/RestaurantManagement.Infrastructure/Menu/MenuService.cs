using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Menu;
using RestaurantManagement.Application.Menu.Dtos;
using RestaurantManagement.Domain.Menu;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Menu;

/// <summary>
/// Menu administration for a restaurant manager.
///
/// Isolation works as it does for staff and tables: the restaurant is derived from
/// the manager and every read and write is filtered by it. Cross-restaurant
/// attachment is additionally impossible at the storage layer, because an item
/// references its category by the pair (CategoryId, RestaurantId).
/// </summary>
public sealed class MenuService : IMenuService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<MenuService> _logger;

    /// <summary>Creates the service.</summary>
    public MenuService(ApplicationDbContext dbContext, ILogger<MenuService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /* ---------------------------------------------------------------- Categories */

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<MenuCategoryResponse>>> GetCategoriesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<MenuCategoryResponse>>(
                MenuErrors.NoRestaurantAssigned);
        }

        var categories = await CategoriesOf(restaurantId.Value)
            .AsNoTracking()
            .OrderBy(category => category.DisplayOrder)
            .ThenBy(category => category.Name)
            .Select(category => new MenuCategoryResponse(
                category.Id,
                category.Name,
                category.Description,
                category.DisplayOrder,
                category.IsActive,
                category.Items.Count,
                category.Items.Count(item => item.IsActive),
                category.CreatedAtUtc,
                category.UpdatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<MenuCategoryResponse>>(categories);
    }

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> GetCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var category = await CategoriesOf(restaurantId.Value)
            .AsNoTracking()
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == categoryId, cancellationToken);

        return category is null
            ? Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNotFound)
            : Result.Success(ToResponse(category));
    }

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> CreateCategoryAsync(
        Guid managerUserId,
        CreateMenuCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var name = request.Name.Trim();

        if (await CategoryNameExistsAsync(restaurantId.Value, name, null, cancellationToken))
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNameTaken);
        }

        // Left unset, the new category goes after the existing ones so the manager
        // never has to pick a number.
        var order = request.DisplayOrder
            ?? await NextDisplayOrderAsync(restaurantId.Value, cancellationToken);

        var now = DateTimeOffset.UtcNow;

        var category = new MenuCategory
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            Name = name,
            Description = Normalise(request.Description),
            DisplayOrder = order,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.MenuCategories.Add(category);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Added menu category {CategoryId} ({Name}) to restaurant {RestaurantId}.",
            category.Id,
            category.Name,
            restaurantId.Value);

        return Result.Success(ToResponse(category));
    }

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> UpdateCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        UpdateMenuCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var category = await CategoriesOf(restaurantId.Value)
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == categoryId, cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNotFound);
        }

        var name = request.Name.Trim();

        if (await CategoryNameExistsAsync(
                restaurantId.Value,
                name,
                category.Id,
                cancellationToken))
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNameTaken);
        }

        category.Name = name;
        category.Description = Normalise(request.Description);
        category.DisplayOrder = request.DisplayOrder;
        category.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Updated menu category {CategoryId}.", category.Id);

        return Result.Success(ToResponse(category));
    }

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> SetCategoryActiveAsync(
        Guid managerUserId,
        Guid categoryId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var category = await CategoriesOf(restaurantId.Value)
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(candidate => candidate.Id == categoryId, cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNotFound);
        }

        // Only this one flag moves. The items keep their category and their own
        // active state; whether they can be ordered is derived from both.
        category.IsActive = isActive;
        category.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Menu category {CategoryId} {State}, {ItemCount} item(s) untouched.",
            category.Id,
            isActive ? "shown" : "hidden",
            category.Items.Count);

        return Result.Success(ToResponse(category));
    }

    /* --------------------------------------------------------------------- Items */

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<MenuItemResponse>>> GetItemsAsync(
        Guid managerUserId,
        string? search,
        Guid? categoryId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<MenuItemResponse>>(
                MenuErrors.NoRestaurantAssigned);
        }

        var query = ItemsOf(restaurantId.Value).AsNoTracking();

        if (categoryId is not null)
        {
            query = query.Where(item => item.CategoryId == categoryId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item => item.Name.Contains(term));
        }

        var items = await query
            .OrderBy(item => item.Category.DisplayOrder)
            .ThenBy(item => item.Name)
            .Select(item => Project(item))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<MenuItemResponse>>(items);
    }

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> GetItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .AsNoTracking()
            .Where(candidate => candidate.Id == itemId)
            .Select(candidate => Project(candidate))
            .SingleOrDefaultAsync(cancellationToken);

        return item is null
            ? Result.Failure<MenuItemResponse>(MenuErrors.ItemNotFound)
            : Result.Success(item);
    }

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> CreateItemAsync(
        Guid managerUserId,
        CreateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        // Checked so the caller gets a clear message. The composite foreign key
        // would reject a mismatch anyway, which is the real guarantee.
        var category = await CategoriesOf(restaurantId.Value)
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Id == request.CategoryId,
                cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.CategoryNotInRestaurant);
        }

        var now = DateTimeOffset.UtcNow;

        var item = new MenuItem
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            CategoryId = category.Id,
            Name = request.Name.Trim(),
            Description = Normalise(request.Description),
            Price = request.Price,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.MenuItems.Add(item);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Added menu item {ItemId} ({Name}) to category {CategoryId}.",
            item.Id,
            item.Name,
            category.Id);

        return Result.Success(ToResponse(item, category.Name, category.IsActive));
    }

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> UpdateItemAsync(
        Guid managerUserId,
        Guid itemId,
        UpdateMenuItemRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ItemNotFound);
        }

        // The destination must be one of this restaurant categories, so an item can
        // move between categories but never between restaurants.
        var category = await CategoriesOf(restaurantId.Value)
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Id == request.CategoryId,
                cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.CategoryNotInRestaurant);
        }

        item.Name = request.Name.Trim();
        item.Description = Normalise(request.Description);
        item.Price = request.Price;
        item.CategoryId = category.Id;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Updated menu item {ItemId}.", item.Id);

        return Result.Success(ToResponse(item, category.Name, category.IsActive));
    }

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> SetItemActiveAsync(
        Guid managerUserId,
        Guid itemId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .Include(candidate => candidate.Category)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ItemNotFound);
        }

        item.IsActive = isActive;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Menu item {ItemId} {State}.",
            item.Id,
            isActive ? "shown" : "hidden");

        return Result.Success(
            ToResponse(item, item.Category.Name, item.Category.IsActive));
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// Finds the restaurant the caller manages. Ownership is read from the
    /// restaurant record, which is the only place it is stored.
    /// </summary>
    private async Task<Guid?> ResolveRestaurantIdAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var ids = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => restaurant.Id)
            .ToListAsync(cancellationToken);

        return ids.Count == 0 ? null : ids[0];
    }

    private IQueryable<MenuCategory> CategoriesOf(Guid restaurantId) =>
        _dbContext.MenuCategories.Where(category => category.RestaurantId == restaurantId);

    /// <summary>
    /// The items of one restaurant, with the category every response needs.
    ///
    /// The category is included here rather than at each call site because
    /// <see cref="Project"/> reads through it, and a projection written as a method
    /// cannot be translated to SQL: EF materialises the item and runs it in memory,
    /// where an unloaded navigation is simply null. That produced a 500 on the item
    /// list rather than a translation error, so the omission was invisible until a
    /// request actually ran.
    /// </summary>
    private IQueryable<MenuItem> ItemsOf(Guid restaurantId) =>
        _dbContext.MenuItems
            .Where(item => item.RestaurantId == restaurantId)
            .Include(item => item.Category);

    private Task<bool> CategoryNameExistsAsync(
        Guid restaurantId,
        string name,
        Guid? exceptCategoryId,
        CancellationToken cancellationToken) =>
        CategoriesOf(restaurantId)
            .Where(category => exceptCategoryId == null || category.Id != exceptCategoryId)
            .AnyAsync(category => category.Name == name, cancellationToken);

    private async Task<int> NextDisplayOrderAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var orders = await CategoriesOf(restaurantId)
            .Select(category => category.DisplayOrder)
            .ToListAsync(cancellationToken);

        return orders.Count == 0 ? 0 : orders.Max() + 1;
    }

    /// <summary>Projection used by the item queries, so the shape stays in one place.</summary>
    private static MenuItemResponse Project(MenuItem item) =>
        new(
            item.Id,
            item.Name,
            item.Description,
            item.Price,
            item.CategoryId,
            item.Category.Name,
            item.IsActive,
            item.Category.IsActive,
            item.IsActive && item.Category.IsActive,
            item.CreatedAtUtc,
            item.UpdatedAtUtc);

    private static MenuItemResponse ToResponse(
        MenuItem item,
        string categoryName,
        bool isCategoryActive) =>
        new(
            item.Id,
            item.Name,
            item.Description,
            item.Price,
            item.CategoryId,
            categoryName,
            item.IsActive,
            isCategoryActive,
            item.IsActive && isCategoryActive,
            item.CreatedAtUtc,
            item.UpdatedAtUtc);

    private static MenuCategoryResponse ToResponse(MenuCategory category) =>
        new(
            category.Id,
            category.Name,
            category.Description,
            category.DisplayOrder,
            category.IsActive,
            category.Items.Count,
            category.Items.Count(item => item.IsActive),
            category.CreatedAtUtc,
            category.UpdatedAtUtc);

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
