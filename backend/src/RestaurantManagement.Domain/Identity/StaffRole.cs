namespace RestaurantManagement.Domain.Identity;

/// <summary>
/// What a staff member does in the restaurant.
///
/// This is an operational role and is deliberately separate from
/// <see cref="PlatformRole"/>, which decides what part of the product an account
/// can reach. A waiter and a chef have the same platform access today; the
/// difference here is what they will be allowed to do once ordering and kitchen
/// features exist.
///
/// Numbering starts at 1 so the default value of the underlying type is never a
/// meaningful role: a user with no staff role has null.
/// </summary>
public enum StaffRole
{
    /// <summary>Takes orders and serves guests.</summary>
    Waiter = 1,

    /// <summary>Works in the kitchen.</summary>
    Chef = 2,

    // 3 was Cashier, removed while nothing was built for it. Billing is the
    // manager's job today. Leave 3 unused rather than reassigning it: the value
    // is persisted as its name, so a reused number is harmless in the database
    // but would make old records and logs read as the wrong role.
}
