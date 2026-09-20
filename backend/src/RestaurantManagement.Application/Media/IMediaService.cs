using RestaurantManagement.Application.Media.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Media;

/// <summary>
/// A restaurant's picture library.
///
/// Every method resolves the restaurant from the signed-in manager rather than taking
/// one, which is what stops a manager reaching another restaurant's pictures by
/// guessing an identifier. Reading the bytes is the exception and is deliberately not
/// scoped to anybody: those are drawn on a public page by people with no account.
/// </summary>
public interface IMediaService
{
    /// <summary>Everything this manager's restaurant holds, newest first.</summary>
    Task<Result<MediaLibraryResponse>> GetLibraryAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Adds a picture, refusing anything too large, wrong or over the limit.
    ///
    /// The thumbnail is optional and is the uploader's own small copy of the same
    /// picture. Nothing checks that it depicts what the original depicts, because
    /// nothing here can: it is checked for size and for being an image, and it is only
    /// ever served to the account that uploaded it in a grid of its own pictures.
    /// </summary>
    Task<Result<MediaResponse>> AddAsync(
        Guid managerUserId,
        string fileName,
        string contentType,
        Stream content,
        long declaredLength,
        MediaThumbnail? thumbnail,
        CancellationToken cancellationToken);

    /// <summary>
    /// Removes one permanently.
    ///
    /// The bytes go; anything still pointing at them is left pointing at nothing. The
    /// editor is what warns a manager that a picture is in use, because only it knows
    /// what a page is made of.
    /// </summary>
    Task<Result<bool>> RemoveAsync(
        Guid managerUserId,
        Guid id,
        CancellationToken cancellationToken);

    /// <summary>
    /// The bytes, for anybody at all. See the note on the interface.
    ///
    /// Asking for the thumbnail is a preference, not a demand: a picture stored before
    /// thumbnails existed, or uploaded by something that could not make one, is served
    /// whole. The caller is a browser drawing a grid and would rather have the picture
    /// than an error.
    /// </summary>
    Task<Result<(byte[] Content, string ContentType)>> GetBytesAsync(
        Guid id,
        bool preferThumbnail,
        CancellationToken cancellationToken);
}

/// <summary>A small copy of a picture, made by whatever uploaded it.</summary>
/// <param name="ContentType">Its media type, checked against the same whitelist.</param>
/// <param name="Content">The bytes.</param>
/// <param name="DeclaredLength">What the request said it would weigh.</param>
public sealed record MediaThumbnail(
    string ContentType,
    Stream Content,
    long DeclaredLength);
