using RestaurantManagement.Application.Kitchen.Dtos;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Kitchen;

/// <summary>
/// The chef kitchen workflow.
///
/// Every method takes the authenticated staff identifier and derives the restaurant
/// from it, the same way ordering and every administration module do. No method
/// accepts a restaurant identifier, and the caller must be an active chef: a
/// deactivated account is refused here as well as at sign in, so an access token
/// issued moments before deactivation cannot be used to work the kitchen.
///
/// The kitchen reads and writes tickets only. It never touches an order, an order
/// line, or the snapshots on either: what the guest asked for is settled by the
/// time it reaches the pass window.
/// </summary>
public interface IKitchenService
{
    /// <summary>
    /// The kitchen queue for the caller restaurant.
    ///
    /// Without a filter this is live work only: tickets waiting and tickets being
    /// cooked. Ready tickets are finished as far as the kitchen is concerned and
    /// would only push live work down the screen, so they are left out unless asked
    /// for explicitly.
    ///
    /// Ordered the way a kitchen works rather than by time alone: what is already on
    /// the stove first, then what is waiting, oldest first within each group so
    /// nothing gets buried.
    /// </summary>
    Task<Result<IReadOnlyList<KitchenTicketResponse>>> GetQueueAsync(
        Guid staffUserId,
        KitchenTicketStatus? status,
        CancellationToken cancellationToken);

    /// <summary>Loads one ticket belonging to the caller restaurant.</summary>
    Task<Result<KitchenTicketResponse>> GetByIdAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Starts cooking a waiting ticket.
    ///
    /// Refused when the ticket is not waiting, which is what happens when another
    /// chef reached it first. Two chefs starting the same ticket at the same instant
    /// cannot both succeed.
    /// </summary>
    Task<Result<KitchenTicketResponse>> StartAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Sends a ticket being cooked to the pass.
    ///
    /// Refused for a ticket nobody started: skipping the middle state would leave a
    /// finished ticket with no record of when the work began. This does not change
    /// the order, which stays open, and does not mark anything served.
    /// </summary>
    Task<Result<KitchenTicketResponse>> MarkReadyAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Records that one dish on a ticket is cooked.
    ///
    /// The point of per-line state: a table's momo and samosa are on one slip and are
    /// done fifteen minutes apart, and a ticket that could only be all-cooked or
    /// not-cooked left the kitchen choosing between a cold samosa and a raw momo. The
    /// ticket reaches Ready by itself when the last dish is ticked.
    ///
    /// Refused for a dish already cooked, so two chefs ticking the same line cannot
    /// both claim it.
    /// </summary>
    Task<Result<KitchenTicketResponse>> MarkItemReadyAsync(
        Guid staffUserId,
        Guid ticketId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Puts one cooked dish back on the stove.
    ///
    /// The undo for the tick above. Refused once a waiter has carried that dish.
    /// </summary>
    Task<Result<KitchenTicketResponse>> RecallItemAsync(
        Guid staffUserId,
        Guid ticketId,
        Guid itemId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Takes a ticket back off the pass and puts it back on the stove.
    ///
    /// The undo for the one step on this screen that is easy to tap by mistake and
    /// expensive to get wrong. Refused once a waiter has carried the food, because at
    /// that point it is on a table.
    /// </summary>
    Task<Result<KitchenTicketResponse>> RecallAsync(
        Guid staffUserId,
        Guid ticketId,
        CancellationToken cancellationToken);
}
