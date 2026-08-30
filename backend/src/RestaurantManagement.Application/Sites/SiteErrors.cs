using RestaurantManagement.Domain.Sites;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Sites;

/// <summary>Failures the website module can report.</summary>
public static class SiteErrors
{
    /// <summary>The caller does not manage a restaurant, so has no page.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("site.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>
    /// No published page answers to that address.
    ///
    /// One error for a slug that does not exist and for a page that exists but is
    /// not published, so an unpublished draft cannot be detected from outside.
    /// </summary>
    public static readonly Error NotFound =
        new("site.not_found", "No website could be found at this address.");

    /// <summary>The image is not in the caller restaurant, or is not there at all.</summary>
    public static readonly Error ImageNotFound =
        new("site.image_not_found", "The image could not be found.");

    /// <summary>Nothing was attached, or the attachment was empty.</summary>
    public static readonly Error ImageEmpty =
        new("site.image_empty", "Choose an image to upload.");

    /// <summary>The upload is larger than one row should carry.</summary>
    public static readonly Error ImageTooLarge =
        new(
            "site.image_too_large",
            $"Images must be {SiteImageLimits.MaxBytes / (1024 * 1024)}MB or smaller.");

    /// <summary>The file is not one of the accepted picture formats.</summary>
    public static readonly Error ImageTypeNotAllowed =
        new(
            "site.image_type",
            "Upload a JPEG, PNG, WebP or AVIF picture.");

    /// <summary>
    /// The restaurant is holding as many images as it may.
    ///
    /// A cap rather than a bill: the bytes sit in the operational database, so an
    /// unbounded gallery is a cost every other query pays.
    /// </summary>
    public static readonly Error ImageLimitReached =
        new(
            "site.image_limit",
            $"A restaurant can keep {SiteImageLimits.MaxPerRestaurant} images. " +
            "Delete one you are not using first.");

    /// <summary>The accent is not a colour.</summary>
    public static readonly Error AccentInvalid =
        new(
            "site.accent_invalid",
            "The accent colour must be a hex value such as #b45309.");

    /// <summary>
    /// A link points somewhere a link on this page may not.
    ///
    /// The manager writes these and a visitor clicks them, so the scheme is checked
    /// rather than trusted: `javascript:` in an href is script execution dressed as
    /// a button.
    /// </summary>
    public static Error LinkInvalid(string field) =>
        new(
            "site.link_invalid",
            $"The link in {field} must start with http://, https://, mailto: or tel:.");
}
