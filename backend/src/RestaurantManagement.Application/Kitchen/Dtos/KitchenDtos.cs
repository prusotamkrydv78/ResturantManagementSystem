using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Application.Kitchen.Dtos;

/// <summary>
/// One line as the kitchen reads it.
///
/// No price and no menu identifier: the kitchen cooks food, it does not sell it,
/// and money on a kitchen screen is noise at best. These are the snapshots taken
/// when the waiter submitted, so a later menu change cannot rewrite what the
/// kitchen was asked to make.
/// </summary>
/// <param name="ItemName">What to cook.</param>
/// <param name="Quantity">How many.</param>
/// <param name="Note">The guest instruction, when there is one.</param>
public sealed record KitchenTicketItemResponse(
    string ItemName,
    int Quantity,
    string? Note);

/// <summary>
/// A ticket on the kitchen rail.
///
/// Carries the order number and table name so the food can be matched to a table
/// without a second request, but nothing else about the order: the kitchen has no
/// business with totals, who took the order, or what else that table is drinking.
/// </summary>
/// <param name="Id">Identifier, used by the start and ready operations.</param>
/// <param name="TicketNumber">The number the kitchen calls out.</param>
/// <param name="Status">Where the ticket sits in the kitchen workflow.</param>
/// <param name="OrderNumber">The order this came from.</param>
/// <param name="TableName">Where the food is going.</param>
/// <param name="ItemCount">Total units on the ticket.</param>
/// <param name="CreatedAtUtc">When the waiter sent it.</param>
/// <param name="StartedAtUtc">When cooking began. Null while it is waiting.</param>
/// <param name="ReadyAtUtc">When it reached the pass. Null until then.</param>
/// <param name="ServedAtUtc">
/// When a waiter carried it to the table, or null while it is still sitting at the pass.
///
/// The kitchen's business after all, even though serving is floor work: a plate that has
/// been taken away has left the pass, and a rail that cannot tell the difference shows a
/// kitchen food it has already got rid of.
/// </param>
/// <param name="Items">What to cook.</param>
public sealed record KitchenTicketResponse(
    Guid Id,
    int TicketNumber,
    KitchenTicketStatus Status,
    int OrderNumber,
    string TableName,
    int ItemCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? ReadyAtUtc,
    DateTimeOffset? ServedAtUtc,
    IReadOnlyList<KitchenTicketItemResponse> Items);
