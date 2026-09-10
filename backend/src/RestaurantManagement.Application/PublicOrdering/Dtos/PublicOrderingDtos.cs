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
/// <param name="IsReady">
/// Whether this dish is cooked and waiting to come over.
///
/// Per dish, because that is how food arrives. A table ordering momo and samosa is told
/// one thing about the whole order, and for fifteen minutes that one thing is wrong
/// about half of it - either the samosa is described as still cooking or the momo is
/// described as ready. Neither is a mistake in the timeline; the order was the wrong
/// unit to describe.
/// </param>
/// <param name="IsServed">Whether it has been brought to the table.</param>
public sealed record PublicOrderLineResponse(
    string ItemName,
    int Quantity,
    string? Note,
    decimal LineTotal,
    bool IsSentToKitchen,
    bool IsReady,
    bool IsServed);

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
/// <param name="ServiceChargeAmount">The service charge, on the food.</param>
/// <param name="VatAmount">Tax, on the food plus the service charge.</param>
/// <param name="Total">
/// What the table owes, and the only figure a customer should ever be quoted.
///
/// Sent because the subtotal was being shown to guests under the word "Total", which
/// understated every bill by the tax and the service charge - a guest reading 870 and
/// being asked for 1081 at the counter. The food is still sent alongside it so the
/// arithmetic on the receipt can be followed.
/// </param>
/// <param name="BillRequestedAtUtc">
/// When they asked to pay, or null. Carried so a phone that reloads still shows that
/// somebody has been told, rather than offering to ask all over again.
/// </param>
/// <param name="CanRequestBill">Whether asking for the bill would do anything now.</param>
/// <param name="IsSettled">
/// Whether the bill has been paid and the visit is over.
///
/// The page needs to tell that apart from an order that was called off, because both
/// stop the timeline and only one of them is worth thanking somebody for.
/// </param>
/// <param name="CanReview">
/// Whether they can still say what they thought.
///
/// True once the bill is settled and nobody has reviewed this visit yet. Decided by
/// the restaurant rather than by the page, so a phone that has been closed since the
/// meal does not offer a form that will be refused.
/// </param>
/// <param name="CanAddMore">
/// Whether the customer may still add to this order themselves. True until any part of
/// it goes to the kitchen, and false the moment it does - from then on a second round is
/// a conversation with a waiter, so that somebody knows to send it.
/// </param>
/// <param name="OrderKey">
/// What to send back to add to this order, or null.
///
/// Present exactly once, in the response to placing an order from the website, and never
/// on a read. Without an account it is the only thing that can stand for "this is my
/// order", so it goes to the person who placed it and to nobody else - a page that
/// listed orders would be handing out the ability to change other people's.
/// </param>
public sealed record PublicOrderResponse(
    int OrderNumber,
    IReadOnlyList<PublicOrderLineResponse> Lines,
    int ItemCount,
    decimal Subtotal,
    decimal ServiceChargeAmount,
    decimal VatAmount,
    decimal Total,
    int AwaitingKitchenCount,
    DateTimeOffset PlacedAtUtc,
    DateTimeOffset? BillRequestedAtUtc,
    bool CanRequestBill,
    bool IsSettled,
    bool CanReview,
    bool CanAddMore,
    string? OrderKey);

