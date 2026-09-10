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
    /// Somebody who may work the kitchen rail: a chef, or a restaurant manager.
    ///
    /// A manager used to be refused here, on the reasoning that configuring a
    /// restaurant and cooking in it are different jobs and a manager who needs to see
    /// the rail can stand next to it. That was wrong about what the rail is for. It is
    /// not a cooking tool, it is the record of how late the food is - and the person
    /// answerable for a room in which the food is late could not open it. Not just
    /// hidden from their navigation: the API refused them, so there was no way to look.
    ///
    /// The same reasoning as <see cref="Settles"/>, arrived at from the other side. A
    /// waiter is still refused; a rail is not a place to take orders from.
    /// </summary>
    public const string Chef = "Chef";

    /// <summary>
    /// Somebody who may carry food from the pass: a waiter, or a restaurant manager.
    ///
    /// Deliberately its own policy rather than a widening of <see cref="Waiter"/>.
    /// That one guards taking orders, where a manager is excluded on purpose so that
    /// "who placed this order" stays unambiguous. Carrying a cooked plate to a table
    /// carries no such question, and a manager standing next to a pass full of food
    /// going cold should be able to pick it up.
    ///
    /// Identical in shape to <see cref="Settles"/> and separate from it on purpose:
    /// the two answer different questions, and collapsing them would mean the day one
    /// of them changes the other changes with it silently.
    /// </summary>
    public const string Serves = "Serves";

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
