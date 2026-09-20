namespace RestaurantManagement.Application.Media.Dtos;

/// <summary>
/// One picture in a restaurant's library, as the manager's screens read it.
///
/// Carries the identifier rather than an address, and that is the deliberate half of
/// this record. A page stores what goes in a photograph slot for years; storing
/// <c>/api/media/...</c> there would bake today's route into every page ever saved, so
/// the day it gains a CDN or resized variants each of them points at the old one. The
/// identifier is the fact, the address is a rendering of it, and rendering belongs at
/// the point of use.
/// </summary>
/// <param name="Id">Identifier: what a page stores, and what an address is built from.</param>
/// <param name="FileName">What it was called when it was uploaded.</param>
/// <param name="ContentType">The media type it is served as.</param>
/// <param name="ByteCount">Its size, so a library can show what it is spending.</param>
/// <param name="CreatedAtUtc">When it was uploaded.</param>
public sealed record MediaResponse(
    Guid Id,
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
/// <param name="MaxBytes">The largest single picture, so the editor can refuse one
/// before sending it rather than after. Returned for the same reason as the count: a
/// client that hardcoded it would be a second copy of the rule, free to disagree on
/// the day it changes.</param>
public sealed record MediaLibraryResponse(
    IReadOnlyList<MediaResponse> Items,
    int Used,
    int Limit,
    long BytesUsed,
    int MaxBytes);
