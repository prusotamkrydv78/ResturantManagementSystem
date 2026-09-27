using RestaurantManagement.Application.PublicSite.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.PublicSite;

/// <summary>
/// What a restaurant's own website can do for a stranger beyond showing itself:
/// take a booking request and show what guests have said.
///
/// Keyed by the address the site answers on - the restaurant's slug or its subdomain,
/// either resolves the same restaurant - and only for a restaurant that is trading:
/// a suspended restaurant answers as though it does not exist.
/// </summary>
public interface IPublicSiteService
{
    /// <summary>
    /// Records a table request as a pending booking, and the guest as a customer (or
    /// matches them to the one already on the books with that phone number).
    /// </summary>
    /// <param name="slug">The restaurant's slug or subdomain.</param>
    /// <param name="request">Who, when and how many.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<PublicBookingResponse>> RequestBookingAsync(
        string slug,
        PublicBookingRequest request,
        CancellationToken cancellationToken);

    /// <summary>The average score and the most recent reviews that left a comment.</summary>
    /// <param name="slug">The restaurant's slug or subdomain.</param>
    /// <param name="limit">How many commented reviews to return, at most.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Result<PublicReviewsResponse>> GetReviewsAsync(
        string slug,
        int limit,
        CancellationToken cancellationToken);
}

/// <summary>Failures the public website endpoints can report.</summary>
public static class PublicSiteErrors
{
    /// <summary>No trading restaurant answers on that address.</summary>
    public static readonly Error NotFound =
        new("public_site.not_found", "That restaurant could not be found.");

    /// <summary>The time asked for is too soon or too far ahead.</summary>
    public static readonly Error TimeOutOfRange =
        new(
            "public_site.time_out_of_range",
            "Choose a time at least 30 minutes from now and within the next 90 days.");
}
