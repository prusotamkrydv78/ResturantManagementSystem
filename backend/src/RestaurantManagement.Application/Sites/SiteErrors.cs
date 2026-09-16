using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Sites;

/// <summary>Why a request against a restaurant's page did not succeed.</summary>
public static class SiteErrors
{
    /// <summary>The account has no restaurant, so there is no page to edit.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("site.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>
    /// Nothing is published at that address.
    ///
    /// The same error whether the slug is wrong, the page was never published, or the
    /// restaurant is suspended. A visitor gets a not-found page in every case, and
    /// telling them which of the three it was would be telling a stranger which
    /// restaurants exist but are not trading.
    /// </summary>
    public static readonly Error NotFound =
        new("site.not_found", "No website could be found at this address.");

    /// <summary>The content is larger than a page is allowed to be.</summary>
    public static Error ContentTooLarge(int maxBytes) =>
        new(
            "site.content_too_large",
            $"That page is larger than {maxBytes / 1024} KB of text, which is more than any design can draw.");

    /// <summary>No design was named, or the name was nonsense.</summary>
    public static readonly Error DesignMissing =
        new("site.design_missing", "Choose a design before saving.");
}
