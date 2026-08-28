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
