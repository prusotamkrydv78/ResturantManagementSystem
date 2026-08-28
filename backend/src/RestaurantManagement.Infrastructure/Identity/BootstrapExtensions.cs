using Microsoft.Extensions.DependencyInjection;

namespace RestaurantManagement.Infrastructure.Identity;

/// <summary>Startup hook for the identity bootstrap.</summary>
public static class BootstrapExtensions
{
    /// <summary>
    /// Runs the Super Admin bootstrap in its own service scope. Call once during
    /// startup, after the database has been migrated.
    /// </summary>
    public static async Task BootstrapIdentityAsync(
        this IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();

        var bootstrapper = scope.ServiceProvider.GetRequiredService<IdentityBootstrapper>();

        await bootstrapper.EnsureSuperAdminAsync(cancellationToken);
    }
}
