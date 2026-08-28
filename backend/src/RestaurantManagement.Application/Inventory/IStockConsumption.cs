namespace RestaurantManagement.Application.Inventory;

/// <summary>One menu item, and how many of it the kitchen was told to make.</summary>
/// <param name="MenuItemId">The menu item, which may or may not have a recipe.</param>
/// <param name="Quantity">How many.</param>
public readonly record struct ConsumedLine(Guid MenuItemId, int Quantity);

/// <summary>
/// Taking ingredients off the shelf for food the kitchen has been told to cook.
///
/// Deducting happens when a waiter submits to the kitchen, and nowhere else. That is
/// the moment the ingredients are committed: the kitchen has been instructed, and the
/// submitted lines are already locked against editing, so the deduction cannot be
/// invalidated afterwards. Deducting at order creation would take stock for food that
/// may never be cooked, and deducting at payment would take it long after it was used.
///
/// Short stock never blocks a submission. A restaurant mid-service whose counts are
/// slightly off must still be able to send food to the kitchen; refusing would turn a
/// bookkeeping discrepancy into a stopped service. The balance goes negative instead,
/// which is a true statement that more was cooked than the records held, and the
/// manager sees it as exactly that.
///
/// This deliberately does not save. It mutates the tracked entities so the caller
/// commits the deduction in the same transaction as the ticket that caused it: a ticket
/// without its deduction, or a deduction without its ticket, are both states this
/// product must never hold.
/// </summary>
public interface IStockConsumption
{
    /// <summary>
    /// Applies the consumption for a submission, leaving it uncommitted.
    ///
    /// Lines whose menu item has no recipe consume nothing, which is the ordinary case
    /// for anything sold as it comes.
    /// </summary>
    /// <param name="restaurantId">The restaurant whose shelves to draw from.</param>
    /// <param name="orderId">The order being cooked for, recorded on each movement.</param>
    /// <param name="kitchenTicketId">The submission that caused it.</param>
    /// <param name="lines">What the kitchen was told to make.</param>
    /// <param name="recordedByUserId">The waiter who submitted.</param>
    /// <param name="now">The instant to stamp on the movements.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task ApplyAsync(
        Guid restaurantId,
        Guid orderId,
        Guid kitchenTicketId,
        IReadOnlyList<ConsumedLine> lines,
        Guid recordedByUserId,
        DateTimeOffset now,
        CancellationToken cancellationToken);
}
