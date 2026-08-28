namespace RestaurantManagement.Domain.Payments;

/// <summary>
/// How a bill was settled.
///
/// This is a label on a record of something that already happened at the counter,
/// not an instruction to charge anybody. Nothing here talks to a payment provider,
/// so the values describe the kind of tender rather than naming a particular wallet
/// or card network: a provider list would go stale, and the accounting question a
/// restaurant actually asks at the end of a shift is how much came in as cash
/// against everything else.
/// </summary>
public enum PaymentMethod
{
    /// <summary>Notes and coins.</summary>
    Cash = 0,

    /// <summary>Any card presented at a terminal.</summary>
    Card = 1,

    /// <summary>
    /// Any wallet, bank or scan-to-pay transfer. Kept as one value on purpose: the
    /// system records that money arrived digitally and holds no reference, so
    /// splitting it by provider would imply a verification that does not exist.
    /// </summary>
    Digital = 2,
}
