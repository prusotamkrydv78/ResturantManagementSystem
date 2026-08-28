using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.PublicOrdering;

/// <summary>Failures the public ordering routes can report.</summary>
public static class PublicOrderingErrors
{
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
