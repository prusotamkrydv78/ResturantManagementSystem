namespace RestaurantManagement.Domain.Identity;

/// <summary>
/// A refresh token issued to a user. Only a hash of the token value is persisted,
/// so a database leak does not hand out usable sessions.
/// </summary>
public class RefreshToken
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>Owning user.</summary>
    public Guid UserId { get; set; }

    /// <summary>Navigation to the owning user.</summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>SHA-256 hash of the token value handed to the client.</summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>When the token was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the token stops being valid.</summary>
    public DateTimeOffset ExpiresAtUtc { get; set; }

    /// <summary>When the token was revoked, if it was.</summary>
    public DateTimeOffset? RevokedAtUtc { get; set; }

    /// <summary>
    /// The token that replaced this one during rotation. Kept so a replayed token
    /// can be recognised as reuse rather than simply "revoked".
    /// </summary>
    public Guid? ReplacedByTokenId { get; set; }

    /// <summary>True while the token has neither expired nor been revoked.</summary>
    public bool IsActive(DateTimeOffset nowUtc) =>
        RevokedAtUtc is null && ExpiresAtUtc > nowUtc;
}