/// <summary>
/// What a guest gets from scanning the code on their table.
///
/// One response rather than several, because a phone at a table should not have to make
/// three requests to show a menu. Names the restaurant and the table so the guest can see
/// they scanned the right thing, which is the one piece of reassurance a public page owes
/// them.
/// </summary>
/// <param name="RestaurantName">Where they are.</param>
/// <param name="Currency">
/// The ISO code every amount on this pad is in.
///
/// It was simply missing, so every price on the screen behind every printed code in the
/// building was a bare number - a menu of "450" and a total of "1,118.70" with nothing
/// anywhere saying what in. The website response has carried this from the start; the
/// scanned one, which is how most people will actually order, did not.
///
/// One per restaurant, so it is sent once here rather than repeated on each price.
/// </param>
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
    string Currency,
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
/// <param name="TableId">
/// The table the code was printed for.
///
/// The whole point of scanning rather than typing a web address: the code says where
/// the customer is sitting, so the ordering page should not have to ask them. Without
/// it a redirect throws away the only thing the scan knew.
///
/// It gives nothing away. The same identifiers come back from the public menu call for
/// every table in the restaurant, along with their names and whether they are free,
/// because a customer on a website has to be able to pick one. This is that same
/// identifier, for the one table whose printed code the caller is holding.
/// </param>
/// <param name="TableName">
/// What the table is called in the room, so the page can say "Table 7" before it has
/// loaded anything else.
/// </param>
/// <param name="RunningOrderKey">
/// The key for the order already running on this table, or null when there is none.
///
/// This is how a customer who has lost their place gets it back. A phone that cleared
/// its storage, a flat battery, a different handset - none of those matter if the code
/// screwed to the table can hand the order back, and that code is the one thing in this
/// situation a guest reliably still has.
///
/// Given out on the strength of physical presence: the token is printed on that table
/// and somebody scanning it is sitting there. That is a weaker claim than holding the
/// key itself, which is why the only thing it buys is the customer's own order at the
/// table they are at - and why anything added afterwards withdraws the waiter's
/// confirmation, so a person reads the order back to the table before it can move.
///
/// Only for an order the customer placed themselves. A waiter's order is theirs to
/// manage and has no key at all.
/// </param>
public sealed record ScannedTableRestaurantResponse(
    string Slug,
    string RestaurantName,
    Guid TableId,
    string TableName,
    string? RunningOrderKey);

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
/// <param name="Currency">
/// The ISO code every amount on this page is in. One per restaurant, so it is sent once
/// here rather than repeated on each price.
/// </param>
/// <param name="Menu">The orderable menu, by section.</param>
/// <param name="Tables">Tables a customer may say they are at.</param>
/// <param name="IsAcceptingOrders">
/// False when no table is open to ordering at all, which is the difference between "we
/// do not take orders online" and "something is broken".
/// </param>
public sealed record PublicRestaurantResponse(
    string RestaurantName,
    string Currency,
    IReadOnlyList<PublicMenuSectionResponse> Menu,
    IReadOnlyList<PublicTableChoiceResponse> Tables,
    bool IsAcceptingOrders);

/// <summary>
/// Payload for asking a waiter to bring the bill.
///
/// The key and nothing else. A table asking to pay is the simplest message in this
/// product: which order, and that is all - there is no amount to name, because the
/// restaurant already knows what is owed.
/// </summary>
public sealed class RequestBillRequest
{
    /// <summary>The key handed back when the order was placed.</summary>
    [Required(ErrorMessage = "We could not find that order.")]
    public string OrderKey { get; set; } = string.Empty;
}

/// <summary>
/// Payload for picking an order back up.
///
/// The key is the whole request, and the whole permission. It goes in a body rather
/// than a path because a path is what ends up in a server log, a browser history and a
/// screenshot - and this one string is what stands for "this order is mine".
/// </summary>
public sealed class LookupWebsiteOrderRequest
{
    /// <summary>The key handed back when the order was placed.</summary>
    [Required(ErrorMessage = "We could not find that order.")]
    public string OrderKey { get; set; } = string.Empty;
}

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

    /// <summary>
    /// The key from an order they already have here, or null for a first order.
    ///
    /// What turns this request from "start an order" into "add to mine". A table that
    /// already has an order running is refused to a stranger, because joining somebody
    /// to another party's bill is the one mistake here that costs real money - and this
    /// is how the person who started that order is told apart from a stranger.
    ///
    /// The table is still sent alongside it and still has to match, so a key cannot be
    /// used to add food to an order at a different table.
    /// </summary>
    public string? OrderKey { get; set; }

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
