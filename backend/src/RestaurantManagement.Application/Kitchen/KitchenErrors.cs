using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Kitchen;

/// <summary>Failures the kitchen module can report.</summary>
public static class KitchenErrors
{
    /// <summary>
    /// The caller is not a chef attached to an active restaurant account.
    ///
    /// Covers a deactivated account, a staff member with no restaurant, and a
    /// waiter, cashier or manager reaching the endpoint, all as one message. None of
    /// those need to be told apart by the client, and separating them would confirm
    /// which condition applied.
    /// </summary>
    public static readonly Error NotAnActiveChef =
        new("kitchen.not_an_active_chef", "This account cannot work the kitchen.");

    /// <summary>
    /// No ticket with that identifier exists in the caller restaurant. A ticket from
    /// another restaurant reports the same thing, so probing identifiers never
    /// reveals that one exists elsewhere.
    /// </summary>
    public static readonly Error NotFound =
        new("kitchen.ticket_not_found", "That kitchen ticket could not be found.");

    /// <summary>
    /// Start was asked for on a ticket that is not waiting. Usually another chef
    /// picked it up a moment earlier.
    /// </summary>
    public static readonly Error NotPending =
        new(
            "kitchen.ticket_not_pending",
            "This ticket is no longer waiting. Someone else has already started it.");

    /// <summary>
    /// Ready was asked for on a ticket nobody is cooking. A waiting ticket cannot
    /// jump straight to the pass, and one already at the pass cannot go again.
    /// </summary>
    public static readonly Error NotPreparing =
        new(
            "kitchen.ticket_not_preparing",
            "Only a ticket being prepared can be marked ready.");

    /// <summary>
    /// Someone else moved the ticket between it being read and written. Reported
    /// rather than restamping a transition that already happened.
    /// </summary>
    public static readonly Error Conflict =
        new(
            "kitchen.conflict",
            "Another chef just updated this ticket. The kitchen list has been refreshed.");
}
