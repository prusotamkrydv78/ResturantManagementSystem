namespace RestaurantManagement.Application.Platform;

/// <summary>
/// Records what a platform administrator did, so somebody can read it back later.
///
/// Fire-and-forget from the caller's point of view: a failure to write the log must
/// never fail the action it describes. Suspending a restaurant that cannot be written
/// to the log is still a suspended restaurant, and throwing here would leave the
/// product in a state where the audit trail can take the system down.
/// </summary>
public interface IAdminActivityLog
{
    /// <summary>
    /// Notes one action against the account currently making the request.
    ///
    /// Does nothing when there is no signed-in account, which is the honest outcome:
    /// an entry attributed to nobody is worse than no entry.
    /// </summary>
    /// <param name="action">A stable verb, from <see cref="AdminActions"/>.</param>
    /// <param name="subject">What was acted on, by name, snapshotted.</param>
    /// <param name="subjectId">What was acted on, by identifier, where there is one.</param>
    /// <param name="detail">Anything the verb does not carry.</param>
    /// <param name="cancellationToken">Abandons the write if the request is dropped.</param>
    Task RecordAsync(
        string action,
        string subject,
        Guid? subjectId = null,
        string? detail = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The verbs the log knows.
///
/// Constants rather than free strings at the call sites, so a filter can be written
/// against them and a typo cannot quietly invent a new kind of event.
/// </summary>
public static class AdminActions
{
    /// <summary>A restaurant was created.</summary>
    public const string RestaurantCreated = "restaurant.created";

    /// <summary>A restaurant's details were edited.</summary>
    public const string RestaurantUpdated = "restaurant.updated";

    /// <summary>A restaurant was suspended and can no longer take orders.</summary>
    public const string RestaurantSuspended = "restaurant.suspended";

    /// <summary>A suspended restaurant was put back into service.</summary>
    public const string RestaurantRestored = "restaurant.restored";

    /// <summary>A manager account was created.</summary>
    public const string ManagerCreated = "manager.created";

    /// <summary>A manager's name or email was edited.</summary>
    public const string ManagerUpdated = "manager.updated";

    /// <summary>A manager was put in charge of a restaurant.</summary>
    public const string ManagerAssigned = "manager.assigned";

    /// <summary>A manager was removed from the restaurant they ran.</summary>
    public const string ManagerUnassigned = "manager.unassigned";

    /// <summary>Somebody issued a manager a new password.</summary>
    public const string ManagerPasswordReset = "manager.password_reset";

    /// <summary>A manager account was suspended and can no longer sign in.</summary>
    public const string ManagerSuspended = "manager.suspended";

    /// <summary>A suspended manager account was restored.</summary>
    public const string ManagerRestored = "manager.restored";

    /// <summary>The platform-wide defaults were changed.</summary>
    public const string SettingsUpdated = "platform.settings_updated";
}
