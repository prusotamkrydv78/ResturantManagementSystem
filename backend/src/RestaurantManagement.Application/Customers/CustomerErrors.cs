using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Customers;

/// <summary>Failures the customer module can report.</summary>
public static class CustomerErrors
{
    /// <summary>The caller manages no restaurant, so there is no book to keep.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("customer.no_restaurant", "No restaurant is assigned to this account yet.");

    /// <summary>
    /// No customer with that identifier exists in the caller restaurant. One from
    /// another restaurant reports the same thing, so probing identifiers never reveals
    /// that somebody is on another restaurant books.
    /// </summary>
    public static readonly Error NotFound =
        new("customer.not_found", "That customer could not be found.");

    /// <summary>
    /// Another customer in this restaurant already has the number.
    ///
    /// Refused rather than allowed, because two rows claiming the same number leaves a
    /// manager guessing which is the real one every time they search.
    /// </summary>
    public static readonly Error PhoneTaken =
        new(
            "customer.phone_taken",
            "Another customer already has this phone number.");

    /// <summary>
    /// The customer cannot be deleted because they have history.
    ///
    /// Deactivating is offered instead. An order or a booking pointing at a row nobody
    /// can look up would lose the answer to who it was for.
    /// </summary>
    public static readonly Error HasHistory =
        new(
            "customer.has_history",
            "This customer has orders or reservations and cannot be deleted. Deactivate them instead.");
}
