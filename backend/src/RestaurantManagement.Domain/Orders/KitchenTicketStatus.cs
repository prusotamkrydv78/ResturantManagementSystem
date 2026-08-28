namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// Where a kitchen ticket sits in its lifecycle.
///
/// A short, one-way workflow: the ticket arrives, someone picks it up, the food
/// goes to the pass. There is no Served value, because handing food to a guest is
/// floor work rather than kitchen work and nothing models that yet.
///
/// Deliberately separate from <see cref="OrderStatus"/>. An order stays Open while
/// the tickets it produced move through these states, and collapsing the two would
/// mean marking food ready closed the table.
/// </summary>
public enum KitchenTicketStatus
{
    /// <summary>Submitted and waiting for the kitchen to pick it up.</summary>
    Pending = 0,

    /// <summary>Someone in the kitchen has started cooking it.</summary>
    Preparing = 1,

    /// <summary>Cooked and waiting at the pass.</summary>
    Ready = 2,
}
