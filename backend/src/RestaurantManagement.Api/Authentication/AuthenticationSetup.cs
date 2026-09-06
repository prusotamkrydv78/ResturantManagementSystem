using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using RestaurantManagement.Application.Authentication;

namespace RestaurantManagement.Api.Authentication;

/// <summary>
/// Wires up JWT bearer validation. Token creation lives in the infrastructure layer;
/// validating incoming requests is a hosting concern and stays here.
/// </summary>
public static class AuthenticationSetup
{
    /// <summary>Adds JWT bearer authentication and the refresh cookie helper.</summary>
    /// <exception cref="InvalidOperationException">Thrown when JWT settings are missing.</exception>
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RefreshTokenCookieOptions>(
            configuration.GetSection(RefreshTokenCookieOptions.SectionName));
        services.AddScoped<RefreshTokenCookie>();

        // Read directly here because the authentication handler is built before the
        // options system is available for resolution.
        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException(
                "The Jwt configuration section is missing.");

        if (string.IsNullOrWhiteSpace(jwt.Key))
        {
            throw new InvalidOperationException(
                "Jwt:Key is not configured. Set it through user secrets or environment variables.");
        }

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Keep the original claim names from the token instead of translating
                // them to the legacy WS-* URIs, so "sub" stays "sub".
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,

                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),

                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),

                    NameClaimType = JwtClaimNames.Sub,
                    // Lets [Authorize(Roles = "SuperAdmin")] read the "role" claim
                    // the token generator emits.
                    RoleClaimType = JwtClaimNames.Role
                };

                // A websocket cannot carry an Authorization header. The browser API
                // gives no way to set one on the handshake, so SignalR puts the token
                // in the query string instead and this is where it is picked up.
                //
                // Narrowed to the hub path on purpose. A token in a query string ends
                // up in server logs and browser history, which is an acceptable trade
                // for the one endpoint that has no alternative and a bad idea
                // everywhere else - so no ordinary API route will accept one this way.
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var token = context.Request.Query["access_token"];

                        if (!string.IsNullOrEmpty(token) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        {
                            context.Token = token;
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization(options =>
        {
            // Floor operations are gated on both claims together. The service layer
            // additionally refuses a deactivated account, so a token issued just
            // before deactivation cannot be used.
            options.AddPolicy(
                AuthorizationPolicies.Waiter,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(PlatformRoles.Staff)
                    .RequireClaim(JwtClaimNames.StaffRole, StaffRoleNames.Waiter));

            // Kitchen operations, gated the same way. Both policies are two claims
            // rather than a permission table, because the product has two floor jobs
            // and inventing a permission system for them would be scaffolding.
            options.AddPolicy(
                AuthorizationPolicies.Chef,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(PlatformRoles.Staff)
                    .RequireClaim(JwtClaimNames.StaffRole, StaffRoleNames.Chef));

            // Two different accounts satisfy this one, so it is an assertion rather than
            // a list of claims: a manager is recognised by their platform role alone,
            // and a waiter by the pairing of Staff with the job they do.
            options.AddPolicy(
                AuthorizationPolicies.Settles,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireAssertion(context =>
                        context.User.IsInRole(PlatformRoles.RestaurantManager) ||
                        (context.User.IsInRole(PlatformRoles.Staff) &&
                            context.User.HasClaim(
                                JwtClaimNames.StaffRole,
                                StaffRoleNames.Waiter))));
        });

        return services;
    }
}

/// <summary>Claim names used by this API.</summary>
public static class JwtClaimNames
{
    /// <summary>Subject claim, holding the user identifier.</summary>
    public const string Sub = "sub";

    /// <summary>Role claim, holding the platform-level role name.</summary>
    public const string Role = "role";

    /// <summary>Staff role claim, holding what the person does on the floor.</summary>
    public const string StaffRole = "staff_role";
}

/// <summary>
/// Staff role names as they appear in the token, derived from the enum so a rename
/// cannot silently break a policy.
/// </summary>
public static class StaffRoleNames
{
    /// <summary>Takes orders and serves guests.</summary>
    public const string Waiter = nameof(RestaurantManagement.Domain.Identity.StaffRole.Waiter);

    /// <summary>Cooks what the kitchen is sent.</summary>
    public const string Chef = nameof(RestaurantManagement.Domain.Identity.StaffRole.Chef);
}
