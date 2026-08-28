using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Application.Orders.Dtos;

/// <summary>Bounds applied to a submitted order line.</summary>
public static class OrderLimits
{
    /// <summary>Smallest quantity on a line.</summary>
    public const int MinQuantity = 1;

    /// <summary>Largest quantity on a line. A sanity bound, not a business rule.</summary>
    public const int MaxQuantity = 99;

    /// <summary>Longest guest instruction accepted on a line.</summary>
    public const int MaxNoteLength = 200;
}

/* -------------------------------------------------------------------------- */
/* Reads the waiter needs                                                     */
/* -------------------------------------------------------------------------- */

/// <summary>
/// What the waiter workspace needs to orient itself, without pulling the whole
/// menu.
/// </summary>
/// <param name="RestaurantName">The restaurant the waiter works in.</param>
/// <param name="ActiveTableCount">Tables currently in service.</param>
/// <param name="AvailableItemCount">Menu items currently orderable.</param>
public sealed record WaiterContextResponse(
    string RestaurantName,
    int ActiveTableCount,
    int AvailableItemCount);

/// <summary>A table a waiter may open an order on.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What staff call the table.</param>
/// <param name="Capacity">How many it seats.</param>
public sealed record WaiterTableResponse(Guid Id, string Name, int Capacity);

/// <summary>A menu item a waiter may order.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional description.</param>
/// <param name="Price">
/// Current price, for display and for the running total the waiter sees. The server
/// re-reads it when the order is created and never trusts a price from a request.
/// </param>
public sealed record WaiterMenuItemResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price);

/// <summary>
/// A category with the items a waiter may order from it. Only active categories
/// holding at least one active item appear.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Items">The orderable items.</param>
public sealed record WaiterMenuCategoryResponse(
    Guid Id,
    string Name,
    IReadOnlyList<WaiterMenuItemResponse> Items);

/* -------------------------------------------------------------------------- */
/* Order creation                                                             */
/* -------------------------------------------------------------------------- */

/// <summary>One line the waiter is asking for.</summary>
public sealed class CreateOrderItemRequest
{
    /// <summary>The menu item. Validated against the caller own available menu.</summary>
    [Required(ErrorMessage = "Choose an item.")]
    public Guid MenuItemId { get; set; }

    /// <summary>How many.</summary>
    [Range(
        OrderLimits.MinQuantity,
        OrderLimits.MaxQuantity,
        ErrorMessage = "Quantity must be between 1 and 99.")]
    public int Quantity { get; set; }

    /// <summary>Optional guest instruction, such as "no ice".</summary>
    [StringLength(
        OrderLimits.MaxNoteLength,
        ErrorMessage = "A note cannot be longer than 200 characters.")]
    public string? Note { get; set; }
}

/// <summary>
/// Payload for placing an order.
///
/// There is deliberately no restaurant field, no price field and no total: the
/// restaurant comes from the authenticated waiter, and every amount is calculated
/// by the server from its own menu.
/// </summary>
public sealed class CreateOrderRequest
{
    /// <summary>The table the order is for. Must be in service in the caller restaurant.</summary>
    [Required(ErrorMessage = "Choose a table.")]
    public Guid TableId { get; set; }

    /// <summary>The lines. At least one is required.</summary>
    [Required(ErrorMessage = "Add at least one item.")]
    [MinLength(1, ErrorMessage = "Add at least one item.")]
    public List<CreateOrderItemRequest> Items { get; set; } = [];
}

/* -------------------------------------------------------------------------- */
/* Order reads                                                                */
/* -------------------------------------------------------------------------- */

/// <summary>One line of a placed order, as recorded at the time.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="MenuItemId">The item it came from.</param>
/// <param name="ItemName">Name as it was when ordered.</param>
/// <param name="UnitPrice">Price as it was when ordered.</param>
/// <param name="Quantity">How many.</param>
/// <param name="Note">Optional guest instruction.</param>
/// <param name="LineTotal">Quantity multiplied by the recorded price.</param>
/// <param name="IsSubmittedToKitchen">
/// Whether this line has been sent to the kitchen. Once it has, it is history.
/// </param>
/// <param name="KitchenTicketNumber">
/// The ticket it went out on, or null while unsubmitted. Given as the number the
/// kitchen calls out rather than an identifier, so the interface has nothing to
/// infer.
/// </param>
/// <param name="IsEditable">
/// Whether a waiter may still change this particular line. Decided by the server
/// from both the order state and the submission state, so the client never has to
/// work the rule out for itself.
/// </param>
public sealed record OrderItemResponse(
    Guid Id,
    Guid MenuItemId,
    string ItemName,
    decimal UnitPrice,
    int Quantity,
    string? Note,
    decimal LineTotal,
    bool IsSubmittedToKitchen,
    int? KitchenTicketNumber,
    bool IsEditable);

/// <summary>One line on a kitchen ticket, as the kitchen was told it.</summary>
/// <param name="ItemName">Item name at submission.</param>
/// <param name="Quantity">How many were sent.</param>
/// <param name="Note">The instruction given, if any.</param>
public sealed record KitchenTicketItemResponse(
    string ItemName,
    int Quantity,
    string? Note);

