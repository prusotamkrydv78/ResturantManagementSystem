namespace RestaurantManagement.Application.Authentication;

/// <summary>
/// Credentials for the bootstrap Super Admin, bound from the
/// "Bootstrap:SuperAdmin" configuration section.
///
/// These values must come from configuration, environment variables, or user
/// secrets. Nothing here is defaulted to a usable credential: with no
/// configuration present the bootstrap simply does not run.
/// </summary>
public sealed class SuperAdminOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Bootstrap:SuperAdmin";

    /// <summary>
    /// Whether the bootstrap should run at startup. Even when true, the process is
    /// skipped unless both an email and a password are configured.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Email address, also the login name, of the Super Admin.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Display name of the Super Admin.</summary>
    public string FullName { get; set; } = "Platform Super Admin";

    /// <summary>
    /// Initial password. Hashed by ASP.NET Core Identity; never stored or logged
    /// in plain text.
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>True when enough is configured to attempt the bootstrap.</summary>
    public bool IsConfigured =>
        Enabled
        && !string.IsNullOrWhiteSpace(Email)
        && !string.IsNullOrWhiteSpace(Password);
}
