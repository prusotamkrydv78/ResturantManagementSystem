using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Tables;
using RestaurantManagement.Application.Tables.Dtos;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Tables;

/// <summary>
/// Table administration for a restaurant manager.
///
/// Isolation works the same way as staff administration: the restaurant is derived
/// from the manager and every read and write is filtered by it, so a table
/// identifier from elsewhere simply does not match.
/// </summary>
public sealed class TableService : ITableService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<TableService> _logger;

    /// <summary>Creates the service.</summary>
    public TableService(ApplicationDbContext dbContext, ILogger<TableService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<TableResponse>>> GetAllAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<TableResponse>>(
                TableErrors.NoRestaurantAssigned);
        }

        var tables = await TablesOf(restaurantId.Value)
            .AsNoTracking()
            .OrderBy(table => table.Name)
            .Select(table => new TableResponse(
                table.Id,
                table.Name,
                table.Capacity,
                table.Status,
                table.IsActive,
                table.IsOrderingEnabled,
                table.PublicOrderingToken,
                table.CreatedAtUtc,
                table.UpdatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<TableResponse>>(tables);
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> GetByIdAsync(
        Guid managerUserId,
        Guid tableId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NoRestaurantAssigned);
        }

        var table = await TablesOf(restaurantId.Value)
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == tableId, cancellationToken);

        return table is null
            ? Result.Failure<TableResponse>(TableErrors.NotFound)
            : Result.Success(ToResponse(table));
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> CreateAsync(
        Guid managerUserId,
        CreateTableRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NoRestaurantAssigned);
        }

        var name = request.Name.Trim();

        // Checked here so the caller gets a clear message rather than a unique index
        // violation. The index remains the real guarantee.
        if (await NameExistsAsync(restaurantId.Value, name, null, cancellationToken))
        {
            return Result.Failure<TableResponse>(TableErrors.NameTaken);
        }

        var now = DateTimeOffset.UtcNow;

        var table = new RestaurantTable
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            Name = name,
            Capacity = request.Capacity,
            // Occupancy starts empty and is not something the request can set.
            Status = TableStatus.Available,
            IsActive = true,
            // Every table gets a token the moment it exists, so a manager who decides
            // months later to put a code on it has nothing to set up. Guest ordering
            // itself starts off: holding a token is not the same as inviting the public,
            // and a restaurant that has never thought about self-service should not find
            // it switched on because a table was added.
            PublicOrderingToken = PublicOrderingToken.Create(),
            IsOrderingEnabled = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.RestaurantTables.Add(table);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Added table {TableId} ({Name}) to restaurant {RestaurantId}.",
            table.Id,
            table.Name,
            restaurantId.Value);

        return Result.Success(ToResponse(table));
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> UpdateAsync(
        Guid managerUserId,
        Guid tableId,
        UpdateTableRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NoRestaurantAssigned);
        }

        var table = await TablesOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == tableId, cancellationToken);

        if (table is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NotFound);
        }

        var name = request.Name.Trim();

        if (await NameExistsAsync(restaurantId.Value, name, table.Id, cancellationToken))
        {
            return Result.Failure<TableResponse>(TableErrors.NameTaken);
        }

        // Only these two change. Restaurant, occupancy and active state are not
        // touched by an edit.
        table.Name = name;
        table.Capacity = request.Capacity;
        table.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Updated table {TableId}.", table.Id);

        return Result.Success(ToResponse(table));
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> SetActiveAsync(
        Guid managerUserId,
        Guid tableId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NoRestaurantAssigned);
        }

        var table = await TablesOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == tableId, cancellationToken);

        if (table is null)
        {
            return Result.Failure<TableResponse>(TableErrors.NotFound);
        }

        table.IsActive = isActive;
        table.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Table {TableId} {State}.",
            table.Id,
            isActive ? "returned to service" : "withdrawn from service");

        return Result.Success(ToResponse(table));
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> SetOrderingAsync(
        Guid managerUserId,
        Guid tableId,
        bool isOrderingEnabled,
        CancellationToken cancellationToken)
    {
        var found = await LoadAsync(managerUserId, tableId, cancellationToken);

        if (found.IsFailure)
        {
            return Result.Failure<TableResponse>(found.Error!);
        }

        var table = found.Value;

        // The token is deliberately left alone. Switching off for the night and on again
        // in the morning must not mean reprinting the cards on every table.
        table.IsOrderingEnabled = isOrderingEnabled;
        table.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Guest ordering {State} for table {TableId}.",
            isOrderingEnabled ? "switched on" : "switched off",
            table.Id);

        return Result.Success(ToResponse(table));
    }

    /// <inheritdoc />
    public async Task<Result<TableResponse>> RegenerateOrderingTokenAsync(
        Guid managerUserId,
        Guid tableId,
        CancellationToken cancellationToken)
    {
        var found = await LoadAsync(managerUserId, tableId, cancellationToken);

        if (found.IsFailure)
        {
            return Result.Failure<TableResponse>(found.Error!);
        }

        var table = found.Value;

        table.PublicOrderingToken = PublicOrderingToken.Create();
        table.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        // The old token is gone rather than kept alongside the new one. A code that was
        // photographed has to stop working, and two live tokens for one table would mean
        // it did not.
        _logger.LogInformation(
            "Issued a new ordering token for table {TableId}; every printed code for it " +
            "is now invalid.",
            table.Id);

        return Result.Success(ToResponse(table));
    }

    /// <summary>
    /// Loads one of the caller own tables for writing, or reports why not.
    ///
    /// Written once because the two ordering actions need exactly the same two checks, and
    /// a second copy of them is a second place for one to drift.
    /// </summary>
    private async Task<Result<RestaurantTable>> LoadAsync(
        Guid managerUserId,
        Guid tableId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<RestaurantTable>(TableErrors.NoRestaurantAssigned);
        }

        var table = await TablesOf(restaurantId.Value)
            .SingleOrDefaultAsync(candidate => candidate.Id == tableId, cancellationToken);

        return table is null
            ? Result.Failure<RestaurantTable>(TableErrors.NotFound)
            : Result.Success(table);
    }

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

    /// <summary>The tables of one restaurant, and nothing else.</summary>
    private IQueryable<RestaurantTable> TablesOf(Guid restaurantId) =>
        _dbContext.RestaurantTables.Where(table => table.RestaurantId == restaurantId);

    /// <summary>
    /// Whether the name is already used in this restaurant, optionally ignoring the
    /// table being edited.
    /// </summary>
    private Task<bool> NameExistsAsync(
        Guid restaurantId,
        string name,
        Guid? exceptTableId,
        CancellationToken cancellationToken) =>
        TablesOf(restaurantId)
            .Where(table => exceptTableId == null || table.Id != exceptTableId)
            .AnyAsync(table => table.Name == name, cancellationToken);

    private static TableResponse ToResponse(RestaurantTable table) =>
        new(
            table.Id,
            table.Name,
            table.Capacity,
            table.Status,
            table.IsActive,
            table.IsOrderingEnabled,
            table.PublicOrderingToken,
            table.CreatedAtUtc,
            table.UpdatedAtUtc);
}
