namespace RestaurantManagement.Application.Authentication.Dtos;

/// <summary>
/// User data that is safe to return to a client. Identity entities are never exposed
/// directly, so no password hash or security stamp can leak.
/// </summary>
/// <param name="Id">The identifier of the user.</param>
/// <param name="FullName">The display name of the user.</param>
/// <param name="Email">The email address of the user.</param>
/// <param name="PlatformRole">Platform-level role name, for example "User" or "SuperAdmin".</param>
/// <param name="StaffRole">
/// What a staff member does on the floor, for example "Waiter". Null for anyone who
/// is not staff. Included so the client can show the right workspace; it is never
/// the basis for authorization, which the API decides for itself.
/// </param>
public sealed record UserDto(
    Guid Id,
    string FullName,
    string Email,
    string PlatformRole,
    string? StaffRole);
