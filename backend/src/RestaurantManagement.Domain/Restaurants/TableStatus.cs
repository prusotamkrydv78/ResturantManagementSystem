namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// Live occupancy of a table.
///
/// This exists so the ordering system has somewhere to record occupancy when it
/// arrives. It is deliberately not editable by a restaurant manager: occupancy is
/// derived from what is happening on a table, and a value a human toggles by hand
/// would go stale the moment orders exist and then disagree with them.
///
/// Everything in this phase is <see cref="Available"/>. The state a manager does
/// control is whether a table is active at all.
/// </summary>
public enum TableStatus
{
    /// <summary>Nobody is seated. The only value used in this phase.</summary>
    Available = 0,

    /// <summary>Guests are seated. Set by the ordering system, later.</summary>
    Occupied = 1,

    /// <summary>Held for a booking. Set by reservations, later.</summary>
    Reserved = 2,
}
