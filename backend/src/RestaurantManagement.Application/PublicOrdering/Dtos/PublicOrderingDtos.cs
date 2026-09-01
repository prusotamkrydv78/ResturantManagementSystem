using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Application.Orders.Dtos;

namespace RestaurantManagement.Application.PublicOrdering.Dtos;

/// <summary>Bounds applied to what one scan may ask for.</summary>
public static class PublicOrderLimits
{
    /// <summary>
    /// How many distinct lines a single request may carry.
    ///
    /// A sanity bound rather than a rule about appetite. Nobody is signed in on these
    /// routes, so the only thing standing between the endpoint and a scripted request is
    /// what the endpoint itself refuses.
    /// </summary>
    public const int MaxLines = 40;
}

/// <summary>
/// A menu item as a guest sees it.
///
/// Carries a price because the guest is deciding whether to order it, and an identifier
/// because the order request has to name it somehow. Nothing else: no cost, no recipe, no
/// stock, no category identifier, and nothing about the restaurant.
/// </summary>
/// <param name="Id">What to send back when ordering this.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional description.</param>
/// <param name="Price">
/// Current price, for display only. The server prices the order again from its own menu
/// and never reads a price out of a request.
/// </param>
/// <param name="ImageUrl">
/// The dish photograph, or null. The one image in this product a guest is shown.
/// </param>
public sealed record PublicMenuItemResponse(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    string? ImageUrl);

/// <summary>A course or section of the menu, with what a guest may order from it.</summary>
/// <param name="Name">Display name.</param>
/// <param name="Items">The orderable items.</param>
/// <param name="ImageUrl">The photograph heading the section, or null.</param>
public sealed record PublicMenuSectionResponse(
    string Name,
    IReadOnlyList<PublicMenuItemResponse> Items,
    string? ImageUrl);

/// <summary>One line of a guest own order, as it was recorded.</summary>
/// <param name="ItemName">Name as it was when ordered.</param>
/// <param name="Quantity">How many.</param>
/// <param name="Note">What they asked for, if anything.</param>
/// <param name="LineTotal">Quantity multiplied by the recorded price.</param>
/// <param name="IsSentToKitchen">
/// Whether the kitchen has been told about this line yet. What a guest actually wants to
/// know is whether their food is coming.
/// </param>
public sealed record PublicOrderLineResponse(
    string ItemName,
    int Quantity,
    string? Note,
    decimal LineTotal,
    bool IsSentToKitchen);

/// <summary>
/// A guest own order at the table.
///
/// Deliberately carries no identifiers. A guest never needs one: every action goes
/// through the table link, and the order number is what they would say out loud to a
/// member of staff. Nothing here names the waiter, the restaurant record, the customer,
/// or any payment.
/// </summary>
/// <param name="OrderNumber">The number to quote to staff.</param>
/// <param name="Lines">What has been ordered so far.</param>
/// <param name="ItemCount">How many units in total.</param>
/// <param name="Subtotal">
/// What the lines come to, calculated by the server. Shown so a guest can see the running
/// bill; it is not a demand for payment, which still happens with staff.
/// </param>
/// <param name="AwaitingKitchenCount">
/// Units the kitchen has not been told about yet, so a guest can see that a member of
/// staff still has to send their order through.
/// </param>
/// <param name="PlacedAtUtc">When the first line went on.</param>
/// <param name="CanCancel">
/// Whether the customer may still call this off themselves. True until a member of staff
/// sends any part of it to the kitchen, and false the moment they do.
/// </param>
/// <param name="CancelKey">
/// What to send back to cancel this order, or null.
///
/// Present exactly once, in the response to placing an order from the website, and never
/// on a read. It is the whole authority to cancel, so it is given to the person who
/// placed the order and to nobody else - a page that lists orders would be handing out
/// the ability to cancel other people's.
/// </param>
public sealed record PublicOrderResponse(
    int OrderNumber,
    IReadOnlyList<PublicOrderLineResponse> Lines,
    int ItemCount,
    decimal Subtotal,
    int AwaitingKitchenCount,
    DateTimeOffset PlacedAtUtc,
    bool CanCancel,
    string? CancelKey);

/// <summary>
/// Payload for a customer calling off their own order.
///
/// The key is the entire request. It names the order, and holding it is the permission -
/// there is no account behind a website order, so there is nothing else it could be. No
/// order number, because a number is printed on a receipt and sequential enough to guess
/// at a neighbour's.
/// </summary>
public sealed class CancelWebsiteOrderRequest
{
    /// <summary>The key handed back when the order was placed.</summary>
    [Required(ErrorMessage = "This order cannot be cancelled from here.")]
    public string CancelKey { get; set; } = string.Empty;
}

