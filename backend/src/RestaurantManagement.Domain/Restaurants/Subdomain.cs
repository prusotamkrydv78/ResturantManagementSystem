using System.Text.RegularExpressions;

namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// The label a restaurant's website answers on, as in <c>kanchan.eatery.np</c>.
///
/// WHY THIS IS NOT THE SLUG
///
/// The slug is already unique and already URL-friendly, and reusing it would have
/// saved a column. It is also the address in every guest ordering link the restaurant
/// has printed - the QR code stuck to table nine points at <c>/r/{slug}/order</c> -
/// and the edit form has warned about that for as long as it has existed.
///
/// Tying the public web address to it would mean that renaming a website invalidates
/// every QR code in the building, which is a thing a restaurant would do cheerfully,
/// once, on a quiet Tuesday. Two columns is the cheaper mistake.
///
/// WHAT A LABEL MAY BE
///
/// Stricter than a slug, because this one becomes part of a hostname and DNS does not
/// negotiate: letters, digits and hyphens, not starting or ending with a hyphen, and
/// no longer than sixty-three characters. Upper case is folded rather than refused,
/// since a hostname is case-insensitive and a manager typing their restaurant's name
/// with a capital has not made a mistake worth an error message.
/// </summary>
public static class Subdomain
{
    /// <summary>The longest a single DNS label may be.</summary>
    public const int MaxLength = 63;

    /// <summary>
    /// The shortest one this product will issue.
    ///
    /// Three rather than one. Single and double letter labels are the ones worth
    /// something, and handing them out first-come to whoever registers first is how a
    /// platform ends up with a restaurant sitting on <c>hq</c>.
    /// </summary>
    public const int MinLength = 3;

    private static readonly Regex Shape = new(
        "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$",
        RegexOptions.Compiled);

    /// <summary>
    /// Labels the platform keeps for itself.
    ///
    /// Every one of these either already resolves to something or will: the app, the
    /// API, the marketing site, the mail records. A restaurant granted <c>www</c>
    /// would take the platform's own front door with it.
    /// </summary>
    private static readonly HashSet<string> Reserved = new(StringComparer.Ordinal)
    {
        "admin", "api", "app", "assets", "billing", "blog", "cdn", "dashboard",
        "dev", "docs", "ftp", "help", "host", "imap", "mail", "manage", "media",
        "mx", "ns", "ns1", "ns2", "order", "orders", "pop", "portal", "public",
        "root", "secure", "smtp", "sso", "staging", "static", "status", "support",
        "system", "test", "webmail", "www",
    };

    /// <summary>
    /// The label as it would be stored, or null when there is nothing to store.
    ///
    /// Folds case and trims, and does nothing else: a value that is not already a
    /// valid label is not quietly rewritten into one. Silently turning
    /// <c>"The Kanchan"</c> into <c>"the-kanchan"</c> would hand a restaurant an
    /// address nobody chose and nobody expected.
    /// </summary>
    public static string? Normalise(string? value)
    {
        var trimmed = value?.Trim().ToLowerInvariant();

        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>Whether a normalised label may be used.</summary>
    public static bool IsValid(string label) =>
        label.Length >= MinLength &&
        label.Length <= MaxLength &&
        Shape.IsMatch(label) &&
        !IsReserved(label);

    /// <summary>Whether the platform keeps this label for itself.</summary>
    public static bool IsReserved(string label) => Reserved.Contains(label);

    /// <summary>
    /// A first suggestion for a restaurant that has none, from something it already has.
    ///
    /// Only ever a starting point: it is offered when a restaurant is created and can
    /// be changed afterwards. Returns null when nothing usable survives, which is the
    /// honest outcome for a name written entirely in a script this cannot transcribe -
    /// better an address chosen deliberately than <c>restaurant-4</c>.
    /// </summary>
    public static string? SuggestFrom(string source)
    {
        var label = new string(
            source
                .Trim()
                .ToLowerInvariant()
                .Select(character => char.IsLetterOrDigit(character) ? character : '-')
                .ToArray());

        // Collapse the runs the substitution above creates, then trim the edges DNS
        // will not accept.
        while (label.Contains("--", StringComparison.Ordinal))
        {
            label = label.Replace("--", "-", StringComparison.Ordinal);
        }

        label = label.Trim('-');

        if (label.Length > MaxLength)
        {
            label = label[..MaxLength].TrimEnd('-');
        }

        return label.Length >= MinLength && IsValid(label) ? label : null;
    }
}
