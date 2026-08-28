using Microsoft.Extensions.DependencyInjection;

namespace RestaurantManagement.Application;

/// <summary>
/// Registration entry point for the application layer.
/// Future modules add their use case services here.
/// </summary>
public static class DependencyInjection
{
    /// <summary>Registers application layer services.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Authentication is declared here as a contract only; the implementation
        // lives in the infrastructure layer because it needs Identity and EF Core.
        return services;
    }
}
