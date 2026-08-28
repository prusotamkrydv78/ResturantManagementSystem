using Microsoft.AspNetCore.Identity;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Identity;

/// <summary>
/// An application user. Identity supplies the credential fields (email, password
/// hash, security stamp); only the minimum profile data is added here.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>The display name of the user.</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Platform-level role. Defaults to <see cref="PlatformRole.User"/> so no code
    /// path can create a privileged account by omission.
    /// </summary>
    public PlatformRole PlatformRole { get; set; } = PlatformRole.User;

    /// <summary>
    /// The restaurant this person works in, for staff accounts only.
    ///
    /// This is membership, not ownership: which manager runs a restaurant is still
    /// recorded solely by <see cref="Restaurant.ManagerId"/>, so the two facts
    /// cannot disagree. A manager leaves this null.
    /// </summary>
    public Guid? RestaurantId { get; set; }

    /// <summary>Navigation to the restaurant this person works in.</summary>
    public Restaurant? Restaurant { get; set; }

    /// <summary>
    /// What this person does on the floor. Set together with
    /// <see cref="RestaurantId"/> for staff, and null for everyone else; a database
    /// check constraint keeps the pair consistent.
    /// </summary>
    public StaffRole? StaffRole { get; set; }

    /// <summary>
    /// Whether the account may sign in. Deactivating leaves the record and its
    /// history intact rather than deleting anything.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When the account was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>Refresh tokens issued to this user.</summary>
    public ICollection<RefreshToken> RefreshTokens { get; } = [];
}
