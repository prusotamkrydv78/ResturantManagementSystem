using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Application.Authentication;

/// <summary>
/// Role names as compile-time constants, for use in <c>[Authorize(Roles = ...)]</c>.
/// Derived from <see cref="PlatformRole"/> with <c>nameof</c> so renaming the enum
/// cannot silently break an authorization attribute.
/// </summary>
public static class PlatformRoles
{
    /// <summary>The platform operator.</summary>
    public const string SuperAdmin = nameof(PlatformRole.SuperAdmin);

    /// <summary>Manager of a single restaurant.</summary>
    public const string RestaurantManager = nameof(PlatformRole.RestaurantManager);

    /// <summary>Works in a single restaurant.</summary>
    public const string Staff = nameof(PlatformRole.Staff);

    /// <summary>
    /// Either role that configures a restaurant, for the handful of reference lookups
    /// both need. A comma-separated list in <c>Roles</c> means "any of these".
    /// </summary>
    public const string SuperAdminOrManager = SuperAdmin + "," + RestaurantManager;
}
