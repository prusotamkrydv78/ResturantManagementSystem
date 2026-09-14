using System.Security.Claims;
using RestaurantManagement.Application.Authentication;

namespace RestaurantManagement.Api.Authentication;

/// <summary>
/// Who is signed in, read from the validated token on the request being served.
///
/// Lives at the API boundary because that is the only layer that knows what a request
/// is. Everything below it depends on the interface, which is why a service can record
/// who did something without being handed an HTTP context it has no business holding.
///
/// Both properties read the same claims the authorisation pipeline already validated, so
/// this cannot report an identity the request did not actually prove.
/// </summary>
public sealed class HttpContextCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    /// <summary>Creates the accessor.</summary>
    public HttpContextCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    /// <inheritdoc />
    public Guid? UserId => _accessor.HttpContext?.User.GetUserId();

    /// <inheritdoc />
    public string? FullName =>
        _accessor.HttpContext?.User.FindFirstValue(JwtClaimNames.Name);
}
