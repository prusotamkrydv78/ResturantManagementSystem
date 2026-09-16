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

    /// <summary>Adds a picture, refusing anything too large, wrong or over the limit.</summary>
    Task<Result<MediaResponse>> AddAsync(
        Guid managerUserId,
        string fileName,
        string contentType,
        Stream content,
        long declaredLength,
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

    /// <summary>The bytes, for anybody at all. See the note on the interface.</summary>
    Task<Result<(byte[] Content, string ContentType)>> GetBytesAsync(
        Guid id,
        CancellationToken cancellationToken);
}
