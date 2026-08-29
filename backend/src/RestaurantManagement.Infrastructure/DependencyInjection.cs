using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Billing;
using RestaurantManagement.Application.Customers;
using RestaurantManagement.Application.Dashboard;
using RestaurantManagement.Application.Floor;
using RestaurantManagement.Application.Inventory;
using RestaurantManagement.Application.Kitchen;
using RestaurantManagement.Application.Managers;
using RestaurantManagement.Application.Menu;
using RestaurantManagement.Application.Orders;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Application.PublicOrdering;
using RestaurantManagement.Application.Reports;
using RestaurantManagement.Application.Reservations;
using RestaurantManagement.Application.Restaurants;
using RestaurantManagement.Application.Staff;
using RestaurantManagement.Application.Tables;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Infrastructure.Authentication;
using RestaurantManagement.Infrastructure.Billing;
using RestaurantManagement.Infrastructure.Customers;
using RestaurantManagement.Infrastructure.Dashboard;
using RestaurantManagement.Infrastructure.Floor;
using RestaurantManagement.Infrastructure.Identity;
using RestaurantManagement.Infrastructure.Inventory;
using RestaurantManagement.Infrastructure.Kitchen;
using RestaurantManagement.Infrastructure.Managers;
using RestaurantManagement.Infrastructure.Menu;
using RestaurantManagement.Infrastructure.Orders;
using RestaurantManagement.Infrastructure.PublicOrdering;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Infrastructure.Platform;
using RestaurantManagement.Infrastructure.Reports;
using RestaurantManagement.Infrastructure.Reservations;
using RestaurantManagement.Infrastructure.Restaurants;
using RestaurantManagement.Infrastructure.Staff;
using RestaurantManagement.Infrastructure.Tables;

namespace RestaurantManagement.Infrastructure;

/// <summary>
/// Registration entry point for the infrastructure layer.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers the database context, ASP.NET Core Identity, and other
    /// infrastructure services.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when required configuration is missing.
    /// </exception>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured.");
        }

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddAuthenticationInfrastructure(configuration);

        services.AddScoped<IRestaurantService, RestaurantService>();
        services.AddScoped<IManagerService, ManagerService>();
        services.AddScoped<IStaffService, StaffService>();
        services.AddScoped<ITableService, TableService>();
        services.AddScoped<IMenuService, MenuService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IKitchenService, KitchenService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IFloorService, FloorService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IReservationService, ReservationService>();
        // Serves the platform administrator, who owns no restaurant. The only service
        // here that reads across all of them, which is why the role gate sits on its
        // controller rather than on a restaurant lookup.
        services.AddScoped<IPlatformService, PlatformService>();
        // Serves guests who are not signed in. Registered the same way as everything else
        // because it is not a separate application: it reads the same menu and writes the
        // same orders, and its only privilege is the token in the link it was given.
        services.AddScoped<IPublicOrderingService, PublicOrderingService>();
        // Shares the request context with the ordering service, so a deduction and the
        // kitchen ticket that caused it commit together.
        services.AddScoped<IStockConsumption, StockConsumption>();

        return services;
    }

    private static IServiceCollection AddAuthenticationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection(JwtOptions.SectionName);

        services.AddOptions<JwtOptions>()
            .Bind(jwtSection)
            // Fail at startup rather than when the first token is issued.
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Key),
                "Jwt:Key is not configured. Set it through user secrets or environment variables.")
            .Validate(
                // HS256 needs at least 256 bits of key material.
                options => System.Text.Encoding.UTF8.GetByteCount(options.Key) >= 32,
                "Jwt:Key must be at least 32 bytes long.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Issuer),
                "Jwt:Issuer is not configured.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.Audience),
                "Jwt:Audience is not configured.")
            .ValidateOnStart();

        // AddIdentityCore rather than AddIdentity: no cookie authentication handler
        // is wanted, and no role support since roles are out of scope.
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;

                // No composition rules. Whoever issues an account chooses the
                // password, and the product does not argue with them about digits or
                // capitals. A length of one rather than zero, because a genuinely
                // empty password is not a credential anybody could type at the sign-in
                // form; everything above that is the issuer decision.
                //
                // Worth being clear-eyed about the trade: these accounts reach a
                // restaurant takings, and nothing now stops somebody setting a
                // password of "a". Hashing, lockout after ten failed attempts, and the
                // fact that accounts are issued rather than self-registered are what
                // remain.
                options.Password.RequiredLength = 1;
                options.Password.RequiredUniqueChars = 1;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.MaxFailedAccessAttempts = 10;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            // No token providers are registered, and none are needed. The only
            // password reset the product has is an administrator setting a new one for
            // somebody standing in front of them, so there is no emailed link to mint
            // a token for. The services do the reset with RemovePassword/AddPassword,
            // which rotates the security stamp without one.
            .AddEntityFrameworkStores<ApplicationDbContext>();

        services.AddScoped<JwtTokenGenerator>();
        services.AddScoped<IAuthService, AuthService>();

        // Bootstrap credentials for the platform Super Admin. Not validated on start:
        // an unconfigured section simply means the bootstrap does not run.
        services.Configure<SuperAdminOptions>(
            configuration.GetSection(SuperAdminOptions.SectionName));
        services.AddScoped<IdentityBootstrapper>();

        return services;
    }
}
