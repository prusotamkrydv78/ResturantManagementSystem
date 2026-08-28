namespace RestaurantManagement.Application.Managers.Dtos;

/// <summary>The restaurant a manager runs, as returned inside a manager payload.</summary>
/// <param name="Id">Restaurant identifier.</param>
/// <param name="Name">Restaurant name.</param>
/// <param name="Slug">Restaurant slug.</param>
public sealed record AssignedRestaurantDto(Guid Id, string Name, string Slug);

/// <summary>
/// A restaurant manager, as returned to a Super Admin.
///
/// Projected from the Identity entity so no password hash, security stamp or token
/// data can leak.
/// </summary>
/// <param name="Id">Account identifier.</param>
/// <param name="FullName">Display name.</param>
/// <param name="Email">Email address, also the login name.</param>
/// <param name="IsAssigned">True when the manager currently runs a restaurant.</param>
/// <param name="Restaurant">The restaurant they run, or null when unassigned.</param>
/// <param name="CreatedAtUtc">When the account was created.</param>
public sealed record ManagerResponse(
    Guid Id,
    string FullName,
    string Email,
    bool IsAssigned,
    AssignedRestaurantDto? Restaurant,
    DateTimeOffset CreatedAtUtc);
