using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Dashboard;

/// <summary>Failures the dashboard module can report.</summary>
public static class DashboardErrors
{
    /// <summary>
    /// The caller manages no restaurant, so there is nothing to show. The same message
    /// covers an account that never had one and one whose restaurant was reassigned:
    /// neither needs telling apart, and the only thing this module can fail at is
    /// finding a restaurant to read.
    /// </summary>
    public static readonly Error NoRestaurantAssigned =
        new(
            "dashboard.no_restaurant",
            "No restaurant is assigned to this account yet.");
}
