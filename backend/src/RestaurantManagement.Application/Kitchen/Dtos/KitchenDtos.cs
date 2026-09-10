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
/// <param name="Id">
/// Identifier, so a screen can tick off this dish rather than the whole slip.
/// </param>
/// <param name="ItemName">What to cook.</param>
/// <param name="Quantity">How many.</param>
/// <param name="Note">The guest instruction, when there is one.</param>
/// <param name="Course">
/// The menu course this dish came from, as it was named at submission.
///
/// What lets a rail be divided. A kitchen screen showing every dish in the building is
/// unusable in a rush, and the course is the division a restaurant has already made -
/// so the grill can work Main Course without scrolling past the cold starters.
/// </param>
/// <param name="ReadyAtUtc">
/// When this dish was cooked, or null while it is still being made.
///
/// Per dish rather than per slip, because that is where cooking finishes. Momo and
/// samosa on one ticket are done fifteen minutes apart, and a ticket that could only
/// be all-cooked or not-cooked left the kitchen choosing between a cold samosa and a
/// raw momo.
/// </param>
/// <param name="ServedAtUtc">
/// When a waiter carried this dish to the table, or null while it is at the pass.
/// </param>
public sealed record KitchenTicketItemResponse(
    Guid Id,
    string ItemName,
    int Quantity,
    string? Note,
    string? Course,
    DateTimeOffset? ReadyAtUtc,
    DateTimeOffset? ServedAtUtc);

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
/// <param name="ReadyItemCount">
/// How many of the lines are cooked. What turns a rail card from all-or-nothing into
/// "two of three done", which is the state a kitchen is actually in most of the time.
/// </param>
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
    int ReadyItemCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? ReadyAtUtc,
    DateTimeOffset? ServedAtUtc,
    IReadOnlyList<KitchenTicketItemResponse> Items);
