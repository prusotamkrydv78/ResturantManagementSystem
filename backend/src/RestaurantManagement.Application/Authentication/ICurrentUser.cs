namespace RestaurantManagement.Application.Authentication;

/// <summary>
/// Who is making the request that is currently being served.
///
/// Introduced so an action can record who performed it without every service method
/// growing an actor parameter that only one line of the method reads. Authorisation does
/// not come from here - that is settled at the API boundary from the validated token,
/// and this reads the same claims after the fact.
///
/// Null on anything that is not a request: a background task, a migration, a test that
/// constructs a service directly. Callers are expected to cope rather than assume.
/// </summary>
public interface ICurrentUser
{
    /// <summary>The signed-in account, or null when there is not one.</summary>
    Guid? UserId { get; }

    /// <summary>What they are called, for snapshotting into a record of what they did.</summary>
    string? FullName { get; }
}
