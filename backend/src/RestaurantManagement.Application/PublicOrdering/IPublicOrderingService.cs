using RestaurantManagement.Application.PublicOrdering.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.PublicOrdering;

/// <summary>
/// Ordering from the code printed on a table.
///
/// The only part of this product that serves somebody who is not signed in, which changes
/// what the contract has to look like. There is no user, so there is no account to derive
/// a restaurant from: the token does that job and nothing else may. Every method takes the
/// token and only the token, so a request cannot name a restaurant, a table, an order or a
/// guest, and therefore cannot reach past the one table whose code was scanned.
///
/// This is not a second ordering system. What a guest places is an ordinary order on an
/// ordinary table, marked as having come from a scan. The waiter workspace, the kitchen,
/// the floor view and billing all see it without a single change, because there is nothing
/// new for them to see.
///
/// Nothing here talks to the kitchen. Guest lines arrive unsubmitted and go out through
/// the existing kitchen submission, which is where stock leaves the shelf: a stranger with
/// a photograph of a code should not be able to put food on a stove, and the deduction
/// must keep happening at exactly one moment in the product.
/// </summary>
public interface IPublicOrderingService
{
    /// <summary>
    /// What a guest sees when they scan: where they are, what they can order, and their
    /// own order so far.
    ///
    /// Fails as not found for a token that is malformed, unknown, out of service or
    /// switched off, all reported identically.
    /// </summary>
    Task<Result<PublicTableResponse>> GetTableAsync(
        string token,
        CancellationToken cancellationToken);

    /// <summary>
    /// Places what the guest asked for.
    ///
    /// Adds to their existing order at this table when they already have one, so a second
    /// round is one bill rather than two. Starts a fresh order when the table has none.
    /// Refused while a member of staff is running an order on the table.
    /// </summary>
    Task<Result<PublicOrderResponse>> PlaceOrderAsync(
        string token,
        PlacePublicOrderRequest request,
        CancellationToken cancellationToken);
}
