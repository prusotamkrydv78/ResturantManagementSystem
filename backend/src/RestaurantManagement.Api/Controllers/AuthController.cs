using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Authentication.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Authentication endpoints. This controller stays thin: it maps requests to
/// <see cref="IAuthService"/>, translates results to status codes, and owns the
/// refresh token cookie. No authentication logic lives here.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly RefreshTokenCookie _refreshCookie;

    /// <summary>Creates the controller.</summary>
    public AuthController(IAuthService authService, RefreshTokenCookie refreshCookie)
    {
        _authService = authService;
        _refreshCookie = refreshCookie;
    }

    // There is deliberately no registration endpoint.
    //
    // Nobody signs themselves up for this product. A platform administrator creates a
    // restaurant and issues its manager an account; that manager issues accounts to
    // their own staff. Every account therefore arrives already attached to a restaurant
    // and a role, which is what makes "which restaurant is this person" answerable at
    // all. Self-registration could only ever have produced an account belonging to
    // nowhere, and an open endpoint that creates them is a liability with no product
    // behind it.

    /// <summary>Signs in with email and password.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(request, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status401Unauthorized)
            : IssueSession(result.Value);
    }

    /// <summary>
    /// Exchanges the refresh token cookie for a new access token, rotating the
    /// refresh token in the process.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken)
    {
        // The refresh token is only ever read from the cookie, never from the body,
        // so a caller cannot supply an arbitrary token value.
        var refreshToken = _refreshCookie.Read(Request);

        var result = await _authService.RefreshAsync(refreshToken ?? string.Empty, cancellationToken);

        if (result.IsFailure)
        {
            // Drop a cookie that can no longer be used, so the browser stops sending it.
            _refreshCookie.Clear(Response);
            return ProblemFrom(result.Error!, StatusCodes.Status401Unauthorized);
        }

        return IssueSession(result.Value);
    }

    /// <summary>Revokes the current refresh token and clears the cookie.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await _authService.LogoutAsync(_refreshCookie.Read(Request), cancellationToken);

        _refreshCookie.Clear(Response);

        // Always 204: whether a valid session existed is not revealed to the caller.
        return NoContent();
    }

    /// <summary>Returns the user identified by the access token.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
    {
        // The identifier comes from the validated token only. A client-supplied id is
        // never trusted for this.
        var userId = User.GetUserId();

        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _authService.GetUserByIdAsync(userId.Value, cancellationToken);

        return result.IsFailure
            ? ProblemFrom(result.Error!, StatusCodes.Status401Unauthorized)
            : Ok(result.Value);
    }

    /// <summary>
    /// Writes the refresh token to its cookie and returns only the access token part
    /// of the result, so the refresh token never appears in a response body.
    /// </summary>
    private ActionResult<AuthResponse> IssueSession(AuthenticationResult result)
    {
        _refreshCookie.Write(Response, result.RefreshToken, result.RefreshTokenExpiresAtUtc);
        return Ok(result.Response);
    }

    private ObjectResult ProblemFrom(Error error, int statusCode) =>
        Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: "Authentication failed",
            type: null,
            instance: Request.Path);
}
