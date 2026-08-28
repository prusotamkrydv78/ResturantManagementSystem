using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Domain.Identity;

namespace RestaurantManagement.Infrastructure.Identity;

/// <summary>
/// Creates the platform Super Admin at startup if one does not already exist.
///
/// The process is idempotent and safe to run on every boot: it does nothing when a
/// Super Admin is already present, and it never creates a second one. Passwords go
/// through ASP.NET Core Identity, so nothing is hashed by hand.
/// </summary>
public sealed class IdentityBootstrapper
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SuperAdminOptions _options;
    private readonly ILogger<IdentityBootstrapper> _logger;

    /// <summary>Creates the bootstrapper.</summary>
    public IdentityBootstrapper(
        UserManager<ApplicationUser> userManager,
        IOptions<SuperAdminOptions> options,
        ILogger<IdentityBootstrapper> logger)
    {
        _userManager = userManager;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>
    /// Ensures a Super Admin exists. Returns without doing anything when the
    /// bootstrap is not configured or an account is already present.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when the configured credentials are rejected by Identity, so a
    /// misconfiguration is noticed instead of silently leaving no Super Admin.
    /// </exception>
    public async Task EnsureSuperAdminAsync(CancellationToken cancellationToken = default)
    {
        if (!_options.IsConfigured)
        {
            _logger.LogInformation(
                "Super Admin bootstrap skipped: {Section} is not configured.",
                SuperAdminOptions.SectionName);
            return;
        }

        // Guard on the role, not the email: this is what makes a second Super Admin
        // impossible even if the configured address changes between deployments.
        var superAdminExists = await _userManager.Users
            .AnyAsync(user => user.PlatformRole == PlatformRole.SuperAdmin, cancellationToken);

        if (superAdminExists)
        {
            _logger.LogInformation("Super Admin bootstrap skipped: an account already exists.");
            return;
        }

        var email = _options.Email.Trim();

        // The address may already belong to an ordinary account, for example one made
        // through public registration. Promoting it automatically would turn a
        // configuration change into a privilege escalation, so refuse instead.
        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            _logger.LogWarning(
                "Super Admin bootstrap skipped: {Email} already exists as a non-privileged "
                + "account. It was not promoted. Configure a different address, or change "
                + "the role of that account deliberately.",
                email);
            return;
        }

        var superAdmin = new ApplicationUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = _options.FullName.Trim(),
            PlatformRole = PlatformRole.SuperAdmin,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        var result = await _userManager.CreateAsync(superAdmin, _options.Password);

        if (!result.Succeeded)
        {
            var reason = string.Join(" ", result.Errors.Select(error => error.Description));

            throw new InvalidOperationException(
                $"Failed to create the bootstrap Super Admin: {reason}");
        }

        _logger.LogInformation(
            "Created bootstrap Super Admin {UserId} for {Email}.",
            superAdmin.Id,
            email);
    }
}
