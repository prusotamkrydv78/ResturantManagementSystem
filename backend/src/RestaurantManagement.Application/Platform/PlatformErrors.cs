using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Platform;

/// <summary>Failures the platform module can report.</summary>
public static class PlatformErrors
{
    /// <summary>
    /// No restaurant with that identifier exists.
    ///
    /// Unlike everywhere else in this product, there is nothing to hide here: a platform
    /// administrator may legitimately reach every restaurant, so a not-found means the
    /// identifier is genuinely wrong rather than that it belongs to somebody else.
    /// </summary>
    /// <summary>A rate was outside the range a rate can be.</summary>
    public static readonly Error RateOutOfRange =
        new("platform.rate_out_of_range", "A rate has to be between 0 and 1.");

    public static readonly Error RestaurantNotFound =
        new("platform.restaurant_not_found", "That restaurant could not be found.");

    /// <summary>The range runs backwards. Refused rather than quietly swapped.</summary>
    public static readonly Error RangeBackwards =
        new(
            "platform.range_backwards",
            "The start of the range comes after its end. Check the dates.");

    /// <summary>
    /// The range is longer than one request will cover.
    ///
    /// The bound matters more here than on a single restaurant report, because this one
    /// walks every restaurant on the platform at once.
    /// </summary>
    public static Error RangeTooLong(int maximumDays) =>
        new(
            "platform.range_too_long",
            $"A platform report covers at most {maximumDays} days at a time. Narrow the range.");


}
