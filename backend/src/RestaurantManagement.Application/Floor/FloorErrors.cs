using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Floor;

/// <summary>Failures the floor module can report.</summary>
public static class FloorErrors
{
    /// <summary>
    /// The caller is not a waiter attached to an active restaurant account.
    ///
    /// Covers a deactivated account, a staff member with no restaurant, and a chef or
    /// cashier reaching the waiter route, all as one message: none of those needs to
    /// be told apart, and separating them would confirm which condition applied.
    /// </summary>
    public static readonly Error NotAnActiveWaiter =
        new("floor.not_an_active_waiter", "This account cannot view the floor.");

    /// <summary>
    /// The caller manages no restaurant, so there is no floor to show. The same
    /// message covers an account that never had one and one whose restaurant was
    /// reassigned.
    /// </summary>
    public static readonly Error NoRestaurantAssigned =
        new("floor.no_restaurant", "No restaurant is assigned to this account yet.");
}
