using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>
/// How a restaurant is configured to operate.
///
/// Kept apart from the restaurant profile on purpose. The profile is what a guest
/// would recognise — name, address, how to get in touch — and it is edited rarely.
/// These are the values other parts of the system read to compute with, and getting
/// one of them wrong makes a figure wrong rather than a page look untidy.
/// </summary>
/// <param name="TimeZoneId">The IANA zone the restaurant operates in.</param>
/// <param name="TimeZoneDisplayName">
/// A readable name for that zone, so a screen can confirm the choice without shipping
/// its own table of zone names that could disagree with the server.
/// </param>
/// <param name="CurrentUtcOffsetMinutes">
/// What the zone is worth against UTC right now, including any daylight saving in
/// force. Sent so a manager can see the effect of the setting rather than having to
/// trust the identifier, and derived on each read rather than stored.
/// </param>
/// <param name="DayStartHour">The local hour a service day begins.</param>
/// <param name="ServiceDayStartedAtUtc">
/// The instant the current service day began, as the dashboard computes it. The one
/// number that proves the configuration is doing what the manager intended.
/// </param>
public sealed record RestaurantSettingsResponse(
    string TimeZoneId,
    string TimeZoneDisplayName,
    int CurrentUtcOffsetMinutes,
    int DayStartHour,
    DateTimeOffset ServiceDayStartedAtUtc);

/// <summary>
/// Payload for changing how a restaurant operates.
///
/// There is no restaurant field: the restaurant comes from the manager who owns it.
/// Both values are required rather than optional, so a partial save cannot leave the
/// pair half-applied and the caller always states the configuration it intends.
/// </summary>
public sealed class UpdateRestaurantSettingsRequest
{
    /// <summary>
    /// The IANA zone identifier, such as "Asia/Kathmandu".
    ///
    /// Checked against the zones this machine actually knows rather than against a
    /// pattern: a well-formed identifier that no zone database recognises would be
    /// accepted by a regular expression and then fail every time a day boundary was
    /// computed.
    /// </summary>
    [Required(ErrorMessage = "Choose the timezone the restaurant operates in.")]
    [StringLength(64, ErrorMessage = "That is not a timezone identifier.")]
    public string TimeZoneId { get; set; } = string.Empty;

    /// <summary>The local hour a service day begins, from 0 to 23.</summary>
    [Range(
        Restaurant.MinDayStartHour,
        Restaurant.MaxDayStartHour,
        ErrorMessage = "A service day has to start at an hour between 0 and 23.")]
    public int DayStartHour { get; set; }
}

/// <summary>
/// One timezone a restaurant may be set to.
///
/// Offered by the server rather than listed in the client, so the options can never
/// include something the validation would reject, and a machine with a different zone
/// database cannot end up with a screen promising zones it does not have.
/// </summary>
/// <param name="Id">The IANA identifier to send back.</param>
/// <param name="DisplayName">What to show in the list.</param>
/// <param name="CurrentUtcOffsetMinutes">Its offset right now, for sorting and context.</param>
public sealed record TimeZoneOptionResponse(
    string Id,
    string DisplayName,
    int CurrentUtcOffsetMinutes);
