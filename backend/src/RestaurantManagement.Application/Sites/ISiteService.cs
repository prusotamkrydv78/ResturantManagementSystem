using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Sites;

/// <summary>
/// A restaurant's public page: one draft, one published copy.
///
/// Every manager method resolves the restaurant from the signed-in account rather than
/// taking one, so there is no identifier to tamper with. The public read is the
/// exception and takes a slug, because the person asking has no account.
/// </summary>
public interface ISiteService
{
    /// <summary>The draft, creating an empty record the first time it is asked for.</summary>
    Task<Result<SiteResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Replaces the draft.
    ///
    /// Never touches the published copy. Editing a page that is live is safe, which is
    /// the whole reason the two are separate columns.
    /// </summary>
    Task<Result<SiteResponse>> SaveDraftAsync(
        Guid managerUserId,
        SaveSiteDraftRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Publishes the draft as it stands, or withdraws the page.
    ///
    /// Publishing copies the draft across; withdrawing leaves the copy where it is, so
    /// putting the page back is one press rather than a republish of whatever the draft
    /// has become in the meantime.
    /// </summary>
    Task<Result<SiteResponse>> SetPublishedAsync(
        Guid managerUserId,
        SetSitePublishedRequest request,
        CancellationToken cancellationToken);

    /// <summary>What a visitor at a slug is served, or not found.</summary>
    Task<Result<PublicSiteResponse>> GetPublishedAsync(
        string slug,
        CancellationToken cancellationToken);
}
