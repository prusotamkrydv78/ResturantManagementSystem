using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Inventory.Dtos;
using RestaurantManagement.Domain.Inventory;
using RestaurantManagement.Domain.Media;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Inventory;

/// <summary>
/// The shelves, and what has moved on them.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// manager who owns it and every read and write is filtered by it.
///
/// One rule governs everything here: stock never moves without a movement saying why.
/// Every change goes through the item own Apply method, which writes both together, so
/// a balance nothing accounts for cannot come into existence.
/// </summary>
public sealed class InventoryService : IInventoryService
{
    /// <summary>
    /// How many movements to return with an item.
    ///
    /// There is no pagination in this product, so the bound lives here. Enough to see
    /// how a figure got where it is; not an archive to browse.
    /// </summary>
    private const int MovementLimit = 100;

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<InventoryService> _logger;

    /// <summary>Creates the service.</summary>
    public InventoryService(
        ApplicationDbContext dbContext,
        ILogger<InventoryService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /* --------------------------------------------------------------------- Items */

    /// <inheritdoc />
    public async Task<Result<InventoryOverviewResponse>> GetItemsAsync(
        Guid managerUserId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryOverviewResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        // Every item, then filtered for the list. The counts have to cover the whole
        // shelf: a warning that disappears when somebody narrows the view is worse than
        // no warning.
        var all = await ItemsOf(restaurantId.Value)
            .AsNoTracking()
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);

        var usage = await RecipeUsageAsync(restaurantId.Value, cancellationToken);
        var movements = await MovementStatsAsync(restaurantId.Value, cancellationToken);

        var active = all.Where(item => item.IsActive).ToList();

        var shown = includeArchived ? all : active;

        return Result.Success(new InventoryOverviewResponse(
            shown.Select(item => ToResponse(item, usage, movements)).ToList(),
            active.Count,
            active.Count(item => item.IsLowStock),
            active.Count(item => item.IsOutOfStock),
            active.Count(item => item.IsNegative),
            // Nothing can warn about an item with no reorder level, and silence about
            // one is easily mistaken for it being fine.
            active.Count(item => item.MinimumQuantity <= 0)));
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemDetailResponse>> GetItemAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.ItemNotFound);
        }

        return Result.Success(await ToDetailAsync(item, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemResponse>> CreateItemAsync(
        Guid managerUserId,
        CreateInventoryItemRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        var name = request.Name.Trim();

        if (await NameExistsAsync(restaurantId.Value, name, null, cancellationToken))
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.NameTaken);
        }

        var now = DateTimeOffset.UtcNow;

        var item = new InventoryItem
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            Name = name,
            Unit = request.Unit,
            // Starts empty and is moved to the opening figure below, so the ledger
            // accounts for the whole balance rather than starting part way in.
            QuantityInStock = 0,
            MinimumQuantity = request.MinimumQuantity,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.InventoryItems.Add(item);

        if (request.QuantityInStock > 0)
        {
            _dbContext.StockMovements.Add(item.Apply(
                StockMovementKind.Opening,
                request.QuantityInStock,
                managerUserId,
                now));
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} added inventory item {Name} measured in {Unit}.",
            managerUserId,
            item.Name,
            item.Unit);

        // Read back rather than assumed empty: an opening quantity has just produced a
        // movement, and reporting none would be a small lie on the very first response.
        return Result.Success(await ToResponseWithStatsAsync(item, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemResponse>> UpdateItemAsync(
        Guid managerUserId,
        Guid itemId,
        UpdateInventoryItemRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ItemNotFound);
        }

        var name = request.Name.Trim();

        if (await NameExistsAsync(restaurantId.Value, name, itemId, cancellationToken))
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.NameTaken);
        }

        // The name and the reorder level, and nothing else. The unit would reinterpret
        // every quantity already recorded, and the stock figure has to move through a
        // movement or the ledger stops adding up.
        item.Name = name;
        item.MinimumQuantity = request.MinimumQuantity;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(await ToResponseWithStatsAsync(item, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemResponse>> SetItemActiveAsync(
        Guid managerUserId,
        Guid itemId,
        SetInventoryItemActiveRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ItemNotFound);
        }

        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(await ToResponseWithStatsAsync(item, cancellationToken));
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
            return Result.Failure<bool>(InventoryErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<bool>(InventoryErrors.ItemNotFound);
        }

        // Two separate reasons, reported apart because the fix differs. A recipe can be
        // edited; history cannot, and an item with any is archived instead.
        var recipeUses = await _dbContext.MenuItemIngredients
            .CountAsync(line => line.InventoryItemId == itemId, cancellationToken);

        if (recipeUses > 0)
        {
            return Result.Failure<bool>(InventoryErrors.UsedInRecipes(recipeUses));
        }

        var hasHistory = await _dbContext.StockMovements
            .AnyAsync(movement => movement.InventoryItemId == itemId, cancellationToken);

        if (hasHistory)
        {
            return Result.Failure<bool>(InventoryErrors.HasHistory);
        }

        _dbContext.InventoryItems.Remove(item);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} deleted inventory item {Name}, which had no history.",
            managerUserId,
            item.Name);

        return Result.Success(true);
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemDetailResponse>> RecordMovementAsync(
        Guid managerUserId,
        Guid itemId,
        RecordStockMovementRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.NoRestaurantAssigned);
        }

        // Two kinds are written by the system and cannot be entered. Consumption comes
        // from the kitchen being told to cook, and a second route would let the same
        // food be deducted twice; an opening balance happens once, at creation.
        if (request.Kind == StockMovementKind.Consumed)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.ConsumptionIsAutomatic);
        }

        if (request.Kind == StockMovementKind.Opening)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.OpeningIsAutomatic);
        }

        var reason = request.Reason?.Trim();

        var needsReason =
            request.Kind is StockMovementKind.Adjusted or StockMovementKind.Wasted;

        if (needsReason && string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.ReasonRequired);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemDetailResponse>(
                InventoryErrors.ItemNotFound);
        }

        // The request states a positive amount and the kind decides the direction, so a
        // delivery cannot be entered as a negative number and quietly become a loss.
        var delta = request.Kind switch
        {
            StockMovementKind.Received => request.Quantity,
            StockMovementKind.Wasted => -request.Quantity,
            _ => request.Increase ? request.Quantity : -request.Quantity,
        };

        _dbContext.StockMovements.Add(item.Apply(
            request.Kind,
            delta,
            managerUserId,
            DateTimeOffset.UtcNow,
            needsReason ? reason : null));

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Somebody else moved this item between it being read and written. Refused
            // rather than overwriting their movement, which would leave the balance
            // disagreeing with its own ledger.
            return Result.Failure<InventoryItemDetailResponse>(Concurrent);
        }

        _logger.LogInformation(
            "Manager {ManagerId} recorded {Kind} of {Delta} {Unit} on {Name}, leaving {After}.",
            managerUserId,
            request.Kind,
            delta,
            item.Unit,
            item.Name,
            item.QuantityInStock);

        return Result.Success(await ToDetailAsync(item, cancellationToken));
    }

    /// <summary>
    /// Someone else moved the same item first.
    ///
    /// Declared here rather than beside the other errors because it belongs to this one
    /// write path: everything else in the module either reads or is guarded by a
    /// uniqueness check.
    /// </summary>
    private static readonly Error Concurrent =
        new(
            "inventory.conflict",
            "Someone else changed this item stock. Reload it and apply your change again.");

    /* ------------------------------------------------------------------- Recipes */

    /// <inheritdoc />
    public async Task<Result<RecipeResponse>> GetRecipeAsync(
        Guid managerUserId,
        Guid menuItemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.NoRestaurantAssigned);
        }

        var menuItem = await _dbContext.MenuItems
            .AsNoTracking()
            .Where(candidate =>
                candidate.Id == menuItemId &&
                candidate.RestaurantId == restaurantId.Value)
            .Select(candidate => new { candidate.Id, candidate.Name })
            .SingleOrDefaultAsync(cancellationToken);

        if (menuItem is null)
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.MenuItemNotFound);
        }

        var lines = await RecipeLinesOf(restaurantId.Value, menuItemId)
            .ToListAsync(cancellationToken);

        return Result.Success(ToRecipe(menuItem.Id, menuItem.Name, lines));
    }

    /// <inheritdoc />
    public async Task<Result<RecipeResponse>> SaveRecipeAsync(
        Guid managerUserId,
        Guid menuItemId,
        SaveRecipeRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.NoRestaurantAssigned);
        }

        var menuItem = await _dbContext.MenuItems
            .AsNoTracking()
            .Where(candidate =>
                candidate.Id == menuItemId &&
                candidate.RestaurantId == restaurantId.Value)
            .Select(candidate => new { candidate.Id, candidate.Name })
            .SingleOrDefaultAsync(cancellationToken);

        if (menuItem is null)
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.MenuItemNotFound);
        }

        var submitted = request.Lines.Where(line => line.Quantity > 0).ToList();

        // Refused rather than summed. Two rows for the same ingredient are two answers
        // to one question, and adding them would hide whichever was wrong.
        if (submitted.Select(line => line.InventoryItemId).Distinct().Count()
            != submitted.Count)
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.DuplicateIngredient);
        }

        var ids = submitted.Select(line => line.InventoryItemId).ToList();

        // Loaded from the caller own shelves, so an ingredient from another restaurant
        // simply is not found.
        var ingredients = await ItemsOf(restaurantId.Value)
            .AsNoTracking()
            .Where(item => ids.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        if (ingredients.Count != ids.Distinct().Count())
        {
            return Result.Failure<RecipeResponse>(InventoryErrors.IngredientNotFound);
        }

        // Every unit checked before anything is written, so a rejected line cannot leave
        // a half-saved recipe behind.
        foreach (var line in submitted)
        {
            var ingredient = ingredients[line.InventoryItemId];

            if (!Units.CanConvert(line.Unit, ingredient.Unit))
            {
                return Result.Failure<RecipeResponse>(InventoryErrors.IncompatibleUnit(
                    ingredient.Name,
                    line.Unit.ToString(),
                    ingredient.Unit.ToString()));
            }
        }

        var existing = await _dbContext.MenuItemIngredients
            .Where(line =>
                line.MenuItemId == menuItemId &&
                line.RestaurantId == restaurantId.Value)
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;

        // The submitted lines become the recipe. Anything left out is removed, so an
        // editor is one save rather than a sequence that could fail half way.
        foreach (var line in existing)
        {
            var match = submitted.SingleOrDefault(
                candidate => candidate.InventoryItemId == line.InventoryItemId);

            if (match is null)
            {
                _dbContext.MenuItemIngredients.Remove(line);
                continue;
            }

            line.Quantity = match.Quantity;
            line.Unit = match.Unit;
            line.UpdatedAtUtc = now;
        }

        var existingIds = existing
            .Select(line => line.InventoryItemId)
            .ToHashSet();

        foreach (var line in submitted.Where(l => !existingIds.Contains(l.InventoryItemId)))
        {
            // Added through the set rather than a navigation: a Guid key is
            // store-generated by convention, so a row discovered hanging off a tracked
            // parent would be assumed to exist and updated instead of inserted.
            _dbContext.MenuItemIngredients.Add(new MenuItemIngredient
            {
                Id = Guid.CreateVersion7(),
                RestaurantId = restaurantId.Value,
                MenuItemId = menuItemId,
                InventoryItemId = line.InventoryItemId,
                Quantity = line.Quantity,
                Unit = line.Unit,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} saved a recipe for {MenuItem} with {Count} ingredient(s).",
            managerUserId,
            menuItem.Name,
            submitted.Count);

        var saved = await RecipeLinesOf(restaurantId.Value, menuItemId)
            .ToListAsync(cancellationToken);

        return Result.Success(ToRecipe(menuItem.Id, menuItem.Name, saved));
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<RecipeSummaryResponse>>> GetRecipeSummariesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<RecipeSummaryResponse>>(
                InventoryErrors.NoRestaurantAssigned);
        }

        var lines = await _dbContext.MenuItemIngredients
            .AsNoTracking()
            .Where(line => line.RestaurantId == restaurantId.Value)
            .Include(line => line.InventoryItem)
            .ToListAsync(cancellationToken);

        var summaries = lines
            .GroupBy(line => line.MenuItemId)
            .Select(group => new RecipeSummaryResponse(
                group.Key,
                group.Count(),
                PortionsFor(group),
                group.Any(line => line.InventoryItem.IsOutOfStock)))
            .ToList();

        return Result.Success<IReadOnlyList<RecipeSummaryResponse>>(summaries);
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// How many of a menu item the shelves could cover, decided by whichever ingredient
    /// runs out first.
    ///
    /// Floored, because half a portion is not a portion. Zero when anything is already
    /// short, which is honest: the kitchen can still be told to cook it, and the
    /// deduction will simply take the balance negative.
    /// </summary>
    private static int? PortionsFor(IEnumerable<MenuItemIngredient> lines)
    {
        var limits = lines
            .Select(line =>
            {
                var needed = line.QuantityInStockUnit();

                return needed <= 0
                    ? int.MaxValue
                    : (int)Math.Floor(line.InventoryItem.QuantityInStock / needed);
            })
            .ToList();

        if (limits.Count == 0)
        {
            return null;
        }

        return Math.Max(0, limits.Min());
    }

    private IQueryable<InventoryItem> ItemsOf(Guid restaurantId) =>
        _dbContext.InventoryItems.Where(item => item.RestaurantId == restaurantId);

    private IQueryable<MenuItemIngredient> RecipeLinesOf(Guid restaurantId, Guid menuItemId) =>
        _dbContext.MenuItemIngredients
            .AsNoTracking()
            .Where(line =>
                line.MenuItemId == menuItemId && line.RestaurantId == restaurantId)
            .Include(line => line.InventoryItem)
            .OrderBy(line => line.InventoryItem.Name);

    private Task<bool> NameExistsAsync(
        Guid restaurantId,
        string name,
        Guid? exceptId,
        CancellationToken cancellationToken) =>
        ItemsOf(restaurantId)
            .Where(item => exceptId == null || item.Id != exceptId)
            .AnyAsync(item => item.Name == name, cancellationToken);

    /// <summary>How many recipes name each item, in one query.</summary>
    private async Task<Dictionary<Guid, int>> RecipeUsageAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.MenuItemIngredients
            .AsNoTracking()
            .Where(line => line.RestaurantId == restaurantId)
            .GroupBy(line => line.InventoryItemId)
            .Select(group => new { InventoryItemId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(row => row.InventoryItemId, row => row.Count);
    }

    /// <summary>How many movements each item has, and when the last one was.</summary>
    private async Task<Dictionary<Guid, (int Count, DateTimeOffset Last)>> MovementStatsAsync(
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.StockMovements
            .AsNoTracking()
            .Where(movement => movement.RestaurantId == restaurantId)
            .GroupBy(movement => movement.InventoryItemId)
            .Select(group => new
            {
                InventoryItemId = group.Key,
                Count = group.Count(),
                Last = group.Max(movement => movement.RecordedAtUtc),
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            row => row.InventoryItemId,
            row => (row.Count, row.Last));
    }

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

    /* --------------------------------------------------------------------- Images */

    /// <inheritdoc />
    public async Task<Result<InventoryItemResponse>> SetItemImageAsync(
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
            return Result.Failure<InventoryItemResponse>(InventoryErrors.NoRestaurantAssigned);
        }

        if (length <= 0)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ImageEmpty);
        }

        // Checked before reading, so an oversized upload is refused without being
        // pulled into memory first.
        if (length > InventoryItem.MaxImageBytes)
        {
            return Result.Failure<InventoryItemResponse>(
                InventoryErrors.ImageTooLarge(InventoryItem.MaxImageBytes));
        }

        if (!ImageMedia.AllowedTypes.ContainsKey(contentType))
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ImageTypeNotAllowed);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ItemNotFound);
        }

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        // The declared length is what the client claimed. This is what actually
        // arrived, and it is the one the limit has to hold against.
        if (bytes.Length == 0)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ImageEmpty);
        }

        if (bytes.Length > InventoryItem.MaxImageBytes)
        {
            return Result.Failure<InventoryItemResponse>(
                InventoryErrors.ImageTooLarge(InventoryItem.MaxImageBytes));
        }

        // The browser's content type is a claim, not a fact. This checks the bytes
        // begin the way that type should, so nothing can be stored as a picture and
        // served back as something the browser would run.
        if (!ImageMedia.LooksLikeImage(bytes, contentType))
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ImageTypeNotAllowed);
        }

        var now = DateTimeOffset.UtcNow;

        var existing = await _dbContext.InventoryItemImages
            .SingleOrDefaultAsync(image => image.InventoryItemId == itemId, cancellationToken);

        if (existing is null)
        {
            _dbContext.InventoryItemImages.Add(new InventoryItemImage
            {
                InventoryItemId = item.Id,
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

        // Written in the same transaction as the row above. The stamp is what every
        // listing reads to know a picture exists, and it is the cache version in the
        // URL, so the two must never be saved apart.
        item.ImageUpdatedAtUtc = now;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} set a {ByteCount} byte picture on inventory item {ItemId}.",
            managerUserId,
            bytes.Length,
            itemId);

        return Result.Success(await ToResponseWithStatsAsync(item, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<InventoryItemResponse>> RemoveItemImageAsync(
        Guid managerUserId,
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.NoRestaurantAssigned);
        }

        var item = await ItemsOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == itemId, cancellationToken);

        if (item is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ItemNotFound);
        }

        if (item.ImageUpdatedAtUtc is null)
        {
            return Result.Failure<InventoryItemResponse>(InventoryErrors.ImageNotFound);
        }

        // Deleted by key rather than loaded and removed, so the bytes never travel
        // back from the database only to be thrown away.
        await _dbContext.InventoryItemImages
            .Where(image => image.InventoryItemId == itemId)
            .ExecuteDeleteAsync(cancellationToken);

        item.ImageUpdatedAtUtc = null;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} removed the picture from inventory item {ItemId}.",
            managerUserId,
            itemId);

        return Result.Success(await ToResponseWithStatsAsync(item, cancellationToken));
    }

    /// <inheritdoc />
    public async Task<Result<(byte[] Content, string ContentType)>> GetItemImageBytesAsync(
        Guid itemId,
        CancellationToken cancellationToken)
    {
        var image = await _dbContext.InventoryItemImages
            .AsNoTracking()
            .Where(candidate => candidate.InventoryItemId == itemId)
            .Select(candidate => new { candidate.Content, candidate.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        return image is null
            ? Result.Failure<(byte[], string)>(InventoryErrors.ImageNotFound)
            : Result.Success((image.Content, image.ContentType));
    }

    /* ------------------------------------------------------------------- Mapping */

    /// <summary>
    /// Where an item's picture is served from, or null when it has none.
    ///
    /// The stamp in the query string is the whole reason a replacement is ever seen.
    /// The bytes at this path do change, so the response is cached for a year against
    /// a URL that changes with them, rather than being revalidated on every render of
    /// a list that might hold two hundred of these.
    /// </summary>
    private static string? ImageUrlFor(InventoryItem item) =>
        item.ImageUpdatedAtUtc is null
            ? null
            : $"/api/inventory/items/{item.Id}/image?v={item.ImageUpdatedAtUtc.Value.UtcTicks}";


    private static InventoryItemResponse ToResponse(
        InventoryItem item,
        IReadOnlyDictionary<Guid, int> usage,
        IReadOnlyDictionary<Guid, (int Count, DateTimeOffset Last)> movements)
    {
        var stats = movements.TryGetValue(item.Id, out var found)
            ? found
            : (Count: 0, Last: default(DateTimeOffset));

        return new InventoryItemResponse(
            item.Id,
            item.Name,
            item.Unit,
            item.QuantityInStock,
            item.MinimumQuantity,
            item.IsActive,
            item.IsLowStock,
            item.IsOutOfStock,
            item.IsNegative,
            usage.TryGetValue(item.Id, out var uses) ? uses : 0,
            stats.Count,
            stats.Count == 0 ? null : stats.Last,
            item.CreatedAtUtc,
            item.UpdatedAtUtc,
            ImageUrlFor(item));
    }

    private async Task<InventoryItemResponse> ToResponseWithStatsAsync(
        InventoryItem item,
        CancellationToken cancellationToken)
    {
        var usage = await RecipeUsageAsync(item.RestaurantId, cancellationToken);
        var movements = await MovementStatsAsync(item.RestaurantId, cancellationToken);

        return ToResponse(item, usage, movements);
    }

    private async Task<InventoryItemDetailResponse> ToDetailAsync(
        InventoryItem item,
        CancellationToken cancellationToken)
    {
        var movements = await _dbContext.StockMovements
            .AsNoTracking()
            .Where(movement => movement.InventoryItemId == item.Id)
            .OrderByDescending(movement => movement.RecordedAtUtc)
            .Take(MovementLimit)
            .ToListAsync(cancellationToken);

        // Staff are not a navigation on a movement, so the names are looked up. Order
        // numbers likewise, and only for the movements that reference one.
        var userIds = movements
            .Select(movement => movement.RecordedByUserId)
            .Distinct()
            .ToList();

        var names = userIds.Count == 0
            ? []
            : await _dbContext.Users
                .AsNoTracking()
                .Where(user => userIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id, user => user.FullName, cancellationToken);

        var orderIds = movements
            .Where(movement => movement.OrderId is not null)
            .Select(movement => movement.OrderId!.Value)
            .Distinct()
            .ToList();

        var orderNumbers = orderIds.Count == 0
            ? []
            : await _dbContext.Orders
                .AsNoTracking()
                .Where(order => orderIds.Contains(order.Id))
                .ToDictionaryAsync(order => order.Id, order => order.OrderNumber, cancellationToken);

        return new InventoryItemDetailResponse(
            await ToResponseWithStatsAsync(item, cancellationToken),
            movements
                .Select(movement => new StockMovementResponse(
                    movement.Id,
                    movement.Kind,
                    movement.QuantityDelta,
                    movement.QuantityAfter,
                    movement.Unit,
                    movement.Reason,
                    movement.OrderId,
                    movement.OrderId is not null
                        && orderNumbers.TryGetValue(movement.OrderId.Value, out var number)
                            ? number
                            : null,
                    names.TryGetValue(movement.RecordedByUserId, out var name)
                        ? name
                        : "Unknown",
                    movement.RecordedAtUtc))
                .ToList());
    }

    private static RecipeResponse ToRecipe(
        Guid menuItemId,
        string menuItemName,
        IReadOnlyList<MenuItemIngredient> lines) =>
        new(
            menuItemId,
            menuItemName,
            lines
                .Select(line => new RecipeLineResponse(
                    line.Id,
                    line.InventoryItemId,
                    line.InventoryItem.Name,
                    line.Quantity,
                    line.Unit,
                    line.InventoryItem.Unit,
                    line.QuantityInStockUnit(),
                    line.InventoryItem.QuantityInStock,
                    line.InventoryItem.IsActive,
                    PortionsFor([line])))
                .ToList(),
            lines.Count == 0 ? null : PortionsFor(lines),
            lines.Any(line => line.InventoryItem.IsOutOfStock));
}