/// <summary>
/// What a guest gets from scanning the code on their table.
///
/// One response rather than several, because a phone at a table should not have to make
/// three requests to show a menu. Names the restaurant and the table so the guest can see
/// they scanned the right thing, which is the one piece of reassurance a public page owes
/// them.
/// </summary>
/// <param name="RestaurantName">Where they are.</param>
/// <param name="TableName">Which table they are at.</param>
/// <param name="CanOrder">
/// Whether an order placed now would be accepted. False while a member of staff is
/// running an order on this table, since that bill is being looked after in person.
/// </param>
/// <param name="UnavailableReason">
/// What to tell the guest when they cannot order, in words meant for them rather than a
/// code. Null when they can.
/// </param>
/// <param name="Menu">What they may order, grouped as the menu is grouped.</param>
/// <param name="CurrentOrder">
/// Their own order at this table, if they have started one. Null when a member of staff is
/// serving the table: that order is not theirs to see through a link.
/// </param>
public sealed record PublicTableResponse(
    string RestaurantName,
    string TableName,
    bool CanOrder,
    string? UnavailableReason,
    IReadOnlyList<PublicMenuSectionResponse> Menu,
    PublicOrderResponse? CurrentOrder);

/// <summary>
/// Which restaurant a printed table code belongs to.
///
/// The one thing about a scanned code that is still answered without a session, and it
/// exists for exactly one purpose: a customer scanning a table needs to be sent to that
/// restaurant's ordering page, and the browser cannot work out where that is on its own.
///
/// It gives away nothing a person holding the printed code does not already have. The
/// slug is the restaurant's own public web address, and nothing about the table, the
/// menu or anybody's order is reachable through it.
/// </summary>
/// <param name="Slug">The restaurant's public slug, for building its web address.</param>
/// <param name="RestaurantName">Display name, so a redirect can say where it is going.</param>
public sealed record ScannedTableRestaurantResponse(string Slug, string RestaurantName);

/// <summary>
/// A table a customer may say they are sitting at.
///
/// Offered by the website rather than resolved from a scanned code, which is the whole
/// difference between the two ways in. Nothing here identifies the table to anybody but
/// this restaurant: the name is what is painted on it, and the identifier is only useful
/// against this one slug.
/// </summary>
/// <param name="Id">What to send back when ordering.</param>
/// <param name="Name">What the table is called in the room.</param>
/// <param name="Capacity">How many it seats, so somebody can pick a sensible one.</param>
/// <param name="IsAvailable">
/// False when an order is already running on it. Offered but not choosable rather than
/// hidden, so a customer sitting at a taken table understands why they cannot pick it
/// instead of wondering where their table went.
/// </param>
public sealed record PublicTableChoiceResponse(
    Guid Id,
    string Name,
    int Capacity,
    bool IsAvailable);

/// <summary>
/// What the restaurant own website needs to take an order.
///
/// The menu here is the real one, priced from the menu records. It is deliberately not
/// the menu a manager types into their site content: that is prose about the food, its
/// prices are free text, and nothing in it can be ordered because none of it has an
/// identifier.
/// </summary>
/// <param name="RestaurantName">Display name.</param>
/// <param name="Menu">The orderable menu, by section.</param>
/// <param name="Tables">Tables a customer may say they are at.</param>
/// <param name="IsAcceptingOrders">
/// False when no table is open to ordering at all, which is the difference between "we
/// do not take orders online" and "something is broken".
/// </param>
public sealed record PublicRestaurantResponse(
    string RestaurantName,
    IReadOnlyList<PublicMenuSectionResponse> Menu,
    IReadOnlyList<PublicTableChoiceResponse> Tables,
    bool IsAcceptingOrders);

/// <summary>
/// Payload for ordering from the website.
///
/// Carries a table, which the token request deliberately does not: a scanned code says
/// where the guest is, and somebody on a website has to be asked. It is still only an
/// identifier - no name, no price, no total - and the server checks the table belongs to
/// this restaurant and is free before accepting it.
/// </summary>
public sealed class PlaceWebsiteOrderRequest
{
    /// <summary>Which table the customer says they are sitting at.</summary>
    [Required(ErrorMessage = "Choose the table you are sitting at.")]
    public Guid TableId { get; set; }

    /// <summary>What they want. At least one line is required.</summary>
    [Required(ErrorMessage = "Add something to your order first.")]
    [MinLength(1, ErrorMessage = "Add something to your order first.")]
    [MaxLength(
        PublicOrderLimits.MaxLines,
        ErrorMessage = "That is too many separate items for one order.")]
    public List<CreateOrderItemRequest> Items { get; set; } = [];
}

/// <summary>
/// Payload for a guest placing an order.
///
/// Reuses the waiter line type deliberately. There is one ordering system in this product,
/// and a guest asking for two of something is the same request as a waiter asking for two
/// of something. There is no table field, no restaurant field, no price and no total: the
/// table comes from the link, and every amount is calculated by the server.
/// </summary>
public sealed class PlacePublicOrderRequest
{
    /// <summary>What they want. At least one line is required.</summary>
    [Required(ErrorMessage = "Add something to your order first.")]
    [MinLength(1, ErrorMessage = "Add something to your order first.")]
    [MaxLength(
        PublicOrderLimits.MaxLines,
        ErrorMessage = "That is too many separate items for one order.")]
    public List<CreateOrderItemRequest> Items { get; set; } = [];
}
