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

    /// <summary>
    /// The timezone identifier is not one this machine knows.
    ///
    /// Refused rather than stored: an identifier that merely looks plausible would be
    /// accepted and then ignored by every day boundary computed afterwards, which is a
    /// far worse failure than a rejected save.
    /// </summary>
    public static readonly Error UnknownTimeZone =
        new(
            "platform.unknown_timezone",
            "That timezone is not one this server recognises.");
}
