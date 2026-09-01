namespace RestaurantManagement.Domain.Identity;

/// <summary>
/// A staff member's photograph.
///
/// For recognition rather than for show: a manager with thirty people on the books
/// across three shifts is matching a name to a face, and a roster of names alone does
/// not help with that.
///
/// A table of its own, and here the reason is sharper than elsewhere. The user row is
/// read on every sign-in and every token refresh, by Identity, on the hottest path in
/// the application. A blob column on it would be loaded on all of those. Bytes in a
/// separate table are read only when something asks for them by name, and nothing on
/// the authentication path ever does.
///
/// The bytes live in the database, the same trade the rest of the product makes: the
/// host has an ephemeral filesystem that a redeploy wipes.
///
/// One row per account, enforced by the key. Replacing overwrites it, so the account
/// carries a timestamp that versions the URL.
/// </summary>
public class StaffImage
{
    /// <summary>Largest photograph accepted, in bytes.</summary>
    public const int MaxBytes = 2 * 1024 * 1024;

    /// <summary>
    /// Where a staff member's picture is served from, or null when they have none.
    ///
    /// One definition, because the roster and the individual record both build it and
    /// both need the version stamp - the response is cached for a year, so the URL has
    /// to move whenever the bytes do.
    /// </summary>
    public static string? UrlFor(Guid userId, DateTimeOffset? updatedAtUtc) =>
        updatedAtUtc is null
            ? null
            : $"/api/staff/{userId}/image?v={updatedAtUtc.Value.UtcTicks}";

    /// <summary>
    /// Primary key, and the foreign key to the account. One picture per person falls
    /// out of the key rather than needing a rule.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>Navigation to the account this belongs to.</summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// The restaurant, denormalised from the account, so a request can be authorised
    /// without loading the user.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>
    /// The media type served back, from a checked whitelist rather than from what the
    /// browser claimed.
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, kept so a count need not read the bytes themselves.</summary>
    public int ByteCount { get; set; }

    /// <summary>The image itself.</summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When these bytes were stored.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
