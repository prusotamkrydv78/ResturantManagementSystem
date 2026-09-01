namespace RestaurantManagement.Domain.Media;

/// <summary>
/// What counts as an image anywhere in this product.
///
/// One list and one check, shared by the website's picture library and by the
/// photograph on an inventory item. Two copies would be two chances for a type
/// judged unsafe in one place to be quietly accepted in the other, and the whole
/// point of a whitelist is that it is the only door.
/// </summary>
public static class ImageMedia
{
    /// <summary>
    /// The media types accepted, and the extension each is stored under.
    ///
    /// A whitelist, so anything not named here is refused rather than trusted for
    /// looking plausible. SVG is deliberately absent: it is a document that can
    /// carry script, and it would be served from the same origin as the page.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["image/avif"] = ".avif",
        };

    /// <summary>
    /// Whether the bytes begin the way the declared type says they should.
    ///
    /// Not a full decode, which would mean an imaging library for a check this
    /// cheap. It is enough to stop a file being stored under a picture's media type
    /// while containing something else - the browser sniffs content, so a script
    /// served as an image is not a hypothetical problem.
    /// </summary>
    public static bool LooksLikeImage(byte[] bytes, string contentType)
    {
        if (bytes.Length < 12)
        {
            return false;
        }

        return contentType.ToLowerInvariant() switch
        {
            // SOI marker.
            "image/jpeg" => bytes[0] == 0xFF && bytes[1] == 0xD8,
            // The eight byte PNG signature.
            "image/png" =>
                bytes[0] == 0x89 && bytes[1] == 0x50 &&
                bytes[2] == 0x4E && bytes[3] == 0x47,
            // Both sit in a RIFF or ISO base media container; the brand is at byte 8.
            "image/webp" =>
                bytes[0] == 0x52 && bytes[1] == 0x49 &&
                bytes[2] == 0x46 && bytes[3] == 0x46 &&
                bytes[8] == 0x57 && bytes[9] == 0x45 &&
                bytes[10] == 0x42 && bytes[11] == 0x50,
            "image/avif" =>
                bytes[4] == 0x66 && bytes[5] == 0x74 &&
                bytes[6] == 0x79 && bytes[7] == 0x70,
            _ => false,
        };
    }

    /// <summary>
    /// A display name, stripped of anything that is not a name.
    ///
    /// Never used to open a file - the bytes live in a column - but it is rendered
    /// back to the manager, so a path is reduced to its last segment and the length
    /// is bounded.
    /// </summary>
    public static string SafeFileName(string fileName, string contentType)
    {
        var name = Path.GetFileName(fileName ?? string.Empty).Trim();

        if (name.Length == 0)
        {
            return $"image{AllowedTypes[contentType]}";
        }

        return name.Length > 128 ? name[^128..] : name;
    }
}
