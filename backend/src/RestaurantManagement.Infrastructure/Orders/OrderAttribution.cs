using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Infrastructure.Orders;

/// <summary>
/// Who to say placed an order.
///
/// One place, because three services answer this question and they must answer it the
/// same way. An order a guest placed by scanning their table has no staff member behind
/// it, and calling that "Unknown" would read as a data problem rather than as the
/// ordinary thing it is.
/// </summary>
internal static class OrderAttribution
{
    /// <summary>What a guest order is called on screen.</summary>
    public const string Guest = "Guest at the table";

    /// <summary>Shown when a staff order names somebody who is no longer on file.</summary>
    public const string Unknown = "Unknown";

    /// <summary>
    /// The name to show for whoever placed the order.
    ///
    /// A guest order says so plainly. A staff order names the person, falling back only
    /// when the account has genuinely gone.
    /// </summary>
    public static string PlacedBy(Order order, string? staffName) =>
        order.CreatedByStaffId is null ? Guest : staffName ?? Unknown;

    /// <summary>
    /// The name to show for whoever placed the order, given several already looked up.
    ///
    /// The dictionary overload, for a caller holding a page of orders: the names are
    /// fetched in one query rather than one per row.
    /// </summary>
    public static string PlacedBy(
        Order order,
        IReadOnlyDictionary<Guid, string> names)
    {
        if (order.CreatedByStaffId is null)
        {
            return Guest;
        }

        return names.TryGetValue(order.CreatedByStaffId.Value, out var name)
            ? name
            : Unknown;
    }
}
