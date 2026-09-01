using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Menu;
using RestaurantManagement.Application.Menu.Dtos;
using RestaurantManagement.Domain.Media;
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
                category.UpdatedAtUtc,
                // Projected, so the picture bytes are never read here - only the
                // stamp, which is all the URL needs.
                MenuCategoryImage.UrlFor(category.Id, category.ImageUpdatedAtUtc)))
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

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<MenuItemResponse>>> CreateItemsAsync(
        Guid managerUserId,
        CreateMenuItemsRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<MenuItemResponse>>(
                MenuErrors.NoRestaurantAssigned);
        }

        var category = await CategoriesOf(restaurantId.Value)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == request.CategoryId,
                cancellationToken);

        if (category is null)
        {
            return Result.Failure<IReadOnlyList<MenuItemResponse>>(
                MenuErrors.CategoryNotInRestaurant);
        }

        var now = DateTimeOffset.UtcNow;

        var items = request.Items
            .Select(line => new MenuItem
            {
                Id = Guid.CreateVersion7(),
                RestaurantId = restaurantId.Value,
                CategoryId = category.Id,
                Category = category,
                Name = line.Name.Trim(),
                Description = string.IsNullOrWhiteSpace(line.Description)
                    ? null
                    : line.Description.Trim(),
                Price = line.Price,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            })
            .ToList();

        // One SaveChanges for the batch. There is no unique index on an item name, so
        // nothing here can half-fail on a duplicate; what a single save buys is that a
        // price the database rejects takes the whole paste back rather than leaving a
        // course half entered and the manager guessing where they got to.
        _dbContext.MenuItems.AddRange(items);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Added {Count} items to category {CategoryId}.",
            items.Count,
            category.Id);

        return Result.Success<IReadOnlyList<MenuItemResponse>>(
            items.Select(Project).ToList());
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<MenuCategoryResponse>>> ReorderCategoriesAsync(
        Guid managerUserId,
        ReorderCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<MenuCategoryResponse>>(
                MenuErrors.NoRestaurantAssigned);
        }

        var categories = await CategoriesOf(restaurantId.Value).ToListAsync(cancellationToken);
        var byId = categories.ToDictionary(category => category.Id);

        // Every identifier has to be one of ours. A list containing something else is
        // either stale or somebody else's, and reordering around it would silently
        // renumber the wrong set.
        if (request.CategoryIds.Any(id => !byId.ContainsKey(id)))
        {
            return Result.Failure<IReadOnlyList<MenuCategoryResponse>>(
                MenuErrors.CategoryNotInRestaurant);
        }

        var now = DateTimeOffset.UtcNow;
        var position = 0;

        foreach (var id in request.CategoryIds)
        {
            var category = byId[id];

            if (category.DisplayOrder != position)
            {
                category.DisplayOrder = position;
                category.UpdatedAtUtc = now;
            }

            position++;
        }

        // Anything the caller left out keeps its relative order and follows the rest,
        // so a list that arrived stale reorders what it named without shuffling what
        // it did not know about.
        foreach (var category in categories
            .Where(candidate => !request.CategoryIds.Contains(candidate.Id))
            .OrderBy(candidate => candidate.DisplayOrder))
        {
            category.DisplayOrder = position++;
            category.UpdatedAtUtc = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await GetCategoriesAsync(managerUserId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<bool>(MenuErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<bool>(MenuErrors.ItemNotFound);
        }

        // Order lines keep the item id but are not a foreign key to it, so the database
        // would allow this and leave the sales history pointing at nothing.
        var sold = await _dbContext.OrderItems.AnyAsync(
            line => line.MenuItemId == itemId,
            cancellationToken);

        if (sold)
        {
            return Result.Failure<bool>(MenuErrors.ItemHasHistory);
        }

        // Recipe lines cascade from the item in the schema, so an unsold dish takes its
        // ingredients with it.
        _dbContext.MenuItems.Remove(item);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Deleted menu item {ItemId}.", itemId);

        return Result.Success(true);
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteCategoryAsync(
        Guid managerUserId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<bool>(MenuErrors.NoRestaurantAssigned);
        }

        var category = await CategoriesOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == categoryId, cancellationToken);

        if (category is null)
        {
            return Result.Failure<bool>(MenuErrors.CategoryNotFound);
        }

        // Items cascade from their category, so deleting one that still holds dishes
        // would take them with it - including sold ones the item rule above refuses to
        // delete on their own. Emptying first keeps that an explicit decision.
        var hasItems = await _dbContext.MenuItems.AnyAsync(
            item => item.CategoryId == categoryId,
            cancellationToken);

        if (hasItems)
        {
            return Result.Failure<bool>(MenuErrors.CategoryNotEmpty);
        }

        _dbContext.MenuCategories.Remove(category);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Deleted menu category {CategoryId}.", categoryId);

        return Result.Success(true);
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

    /* ------------------------------------------------------------ Section images */

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> SetCategoryImageAsync(
        Guid managerUserId,
        Guid categoryId,
        string fileName,
        string contentType,
        Stream content,
        long length,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        if (length <= 0)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.ImageEmpty);
        }

        // Checked before reading, so an oversized upload is refused without being
        // pulled into memory first.
        if (length > MenuCategory.MaxImageBytes)
        {
            return Result.Failure<MenuCategoryResponse>(
                MenuErrors.ImageTooLarge(MenuCategory.MaxImageBytes));
        }

        if (!ImageMedia.AllowedTypes.ContainsKey(contentType))
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.ImageTypeNotAllowed);
        }

        var category = await _dbContext.MenuCategories
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == categoryId &&
                    candidate.RestaurantId == restaurantId.Value,
                cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNotFound);
        }

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        // The declared length was a claim. This is what actually arrived.
        if (bytes.Length == 0)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.ImageEmpty);
        }

        if (bytes.Length > MenuCategory.MaxImageBytes)
        {
            return Result.Failure<MenuCategoryResponse>(
                MenuErrors.ImageTooLarge(MenuCategory.MaxImageBytes));
        }

        // The browser's content type is a claim too, and this picture is served to a
        // stranger's phone, so the bytes have to begin the way the type says.
        if (!ImageMedia.LooksLikeImage(bytes, contentType))
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.ImageTypeNotAllowed);
        }

        var now = DateTimeOffset.UtcNow;

        var existing = await _dbContext.MenuCategoryImages
            .SingleOrDefaultAsync(image => image.MenuCategoryId == categoryId, cancellationToken);

        if (existing is null)
        {
            _dbContext.MenuCategoryImages.Add(new MenuCategoryImage
            {
                MenuCategoryId = category.Id,
                RestaurantId = restaurantId.Value,
                ContentType = contentType.ToLowerInvariant(),
                ByteCount = bytes.Length,
                Content = bytes,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            existing.ContentType = contentType.ToLowerInvariant();
            existing.ByteCount = bytes.Length;
            existing.Content = bytes;
            existing.UpdatedAtUtc = now;
        }

        // Saved in the same transaction as the row above: the stamp is what a listing
        // reads to know a picture exists, and what versions the URL.
        category.ImageUpdatedAtUtc = now;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} set a {ByteCount} byte picture on menu section {CategoryId}.",
            managerUserId,
            bytes.Length,
            categoryId);

        return Result.Success(ToResponse(category));
    }

    /// <inheritdoc />
    public async Task<Result<MenuCategoryResponse>> RemoveCategoryImageAsync(
        Guid managerUserId,
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var category = await _dbContext.MenuCategories
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == categoryId &&
                    candidate.RestaurantId == restaurantId.Value,
                cancellationToken);

        if (category is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.CategoryNotFound);
        }

        if (category.ImageUpdatedAtUtc is null)
        {
            return Result.Failure<MenuCategoryResponse>(MenuErrors.ImageNotFound);
        }

        // Deleted by key, so the bytes never travel back only to be thrown away.
        await _dbContext.MenuCategoryImages
            .Where(image => image.MenuCategoryId == categoryId)
            .ExecuteDeleteAsync(cancellationToken);

        category.ImageUpdatedAtUtc = null;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} removed the picture from menu section {CategoryId}.",
            managerUserId,
            categoryId);

        return Result.Success(ToResponse(category));
    }

    /// <inheritdoc />
    public async Task<Result<(byte[] Content, string ContentType)>> GetCategoryImageBytesAsync(
        Guid categoryId,
        CancellationToken cancellationToken)
    {
        var image = await _dbContext.MenuCategoryImages
            .AsNoTracking()
            .Where(candidate => candidate.MenuCategoryId == categoryId)
            .Select(candidate => new { candidate.Content, candidate.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        return image is null
            ? Result.Failure<(byte[], string)>(MenuErrors.ImageNotFound)
            : Result.Success((image.Content, image.ContentType));
    }

    /* --------------------------------------------------------------------- Images */

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> SetItemImageAsync(
        Guid managerUserId,
        Guid itemId,
        string fileName,
        string contentType,
        Stream content,
        long length,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        if (length <= 0)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ImageEmpty);
        }

        // Checked before reading, so an oversized upload is refused without being
        // pulled into memory first.
        if (length > MenuItem.MaxImageBytes)
        {
            return Result.Failure<MenuItemResponse>(
                MenuErrors.ImageTooLarge(MenuItem.MaxImageBytes));
        }

        if (!ImageMedia.AllowedTypes.ContainsKey(contentType))
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ImageTypeNotAllowed);
        }

        var item = await _dbContext.MenuItems
            .Include(candidate => candidate.Category)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == itemId && candidate.RestaurantId == restaurantId.Value,
                cancellationToken);

        if (item is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ItemNotFound);
        }

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        // The declared length was a claim. This is what actually arrived, and it is the
        // one the limit has to hold against.
        if (bytes.Length == 0)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ImageEmpty);
        }

        if (bytes.Length > MenuItem.MaxImageBytes)
        {
            return Result.Failure<MenuItemResponse>(
                MenuErrors.ImageTooLarge(MenuItem.MaxImageBytes));
        }

        // The browser's content type is a claim too. This checks the bytes begin the
        // way that type should, which matters more here than anywhere else in the
        // product: this is the one image a stranger's phone is told to load.
        if (!ImageMedia.LooksLikeImage(bytes, contentType))
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ImageTypeNotAllowed);
        }

        var now = DateTimeOffset.UtcNow;

        var existing = await _dbContext.MenuItemImages
            .SingleOrDefaultAsync(image => image.MenuItemId == itemId, cancellationToken);

        if (existing is null)
        {
            _dbContext.MenuItemImages.Add(new MenuItemImage
            {
                MenuItemId = item.Id,
                RestaurantId = restaurantId.Value,
                ContentType = contentType.ToLowerInvariant(),
                ByteCount = bytes.Length,
                Content = bytes,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            existing.ContentType = contentType.ToLowerInvariant();
            existing.ByteCount = bytes.Length;
            existing.Content = bytes;
            existing.UpdatedAtUtc = now;
        }

        // Saved in the same transaction as the row above. The stamp is what every menu
        // listing reads to know a picture exists and what versions the URL, so the two
        // halves must never be written apart.
        item.ImageUpdatedAtUtc = now;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} set a {ByteCount} byte picture on menu item {ItemId}.",
            managerUserId,
            bytes.Length,
            itemId);

        return Result.Success(Project(item));
    }

    /// <inheritdoc />
    public async Task<Result<MenuItemResponse>> RemoveItemImageAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.NoRestaurantAssigned);
        }

        var item = await _dbContext.MenuItems
            .Include(candidate => candidate.Category)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == itemId && candidate.RestaurantId == restaurantId.Value,
                cancellationToken);

        if (item is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ItemNotFound);
        }

        if (item.ImageUpdatedAtUtc is null)
        {
            return Result.Failure<MenuItemResponse>(MenuErrors.ImageNotFound);
        }

        // Deleted by key rather than loaded and removed, so the bytes never travel back
        // from the database only to be thrown away.
        await _dbContext.MenuItemImages
            .Where(image => image.MenuItemId == itemId)
            .ExecuteDeleteAsync(cancellationToken);

        item.ImageUpdatedAtUtc = null;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} removed the picture from menu item {ItemId}.",
            managerUserId,
            itemId);

        return Result.Success(Project(item));
    }

    /// <inheritdoc />
    public async Task<Result<(byte[] Content, string ContentType)>> GetItemImageBytesAsync(
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var image = await _dbContext.MenuItemImages
            .AsNoTracking()
            .Where(candidate => candidate.MenuItemId == itemId)
            .Select(candidate => new { candidate.Content, candidate.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        return image is null
            ? Result.Failure<(byte[], string)>(MenuErrors.ImageNotFound)
            : Result.Success((image.Content, image.ContentType));
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
            item.UpdatedAtUtc,
            MenuItemImage.UrlFor(item.Id, item.ImageUpdatedAtUtc));

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
            item.UpdatedAtUtc,
            MenuItemImage.UrlFor(item.Id, item.ImageUpdatedAtUtc));

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
            category.UpdatedAtUtc,
            MenuCategoryImage.UrlFor(category.Id, category.ImageUpdatedAtUtc));

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
