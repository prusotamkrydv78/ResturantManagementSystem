namespace RestaurantManagement.Domain.Identity;

/// <summary>
/// Platform-level role of a user. This is deliberately a single coarse flag rather
/// than a role-management system: fine-grained restaurant roles and
/// permissions belong to later phases and are not modelled here.
/// </summary>
public enum PlatformRole
{
    /// <summary>
    /// A normal, unprivileged account. Everything created by public registration
    /// gets this value.
    /// </summary>
    User = 0,

    /// <summary>
    /// The platform operator. Created only by the bootstrap process, never by
    /// registration. Owns restaurant creation and manager assignment.
    /// </summary>
    SuperAdmin = 1,

    /// <summary>
    /// Owner or manager of exactly one restaurant. Assigned only by a Super Admin;
    /// a user can never give themselves this role.
    /// </summary>
    RestaurantManager = 2,

    /// <summary>
    /// Works in exactly one restaurant. Created only by that restaurant manager,
    /// never by registration or by the account itself. What the person does on the
    /// floor is carried separately by <see cref="StaffRole"/>.
    /// </summary>
    Staff = 3
}
