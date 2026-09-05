using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// A restaurant on the platform, created by a Super Admin.
///
/// Ownership is expressed by a single foreign key, <see cref="ManagerId"/>, so there
/// is exactly one source of truth for who manages a restaurant. A filtered unique
/// index on that column guarantees a user manages at most one restaurant.
///
/// Operational concerns (branches, staff, tables, menus, orders) are not modelled
/// here. When staff arrive they will be associated through their own link to a
/// restaurant, which is an additive change.
/// </summary>
public class Restaurant
{
    /// <summary>Longest currency code accepted. ISO 4217 codes are three letters.</summary>
    public const int CurrencyLength = 3;

    /// <summary>
    /// The currency a new restaurant starts with.
    ///
    /// A default rather than a required choice at sign-up, because a manager setting up
    /// a restaurant should be able to add a menu item before answering a question about
    /// ISO codes. Changeable in settings.
    /// </summary>
    public const string DefaultCurrency = "NPR";

    /// <summary>
    /// The VAT rate a new restaurant starts with: thirteen per cent, the Nepalese rate.
    ///
    /// A default and not a constant. Everything downstream reads the rate off the
    /// restaurant, or off the snapshot on an order, so a restaurant somewhere else
    /// changes one setting rather than needing new code.
    /// </summary>
    public const decimal DefaultVatRate = 0.13m;

    /// <summary>The service charge a new restaurant starts with: ten per cent.</summary>
    public const decimal DefaultServiceChargeRate = 0.10m;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>Display name of the restaurant.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly unique identifier, derived from the name when not supplied.
    /// Useful for future public routes and for humans referring to a restaurant.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Optional contact email for the restaurant.</summary>
    public string? ContactEmail { get; set; }

    /// <summary>Optional contact phone number.</summary>
    public string? ContactPhone { get; set; }

    /// <summary>Optional street address.</summary>
    public string? AddressLine { get; set; }

    /// <summary>Optional city.</summary>
    public string? City { get; set; }

    /// <summary>Optional country.</summary>
    public string? Country { get; set; }

    /// <summary>
    /// The currency every amount in this restaurant is in, as an ISO 4217 code.
    ///
    /// One per restaurant and never per price. A menu with mixed currencies is not a
    /// menu, and a bill that adds two of them together is wrong in a way no formatting
    /// can rescue.
    ///
    /// Held as a code rather than a symbol so the display can be left to the machine
    /// showing it. "Rs" in Kathmandu and "NPR" on an English report are the same
    /// currency, and picking between them is a job for the reader's locale.
    /// </summary>
    public string Currency { get; set; } = DefaultCurrency;

    /// <summary>
    /// Value added tax, as a fraction. 0.13 is thirteen per cent.
    ///
    /// A fraction rather than a percentage so the arithmetic never has to remember to
    /// divide by a hundred. A misplaced factor of a hundred on a bill is the most
    /// expensive kind of bug this module can have.
    ///
    /// Configurable because it is set by law and the law changes, and snapshotted onto
    /// every order at the moment it opens - see <see cref="Orders.Order.VatRate"/>. A
    /// rate change tomorrow must not rewrite what somebody agreed to pay tonight.
    /// </summary>
    public decimal VatRate { get; set; } = DefaultVatRate;

    /// <summary>
    /// Service charge, as a fraction. 0.10 is ten per cent.
    ///
    /// Applied before tax, because that is the order the tax is calculated in: the
    /// charge is part of what is being taxed, not something added afterwards.
    ///
    /// Zero is a legitimate setting and means the restaurant does not levy one, which
    /// is why this is a rate rather than a flag plus a rate.
    /// </summary>
    public decimal ServiceChargeRate { get; set; } = DefaultServiceChargeRate;

    /// <summary>
    /// The assigned manager, or null before one has been assigned. This is the only
    /// place restaurant ownership is recorded.
    /// </summary>
    public Guid? ManagerId { get; set; }

    /// <summary>Navigation to the assigned manager.</summary>
    public ApplicationUser? Manager { get; set; }

    /// <summary>
    /// Whether the restaurant may take new business.
    ///
    /// The state between trading and gone. A restaurant that stops paying, or is being
    /// looked into, has to be stoppable without destroying the orders and takings
    /// every report is built from - so this is what the platform uses instead of
    /// deleting the record.
    ///
    /// Suspension deliberately blocks only the start of new business: a waiter cannot
    /// open an order and a guest cannot scan a table. Work already underway carries on
    /// to the till, because suspending at eight in the evening must not strand food
    /// that is cooking or a bill nobody can settle. Signing in still works for the
    /// same reason - the manager and their staff need to close the night out and read
    /// their own history afterwards.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When the restaurant was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the restaurant was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

}
