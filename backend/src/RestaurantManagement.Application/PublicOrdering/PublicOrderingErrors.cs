using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.PublicOrdering;

/// <summary>Failures the public ordering routes can report.</summary>
public static class PublicOrderingErrors
{
    /// <summary>
    /// The caller does not work at the restaurant this table belongs to.
    ///
    /// Reported as not found rather than as a refusal, and deliberately: the token is
    /// unguessable, so somebody presenting one from another restaurant either has a
    /// printed card they should not have or is probing. Neither is owed the
    /// information that the code is real.
    /// </summary>
    public static readonly Error NotYourTable =
        new("public.not_your_table", "That table could not be found.");

    /// <summary>
    /// The table a website customer chose is already in use.
    ///
    /// Refused rather than appended to, unlike the scanned path. A code on a table is
    /// held by somebody sitting at it, so adding a second round to the order there is
    /// almost certainly the same party; a table picked from a list on a website is a
    /// claim by a stranger, and joining them to somebody else's bill is the one
    /// mistake here that costs real money.
    /// </summary>
    public static readonly Error TableInUse =
        new(
            "public.table_in_use",
            "Someone is already ordering at that table. Please pick another, or ask a "
            + "member of staff.");

    /// <summary>
    /// Nothing more can be added to the order from a phone.
    ///
    /// One error for every reason: part of it has gone to the kitchen, or a member of
    /// staff has closed, settled or called it off. The customer's next move is the same
    /// in all of them, and it is to speak to somebody.
    /// </summary>
    public static readonly Error CannotAddMore =
        new(
            "public.cannot_add_more",
            "Your order is already with the kitchen, so it cannot be changed here. Ask a "
            + "member of staff and they will sort it out for you.");

    /// <summary>The restaurant is not open to website orders at all.</summary>
    public static readonly Error NotAcceptingOrders =
        new(
            "public.not_accepting",
            "This restaurant is not taking orders online at the moment.");

    /// <summary>
    /// The link does not resolve.
    ///
    /// One error for every reason it might not: the token is malformed, it belongs to no
    /// table, the table is out of service, or self-service is switched off for it. Kept
    /// deliberately indistinguishable, because these routes need no authentication and a
    /// different answer per case would let anybody map a restaurant tables by trying
    /// links. A guest with a real code never sees this; a guest holding a code that was
    /// switched off is told to ask a member of staff, which is the right thing to do
    /// either way.
    /// </summary>
    public static readonly Error NotFound =
        new(
            "public_ordering.not_found",
            "This ordering link is not available. Please ask a member of staff.");

    /// <summary>
    /// Somebody is already serving this table.
    ///
    /// Self-service and table service on the same bill at the same time would mean two
    /// people editing one order, so the person who is physically there wins.
    /// </summary>
    public static readonly Error StaffServing =
        new(
            "public_ordering.staff_serving",
            "A member of staff is looking after this table. Please ask them for anything else you need.");

    /// <summary>Nothing orderable was asked for.</summary>
    public static readonly Error NoItems =
        new("public_ordering.no_items", "Add something to your order first.");

    /// <summary>
    /// Something asked for is not on the menu any more.
    ///
    /// Carries a message rather than being a fixed value, because how many items went is
    /// the difference between a guest re-picking one thing and starting again.
    /// </summary>
    public static Error ItemsUnavailable(string message) =>
        new("public_ordering.items_unavailable", message);

    /// <summary>
    /// A readable order number could not be claimed. Reported the same way as it is on
    /// the waiter side, since it is the same retry giving up.
    /// </summary>
    public static readonly Error NumberUnavailable =
        new(
            "public_ordering.number_unavailable",
            "The kitchen is very busy right now. Please try again in a moment.");
}
