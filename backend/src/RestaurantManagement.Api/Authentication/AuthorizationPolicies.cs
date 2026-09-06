namespace RestaurantManagement.Api.Authentication;

/// <summary>
/// Named authorization policies.
///
/// Built from the claims the token already carries, rather than a new permission
/// system: the platform role says what part of the product an account can reach,
/// and the staff role says what the person does on the floor.
/// </summary>
public static class AuthorizationPolicies
{
    /// <summary>
    /// A waiter taking orders. Requires the Staff platform role and a staff role of
    /// Waiter, so a chef, a restaurant manager and a platform admin are
    /// all refused.
    ///
    /// A manager is deliberately excluded. They configure the restaurant; giving
    /// them floor operations by default would blur two different jobs and make
    /// "who placed this order" ambiguous.
    /// </summary>
    public const string Waiter = "Waiter";

    /// <summary>
    /// A chef working the kitchen. Requires the Staff platform role and a staff role
    /// of Chef, so a waiter, a restaurant manager and a platform admin
    /// are all refused.
    ///
    /// A manager is excluded for the same reason as above. Configuring a restaurant
    /// and cooking in it are different jobs, and a manager who needs to see the rail
    /// can stand next to it.
    /// </summary>
    public const string Chef = "Chef";

    /// <summary>
    /// Somebody who may take a payment: a restaurant manager, or a waiter.
    ///
    /// Both, because in a restaurant the person who takes the money is whoever is
    /// standing at the table. Making a manager walk over for every bill is how a
    /// product gets worked around rather than used.
    ///
    /// A chef is not included. They are Staff, and without this they would inherit the
    /// billing screens simply for being staff - which is the same mistake the floor
    /// screens made before they started asking what somebody actually does.
    ///
    /// Deliberately not everything a manager can do at a counter. Discounts,
    /// cancellations and the takings history stay theirs, gated a second time on the
    /// actions themselves.
    /// </summary>
    public const string Settles = "Settles";
}
