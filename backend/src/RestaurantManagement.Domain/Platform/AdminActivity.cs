namespace RestaurantManagement.Domain.Platform;

/// <summary>
/// One thing a platform administrator did, recorded so it can be read back.
///
/// The product has always written these to the application log, which answers the
/// question only for whoever can reach the server. "Who suspended this restaurant last
/// Tuesday" is a question the people running the platform ask each other, and until now
/// nothing in the product could answer it.
///
/// Deliberately append-only, and deliberately not a foreign key to the account that did
/// it. The name is snapshotted at the moment of the action for the same reason an order
/// snapshots a dish name: the account may be renamed, reassigned or removed later, and a
/// log that rewrites its own history when somebody changes their surname is not a log.
/// </summary>
public class AdminActivity
{
    /// <summary>Identifier. Time-ordered, so insertion order is reading order.</summary>
    public Guid Id { get; set; }

    /// <summary>Who did it.</summary>
    public Guid ActorId { get; set; }

    /// <summary>What they were called at the time.</summary>
    public string ActorName { get; set; } = string.Empty;

    /// <summary>
    /// What was done, as a stable machine-readable verb such as "restaurant.suspended".
    ///
    /// A code rather than a sentence, so a reader can filter on it and so the words on
    /// screen can be changed without rewriting what is already stored.
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>What it was done to, by name, snapshotted for the same reason.</summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// What it was done to, by identifier, so a row can still link somewhere.
    ///
    /// Nullable because not everything acted on survives, and a log entry about a
    /// deleted thing is more useful than no log entry.
    /// </summary>
    public Guid? SubjectId { get; set; }

    /// <summary>Anything worth keeping that the verb does not carry.</summary>
    public string? Detail { get; set; }

    /// <summary>When it happened.</summary>
    public DateTimeOffset AtUtc { get; set; }
}
