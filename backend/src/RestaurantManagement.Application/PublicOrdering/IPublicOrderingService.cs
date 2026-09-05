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
        Guid staffUserId,
        string token,
        CancellationToken cancellationToken);

    /// <summary>
    /// Places what the guest asked for.
    ///
    /// Adds to their existing order at this table when they already have one, so a second
    /// round is one bill rather than two. Starts a fresh order when the table has none.
    /// Refused while a member of staff is running an order on the table.
    /// </summary>
    /// <summary>
    /// What the restaurant's own website needs: the real menu, and the tables a
    /// customer may say they are sitting at.
    /// </summary>
    /// <remarks>
    /// Keyed by the public slug rather than by a table token, because somebody
    /// reading a website has not scanned anything. That is the only difference; the
    /// order they place goes through the same pricing, the same caps and the same
    /// availability checks as a scanned one.
    /// </remarks>
    Task<Result<PublicRestaurantResponse>> GetRestaurantAsync(
        string slug,
        CancellationToken cancellationToken);

    /// <summary>
    /// Reads back an order the customer already has, from the key they hold.
    /// </summary>
    /// <remarks>
    /// How somebody who lost their place gets it back. A phone that cleared its storage,
    /// a flat battery, a link opened on a different handset - all of them arrive here
    /// with a key and nothing else, and leave with the order in full.
    ///
    /// It is also what makes the receipt trustworthy rather than merely remembered. The
    /// copy a phone keeps is a snapshot from whenever it was written; this is what the
    /// restaurant currently says, so a page that reopens after an hour shows the bill as
    /// it now stands rather than as it was.
    ///
    /// Refused once the order has been settled or called off. There is nothing useful
    /// left to show a customer at that point, and a key that outlives its order is a
    /// capability with no purpose.
    /// </remarks>
    Task<Result<PublicOrderResponse>> LookupWebsiteOrderAsync(
        string slug,
        LookupWebsiteOrderRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Places an order from the website, or adds to one the customer already has.
    /// </summary>
    /// <remarks>
    /// Both, because to a customer they are the same act: choosing food and sending it.
    /// Which one happens is decided by whether they presented the key from an order they
    /// already have - the only thing that can tell the person who started the order at
    /// that table from a stranger claiming it.
    ///
    /// Adding stops the moment anything reaches the kitchen. Until then an order is a
    /// list on a screen and another line costs nobody anything; after it the kitchen is
    /// working from paper that no longer matches, and a second round has to be a
    /// conversation so that somebody knows to send it.
    ///
    /// Adding after a waiter has confirmed clears the confirmation, so the new lines are
    /// agreed before they can go anywhere. There is deliberately no way for a customer to
    /// remove a line or call the order off; those are conversations with a waiter.
    /// </remarks>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="request">The table, what they want, and their key if they have one.</param>
    /// <param name="placedFromIp">
    /// Where the request came from, recorded on the order as an audit trail.
    ///
    /// Never used to identify anybody, and it cannot be: every phone on a restaurant's
    /// wifi shares one address. It is here so a flood of junk orders can be traced and
    /// blocked, which is a question about a source rather than about a person.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<PublicOrderResponse>> PlaceWebsiteOrderAsync(
        string slug,
        PlaceWebsiteOrderRequest request,
        string? placedFromIp,
        CancellationToken cancellationToken);

    Task<Result<PublicOrderResponse>> PlaceOrderAsync(
        Guid staffUserId,
        string token,
        PlacePublicOrderRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Which restaurant a printed table code belongs to.
    ///
    /// The only thing left on the scanned path that answers without a session, and it
    /// is what makes one printed code serve two people: a member of staff scanning it
    /// gets the order pad for that table, and anybody else is sent to the
    /// restaurant's own ordering page. The browser needs the slug to do that.
    /// </summary>
    Task<Result<ScannedTableRestaurantResponse>> ResolveScannedRestaurantAsync(
        string token,
        CancellationToken cancellationToken);
}
