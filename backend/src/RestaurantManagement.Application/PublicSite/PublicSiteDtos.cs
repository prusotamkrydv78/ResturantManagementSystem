using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Reservations;

namespace RestaurantManagement.Application.PublicSite.Dtos;

/// <summary>
/// A table asked for from the restaurant's own website.
///
/// Deliberately smaller than the booking a manager takes: no table, no duration, no
/// customer record to pick. A guest says who they are, when, and for how many; the
/// request lands in the reservations book as pending, and the restaurant confirms it
/// by phone like any other. A name and a phone number are both required, because the
/// restaurant has to be able to call back - an anonymous request cannot be confirmed.
/// </summary>
public sealed class PublicBookingRequest
{
    /// <summary>Who the table is for.</summary>
    [Required(ErrorMessage = "Enter your name.")]
    [StringLength(Customer.MaxNameLength, MinimumLength = 2, ErrorMessage = "Enter your name.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>How the restaurant can call back to confirm.</summary>
    [Required(ErrorMessage = "Enter a phone number so the restaurant can confirm.")]
    [StringLength(Customer.MaxPhoneLength, MinimumLength = 5, ErrorMessage = "Enter a phone number so the restaurant can confirm.")]
    public string Phone { get; set; } = string.Empty;

    /// <summary>When they would like to come, as an instant.</summary>
    [Required(ErrorMessage = "Choose when you would like to come.")]
    public DateTimeOffset ReservedForUtc { get; set; }

    /// <summary>How many people. Larger parties are a conversation, not a form.</summary>
    [Range(1, PublicBookingLimits.MaxGuests, ErrorMessage = "Book online for between 1 and 20 guests; call for larger parties.")]
    public int GuestCount { get; set; }

    /// <summary>Anything they would like the restaurant to know.</summary>
    [StringLength(Reservation.MaxNotesLength, ErrorMessage = "Notes cannot be longer than 500 characters.")]
    public string? Notes { get; set; }
}

/// <summary>The limits a website booking is held to.</summary>
public static class PublicBookingLimits
{
    /// <summary>The largest party a guest can book online.</summary>
    public const int MaxGuests = 20;

    /// <summary>How soon a booking may be for: a restaurant needs a little notice.</summary>
    public static readonly TimeSpan MinimumNotice = TimeSpan.FromMinutes(30);

    /// <summary>How far ahead a booking may be for.</summary>
    public static readonly TimeSpan Horizon = TimeSpan.FromDays(90);
}

/// <summary>What a guest is told once their request is in.</summary>
/// <param name="Reference">The booking's identifier, for the guest to quote if they call.</param>
/// <param name="RestaurantName">Who they asked.</param>
/// <param name="ReservedForUtc">When, as recorded.</param>
/// <param name="GuestCount">How many, as recorded.</param>
public sealed record PublicBookingResponse(
    Guid Reference,
    string RestaurantName,
    DateTimeOffset ReservedForUtc,
    int GuestCount);

/// <summary>
/// What guests have said, as a restaurant's website shows it.
///
/// Anonymous by construction: a review carries no name, so none can leak. Only reviews
/// that left words are listed - a bare score says nothing to a stranger - but the
/// average and the count are over every review, so the figure is not flattered by
/// which ones happened to say something.
/// </summary>
/// <param name="AverageRating">The mean score over every review, or null when there are none.</param>
/// <param name="Count">How many reviews the average is over.</param>
/// <param name="Reviews">The most recent reviews that left a comment, newest first.</param>
public sealed record PublicReviewsResponse(
    double? AverageRating,
    int Count,
    IReadOnlyList<PublicReviewItem> Reviews);

/// <summary>One review, as a stranger sees it.</summary>
/// <param name="Rating">The overall score, 1 to 5.</param>
/// <param name="Comment">What they wrote.</param>
/// <param name="SubmittedAtUtc">When they wrote it.</param>
public sealed record PublicReviewItem(int Rating, string Comment, DateTimeOffset SubmittedAtUtc);
