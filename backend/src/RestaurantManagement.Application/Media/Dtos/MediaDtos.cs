namespace RestaurantManagement.Application.Media.Dtos;

/// <summary>
/// One picture in a restaurant's library, as the manager's screens read it.
///
/// Carries the URL rather than the bytes. Everything that uses a picture stores that
/// string, so the shape of the address is decided in one place and a caller never has
/// to know it is composed from an identifier.
/// </summary>
/// <param name="Id">Identifier, needed to delete it.</param>
/// <param name="Url">Where it is served from. Relative, so it survives a move.</param>
/// <param name="FileName">What it was called when it was uploaded.</param>
/// <param name="ContentType">The media type it is served as.</param>
/// <param name="ByteCount">Its size, so a library can show what it is spending.</param>
/// <param name="CreatedAtUtc">When it was uploaded.</param>
public sealed record MediaResponse(
    Guid Id,
    string Url,
    string FileName,
    string ContentType,
    int ByteCount,
    DateTimeOffset CreatedAtUtc);

/// <summary>
/// The library, and what is left in it.
///
/// The remaining count is returned rather than worked out on the client, because the
/// limit is the server's and a client that computed it would be a second copy of the
/// rule - free to disagree on the day it changes.
/// </summary>
/// <param name="Items">Every picture, newest first.</param>
/// <param name="Used">How many are held.</param>
/// <param name="Limit">How many may be held.</param>
/// <param name="BytesUsed">What they come to in total.</param>
public sealed record MediaLibraryResponse(
    IReadOnlyList<MediaResponse> Items,
    int Used,
    int Limit,
    long BytesUsed);
