namespace RestaurantManagement.Application.Restaurants.Dtos;

/// <summary>The assigned manager, as returned to a client.</summary>
/// <param name="Id">Identifier of the manager account.</param>
/// <param name="FullName">Display name.</param>
/// <param name="Email">Email address, also the login name.</param>
public sealed record RestaurantManagerDto(Guid Id, string FullName, string Email);

/// <summary>Full restaurant detail. Entities are never returned directly.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Slug">URL-friendly unique identifier.</param>
/// <param name="ContactEmail">Optional contact email.</param>
/// <param name="ContactPhone">Optional contact phone.</param>
/// <param name="AddressLine">Optional street address.</param>
/// <param name="City">Optional city.</param>
/// <param name="Country">Optional country.</param>
/// <param name="Manager">The assigned manager, or null when none is assigned yet.</param>
/// <param name="CreatedAtUtc">Creation timestamp.</param>
/// <param name="UpdatedAtUtc">Last modification timestamp.</param>
public sealed record RestaurantResponse(
    Guid Id,
    string Name,
    string Slug,
    string? ContactEmail,
    string? ContactPhone,
    string? AddressLine,
    string? City,
    string? Country,
    RestaurantManagerDto? Manager,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>Condensed restaurant row for list views.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Slug">URL-friendly unique identifier.</param>
/// <param name="City">Optional city.</param>
/// <param name="ManagerId">Identifier of the assigned manager, or null when unassigned.</param>
/// <param name="ManagerName">Name of the assigned manager, or null when unassigned.</param>
/// <param name="ManagerEmail">Email of the assigned manager, or null when unassigned.</param>
/// <param name="CreatedAtUtc">Creation timestamp.</param>
public sealed record RestaurantSummaryResponse(
    Guid Id,
    string Name,
    string Slug,
    string? City,
    Guid? ManagerId,
    string? ManagerName,
    string? ManagerEmail,
    DateTimeOffset CreatedAtUtc);
