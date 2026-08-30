using RestaurantManagement.Application.Sites.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Sites;

/// <summary>
/// The public one-page website a restaurant gets on the platform.
///
/// Two audiences, deliberately in one service because they read the same record: a
/// manager editing their page, and a visitor being served it. The manager operations
/// take no restaurant identifier and derive it from the account, exactly like every
/// other manager-facing service. The visitor operation takes a slug and nothing else,
/// because a visitor has no account.
/// </summary>
public interface ISiteService
{
    /// <summary>
    /// The caller's page, creating an empty one on first read.
    ///
    /// Created lazily rather than when the restaurant is registered, so a Super Admin
    /// creating a restaurant does not also have to decide anything about its website,
    /// and a restaurant that never wants one carries no row.
    /// </summary>
    Task<Result<SiteResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>Saves the content and the chosen design together.</summary>
    Task<Result<SiteResponse>> SaveAsync(
        Guid managerUserId,
        SaveSiteRequest request,
        CancellationToken cancellationToken);

    /// <summary>Publishes the page, or takes it back down.</summary>
    Task<Result<SiteResponse>> SetPublishedAsync(
        Guid managerUserId,
        SetSitePublishedRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// The published page at a slug.
    ///
    /// Reports <see cref="SiteErrors.NotFound"/> for an unknown slug, an unpublished
    /// page and a suspended restaurant alike: a page taken down should be
    /// indistinguishable from one that never existed.
    /// </summary>
    Task<Result<PublicSiteResponse>> GetPublishedAsync(
        string slug,
        CancellationToken cancellationToken);

    /// <summary>The images the caller has uploaded, newest first.</summary>
    Task<Result<IReadOnlyList<SiteImageResponse>>> GetImagesAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>Stores an uploaded image and returns the URL to reference it by.</summary>
    Task<Result<SiteImageResponse>> AddImageAsync(
        Guid managerUserId,
        string fileName,
        string contentType,
        Stream content,
        long declaredLength,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes an image.
    ///
    /// Does not check whether the page still references it. A manager who removes a
    /// picture that is in use gets a blank space and can put another one back, which
    /// is a better outcome than a delete that refuses and makes them hunt for where
    /// it was used.
    /// </summary>
    Task<Result<bool>> DeleteImageAsync(
        Guid managerUserId,
        Guid imageId,
        CancellationToken cancellationToken);

    /// <summary>The bytes of one image, for the public endpoint that serves them.</summary>
    Task<Result<(byte[] Content, string ContentType)>> GetImageBytesAsync(
        Guid imageId,
        CancellationToken cancellationToken);
}
