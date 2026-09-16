using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Media;

/// <summary>Why a request against the picture library did not succeed.</summary>
public static class MediaErrors
{
    /// <summary>The account has no restaurant, so there is no library to reach.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("media.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>No picture with that identifier belongs to this restaurant.</summary>
    public static readonly Error NotFound =
        new("media.not_found", "That picture could not be found.");

    /// <summary>Nothing was sent, or what was sent was empty.</summary>
    public static readonly Error Empty =
        new("media.empty", "Choose a picture to upload.");

    /// <summary>Bigger than the limit, either as declared or as it arrived.</summary>
    public static Error TooLarge(int maxBytes) =>
        new(
            "media.too_large",
            $"That picture is larger than {maxBytes / (1024 * 1024)} MB.");

    /// <summary>
    /// Not one of the accepted types, or not what it claimed to be.
    ///
    /// The two are one error on purpose. A file whose bytes disagree with its declared
    /// type is either broken or deliberate, and telling the second case which check it
    /// failed is help it does not deserve.
    /// </summary>
    public static readonly Error TypeNotAllowed =
        new(
            "media.type",
            "Pictures must be JPEG, PNG, WebP or AVIF.");

    /// <summary>The restaurant already holds as many as it may.</summary>
    public static Error LimitReached(int limit) =>
        new(
            "media.limit",
            $"This restaurant is holding {limit} pictures, which is the most it may. Remove one to add another.");
}
