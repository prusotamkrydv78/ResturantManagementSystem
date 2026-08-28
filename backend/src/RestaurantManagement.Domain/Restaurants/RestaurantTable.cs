namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// A table in a restaurant.
///
/// Named RestaurantTable rather than Table so it is never confused with a database
/// table in code or in configuration.
///
/// Belongs directly to one restaurant: there are no branches, floors or zones in
/// this version, and no position, shape, reservation or order relationship.
/// </summary>
public class RestaurantTable
{
    /// <summary>How many characters a public ordering token is.</summary>
    public const int TokenLength = 32;

    /// <summary>
    /// Whether the code on this table resolves to anything at all.
    ///
    /// Two conditions, both of which have to hold: the table is in service, and
    /// self-service is switched on for it. Whether there is room to order right now is a
    /// question about orders rather than about this row, and is answered by the ordering
    /// system: occupancy here is a consequence of an order existing, so reading it back
    /// as a permission would be circular.
    /// </summary>
    public bool AcceptsPublicOrders => IsActive && IsOrderingEnabled;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant this table stands in.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>
    /// What staff and guests call this table, such as "Table 1", "A1" or
    /// "Outdoor 2". Unique within a restaurant, not across the platform.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>How many people the table seats.</summary>
    public int Capacity { get; set; }

    /// <summary>
    /// Live occupancy. Owned by the future ordering system, not by the manager.
    /// </summary>
    public TableStatus Status { get; set; } = TableStatus.Available;

    /// <summary>
    /// Whether the table is in service. An inactive table stays in the database
    /// with its history and is simply not offered to restaurant operations.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// The opaque token in this table ordering link.
    ///
    /// Random rather than derived, and the only thing a public link carries. It names
    /// the table without disclosing its identifier, the restaurant identifier, or
    /// anything about how many tables exist: a guessed or altered token simply does not
    /// resolve. Unique across the platform, so one restaurant link can never land on
    /// another restaurant table.
    ///
    /// Regenerating it invalidates every printed code for that table, which is the point
    /// when one has been photographed and posted somewhere.
    /// </summary>
    public string PublicOrderingToken { get; set; } = string.Empty;

    /// <summary>
    /// Whether guests may order by scanning this table.
    ///
    /// Off by default. A restaurant that has not thought about self-service should not
    /// have it switched on by a migration, and a manager needs a way to stop it for one
    /// table without taking the table out of service altogether.
    /// </summary>
    public bool IsOrderingEnabled { get; set; }

    /// <summary>When the table was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the table was last modified.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
