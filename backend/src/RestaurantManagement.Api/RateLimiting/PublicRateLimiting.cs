using System.Globalization;
using System.Threading.RateLimiting;

namespace RestaurantManagement.Api.RateLimiting;

/// <summary>
/// Bounds on the routes anybody can reach without signing in.
///
/// Everywhere else in this product a request carries a token, so abuse has a name
/// attached and an account to deactivate. The public ordering routes have neither: the
/// restaurant slug is on its own website, the table identifiers come free from the menu
/// call that has to return them, and nothing else stands between the endpoint and a
/// script.
///
/// What that script can do is worse than noise. Every accepted order seats its table,
/// and only a manager can clear it - so walking the table list once takes the whole
/// dining room out of service, and a restaurant discovers it when real customers cannot
/// pick a table. That is the case these limits exist for, rather than bandwidth.
///
/// Partitioned by remote address, which is the only thing an anonymous caller has. It is
/// a blunt key: a table's worth of people on the restaurant's own wifi share one, and so
/// do the customers of an ISP behind a single NAT. The write limit is therefore set at
/// what a shared address could plausibly need for real ordering rather than at what one
/// person needs, and the read limit well above it - a page load is several reads.
/// </summary>
public static class PublicRateLimiting
{
    /// <summary>
    /// Reads: menus, published sites, resolving a scanned code.
    ///
    /// Loose, because these are what a page load is made of and they change nothing. A
    /// customer refreshing a menu while they decide is normal behaviour and must not be
    /// what trips a limit.
    /// </summary>
    public const string PublicRead = "public-read";

    /// <summary>
    /// Writes: placing an order, calling one off.
    ///
    /// Tight, because this is the expensive one. A real customer does this once or twice
    /// in a sitting; anything approaching the limit is not somebody eating.
    /// </summary>
    public const string PublicWrite = "public-write";

    /// <summary>
    /// Signing in.
    ///
    /// The per-account lockout is what actually stops a password being guessed; this
    /// stops one address trying a single common password against every account in
    /// turn, which a lockout cannot see because no one account fails twice. Set well
    /// above a shift change: a whole kitchen on the restaurant's wifi signs in within
    /// the same few minutes, from the same address.
    /// </summary>
    public const string Login = "auth-login";

    /// <summary>
    /// Pictures served to strangers: dishes, categories, the website's photographs.
    ///
    /// Generous, because one menu page is dozens of them, and every one of them used to
    /// be unlimited - each read a stored image out of the database for anybody who
    /// asked, as often as they asked.
    /// </summary>
    public const string PublicMedia = "public-media";

    /// <summary>Registers both policies and the 429 they answer with.</summary>
    public static IServiceCollection AddPublicRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // 429 rather than the default 503. The caller is being asked to slow down,
            // not told the restaurant is broken.
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Retry-After, so a well-behaved client waits the right amount rather than
            // guessing. Read off the limiter itself when it knows.
            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }

                // A problem document rather than plain text, because that is what every
                // other refusal from this API is and what the client reads the message
                // out of. Plain text fell through to a generic "something went wrong",
                // which told a locked-out person nothing about waiting.
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new Microsoft.AspNetCore.Mvc.ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Too many requests",
                        Detail = "Too many requests. Please wait a moment and try again.",
                    },
                    options: null,
                    contentType: "application/problem+json",
                    cancellationToken: cancellationToken);
            };

            options.AddPolicy(
                PublicRead,
                context => Partition(context, permitLimit: 120));

            options.AddPolicy(
                PublicWrite,
                context => Partition(context, permitLimit: 12));

            options.AddPolicy(
                Login,
                context => Partition(context, permitLimit: 30));

            options.AddPolicy(
                PublicMedia,
                context => Partition(context, permitLimit: 600));
        });

        return services;
    }

    /// <summary>
    /// One fixed window a minute, per caller address.
    ///
    /// A fixed window rather than a sliding one on purpose: it is the cheapest to hold in
    /// memory for a large number of short-lived partitions, and the edge effect it is
    /// criticised for - twice the limit across a window boundary - does not matter when
    /// the limit exists to stop a sustained script rather than to meter anything.
    ///
    /// A missing remote address falls into one shared bucket. That is deliberate: it is
    /// the safe direction, and the alternative is a request with no partition key at all
    /// bypassing the limit entirely.
    ///
    /// The address is the visitor's only once forwarded headers have been applied, which
    /// Program.cs does first. Behind a proxy without that, every request carries the
    /// proxy's address and the whole platform shares one bucket - twelve guest orders a
    /// minute across every restaurant at once.
    /// </summary>
    private static RateLimitPartition<string> Partition(HttpContext context, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
                // No queue. Making a phone wait for a slot is worse than telling it to
                // try again, and a queue is a place for a flood to accumulate.
                QueueLimit = 0,
            });
}
