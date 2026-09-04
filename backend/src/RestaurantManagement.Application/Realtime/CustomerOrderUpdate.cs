namespace RestaurantManagement.Application.Realtime;

/// <summary>
/// How far along a customer's own order is.
///
/// Named for what a person waiting for food would say, not for the internals. There is
/// no "ticket queued" in a customer's world: their order went to the kitchen. The stages
/// also deliberately collapse the fact that one order can produce several tickets - a
/// guest wants to know their food is coming, not that submission two of three has
/// started - so the latest thing that happened wins.
/// </summary>
public enum CustomerOrderStage
{
    /// <summary>A member of staff has been over and agreed the order.</summary>
    Confirmed = 0,

    /// <summary>It has gone through to the kitchen.</summary>
    WithKitchen = 1,

    /// <summary>The kitchen has started cooking.</summary>
    BeingPrepared = 2,

    /// <summary>The food is cooked and about to come out.</summary>
    Ready = 3,

    /// <summary>It has been brought to the table.</summary>
    Served = 4,
}

/// <summary>
/// One step forward on a customer's own order, as sent to their phone.
///
/// Deliberately tiny, and that is the whole design. This goes to an anonymous
/// connection, so it carries only what the person already knows - their own order number
/// - plus how far along it is. No identifiers, no totals, no table, and above all no
/// member of staff: which waiter confirmed an order is a fact about the restaurant's
/// staff, and no customer needs it to know their food is coming.
///
/// The wording lives on the client. Sending a sentence would mean a server deciding how
/// a phone should read, and it would be the one part of this product that could not be
/// translated.
/// </summary>
/// <param name="OrderNumber">Their own order number, so a page can check it matches.</param>
/// <param name="Stage">How far along it is.</param>
public sealed record CustomerOrderUpdate(int OrderNumber, CustomerOrderStage Stage);
