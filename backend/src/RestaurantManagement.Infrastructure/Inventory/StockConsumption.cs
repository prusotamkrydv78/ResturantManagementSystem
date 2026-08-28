using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Domain.Inventory;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.Infrastructure.Inventory;

/// <summary>
/// Taking ingredients off the shelf for food the kitchen has been told to cook.
///
/// Shares the caller context, so the deductions commit in the same transaction as the
/// kitchen ticket that caused them. Nothing here saves.
/// </summary>
public sealed class StockConsumption : IStockConsumption
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<StockConsumption> _logger;

    /// <summary>Creates the service.</summary>
    public StockConsumption(
        ApplicationDbContext dbContext,
        ILogger<StockConsumption> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task ApplyAsync(
        Guid restaurantId,
        Guid orderId,
        Guid kitchenTicketId,
        IReadOnlyList<ConsumedLine> lines,
        Guid recordedByUserId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (lines.Count == 0)
        {
            return;
        }

        // Several lines on one ticket can be the same menu item with different notes, so
        // the quantities are folded together first. Otherwise one ingredient would get
        // two movements for one submission, which is correct arithmetic but unreadable
        // history.
        var wanted = lines
            .Where(line => line.Quantity > 0)
            .GroupBy(line => line.MenuItemId)
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity));

        if (wanted.Count == 0)
        {
            return;
        }

        var menuItemIds = wanted.Keys.ToList();

        // Tracked, because the balances are about to move. Filtered by restaurant as
        // well as by menu item, so a recipe from elsewhere could not be reached even if
        // an identifier leaked.
        var recipeLines = await _dbContext.MenuItemIngredients
            .Where(line =>
                line.RestaurantId == restaurantId &&
                menuItemIds.Contains(line.MenuItemId))
            .Include(line => line.InventoryItem)
            .ToListAsync(cancellationToken);

        if (recipeLines.Count == 0)
        {
            // Nothing on this ticket has a recipe. Ordinary for anything sold as it
            // comes, and not worth a log line.
            return;
        }

        // One movement per ingredient per submission, whatever it appears in. A burger
        // and a cheeseburger both taking cheese produce one cheese movement, which is
        // how a person would read it off a ticket.
        var totals = new Dictionary<Guid, (InventoryItem Item, decimal Quantity)>();

        foreach (var line in recipeLines)
        {
            var portions = wanted[line.MenuItemId];
            var needed = line.QuantityInStockUnit() * portions;

            if (needed <= 0)
            {
                continue;
            }

            if (totals.TryGetValue(line.InventoryItemId, out var running))
            {
                totals[line.InventoryItemId] = (running.Item, running.Quantity + needed);
            }
            else
            {
                totals[line.InventoryItemId] = (line.InventoryItem, needed);
            }
        }

        foreach (var (item, quantity) in totals.Values)
        {
            var before = item.QuantityInStock;

            _dbContext.StockMovements.Add(item.Apply(
                StockMovementKind.Consumed,
                -quantity,
                recordedByUserId,
                now,
                orderId: orderId,
                kitchenTicketId: kitchenTicketId));

            // Worth saying out loud when the shelf could not actually cover it. The
            // submission still goes through, and this is the trail back to why a balance
            // is negative.
            if (before >= 0 && item.QuantityInStock < 0)
            {
                _logger.LogWarning(
                    "Consuming {Quantity} {Unit} of {Name} for order {OrderId} took its " +
                    "stock below zero, from {Before} to {After}. The records held less " +
                    "than the kitchen was told to cook.",
                    quantity,
                    item.Unit,
                    item.Name,
                    orderId,
                    before,
                    item.QuantityInStock);
            }
        }
    }
}
