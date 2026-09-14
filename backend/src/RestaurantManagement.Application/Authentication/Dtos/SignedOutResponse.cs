namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>
/// How many sessions a sign-out-everywhere actually ended.
/// </summary>
/// <param name="SessionsEnded">
/// Refresh tokens that were live and are now revoked, this browser included.
///
/// Returned rather than swallowed because the figure is the reassurance: somebody who
/// presses this believes a session exists that should not, and "3 sessions ended" and
/// "nothing was signed in but you" are very different answers to that worry.
/// </param>
public sealed record SignedOutResponse(int SessionsEnded);
