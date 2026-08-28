namespace RestaurantManagement.Domain.Orders;

/// <summary>
/// How an order got into the system.
///
/// Exists because a kitchen and a manager need to know: an order nobody on the floor
/// typed has nobody to ask about it, so a ticket that came from a table has to be
/// recognisable as one. It changes nothing about the lifecycle, which is deliberately
/// identical either way.
/// </summary>
public enum OrderSource
{
    /// <summary>Taken by a waiter on the floor.</summary>
    Staff = 0,

    /// <summary>
    /// Placed by a guest who scanned the code on their table.
    ///
    /// Has no staff member behind it, which is why the order records none. It is
    /// otherwise an ordinary order: the same lines, the same kitchen tickets, the same
    /// stock deduction and the same bill.
    /// </summary>
    QrCode = 1,
}