/// <summary>One submission of order lines to the kitchen.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="TicketNumber">The number the kitchen calls out.</param>
/// <param name="Status">Ticket state, separate from the order state.</param>
/// <param name="ItemCount">How many units went out on it.</param>
/// <param name="CreatedAtUtc">When it was sent.</param>
/// <param name="Items">What was sent.</param>
public sealed record KitchenTicketResponse(
    Guid Id,
    int TicketNumber,
    KitchenTicketStatus Status,
    int ItemCount,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<KitchenTicketItemResponse> Items);

/* -------------------------------------------------------------------------- */
/* Order editing                                                              */
/* -------------------------------------------------------------------------- */

/// <summary>
/// An existing line the waiter wants to keep.
///
/// Carries only what may change. There is deliberately no item name, unit price,
/// line total or menu item field: a historical line keeps the snapshot taken when
/// it was created, and the contract makes altering it impossible rather than merely
/// discouraged. Swapping one item for another means removing this line and adding
/// the other item.
/// </summary>
public sealed class UpdateOrderLineRequest
{
    /// <summary>The existing line. Must belong to the order being updated.</summary>
    [Required(ErrorMessage = "A line identifier is required.")]
    public Guid Id { get; set; }

    /// <summary>How many. The stored unit price is reused when this changes.</summary>
    [Range(
        OrderLimits.MinQuantity,
        OrderLimits.MaxQuantity,
        ErrorMessage = "Quantity must be between 1 and 99.")]
    public int Quantity { get; set; }

    /// <summary>Optional guest instruction. Null or blank clears it.</summary>
    [StringLength(
        OrderLimits.MaxNoteLength,
        ErrorMessage = "A note cannot be longer than 200 characters.")]
    public string? Note { get; set; }
}

/// <summary>
/// Payload for updating an open order.
///
/// The waiter submits the state they want, so a line left out of
/// <see cref="Lines"/> is removed. Nothing here can change the table, the
/// restaurant, who placed the order, or any snapshot on an existing line.
/// </summary>
public sealed class UpdateOrderRequest
{
    /// <summary>
    /// The existing lines to keep, with their current quantity and note. Omitting a
    /// line removes it.
    /// </summary>
    public List<UpdateOrderLineRequest> Lines { get; set; } = [];

    /// <summary>
    /// Menu items being added now. These are validated against the live menu and
    /// get a fresh name and price snapshot.
    /// </summary>
    public List<CreateOrderItemRequest> NewItems { get; set; } = [];

    /// <summary>
    /// The row version the client loaded, so a save based on stale data is refused
    /// instead of overwriting someone else work. Optional; omitting it skips the
    /// check.
    /// </summary>
    public string? RowVersion { get; set; }
}

/* -------------------------------------------------------------------------- */
/* Order reads                                                                */
/* -------------------------------------------------------------------------- */

/// <summary>A placed order with its lines.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">Readable number, unique within the restaurant.</param>
/// <param name="Status">Lifecycle state.</param>
/// <param name="TableId">The table.</param>
/// <param name="TableName">What staff call the table.</param>
/// <param name="Subtotal">Server-calculated sum of the lines.</param>
/// <param name="ItemCount">How many units in total.</param>
/// <param name="CreatedByName">The waiter who placed it.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
/// <param name="UpdatedAtUtc">When it was last changed.</param>
/// <param name="IsEditable">
/// Whether a waiter may still change it. Derived from the status by the server, so
/// the client never has to infer the rule.
/// </param>
/// <param name="RowVersion">
/// Send this back with an update so a save based on stale data is refused.
/// </param>
/// <param name="UnsubmittedItemCount">
/// How many units have not gone to the kitchen yet. What the submit action offers
/// to send.
/// </param>
/// <param name="CanSubmitToKitchen">
/// Whether a submission would do anything right now. Server-decided, so the
/// interface does not have to combine rules itself.
/// </param>
/// <param name="Items">The lines.</param>
/// <param name="KitchenTickets">
/// Submissions this order has produced, newest first. Read-only history from the
/// waiter side.
/// </param>
public sealed record OrderResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    Guid TableId,
    string TableName,
    decimal Subtotal,
    int ItemCount,
    string CreatedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    bool IsEditable,
    string RowVersion,
    int UnsubmittedItemCount,
    bool CanSubmitToKitchen,
    IReadOnlyList<OrderItemResponse> Items,
    IReadOnlyList<KitchenTicketResponse> KitchenTickets);

/// <summary>The result of sending items to the kitchen.</summary>
/// <param name="Ticket">The ticket that was created.</param>
/// <param name="Order">
/// The order as it now stands, so the interface can refresh in one round trip
/// instead of fetching again.
/// </param>
public sealed record SubmitToKitchenResponse(
    KitchenTicketResponse Ticket,
    OrderResponse Order);

/// <summary>A placed order without its lines, for lists.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="Status">Lifecycle state.</param>
/// <param name="TableName">What staff call the table.</param>
/// <param name="Subtotal">Server-calculated sum of the lines.</param>
/// <param name="ItemCount">How many units in total.</param>
/// <param name="CreatedByName">The waiter who placed it, preserved from creation.</param>
/// <param name="UnsubmittedItemCount">
/// Units still waiting to be sent to the kitchen, so the list can flag an order
/// that needs attention.
/// </param>
/// <param name="KitchenTicketCount">How many submissions it has produced.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
public sealed record OrderSummaryResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    string TableName,
    decimal Subtotal,
    int ItemCount,
    string CreatedByName,
    int UnsubmittedItemCount,
    int KitchenTicketCount,
    DateTimeOffset CreatedAtUtc);
