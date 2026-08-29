using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Tables;

/// <summary>Failures the table module can report.</summary>
public static class TableErrors
{
    /// <summary>
    /// No table with that identifier exists in the caller restaurant.
    ///
    /// A table belonging to a different restaurant produces this same error, so
    /// probing identifiers reveals nothing about other restaurants.
    /// </summary>
    public static readonly Error NotFound =
        new("table.not_found", "The table could not be found.");

    /// <summary>The caller does not manage a restaurant, so has no tables.</summary>
    public static readonly Error NoRestaurantAssigned =
        new("table.no_restaurant", "No restaurant is assigned to this account.");

    /// <summary>Another table in the same restaurant already uses this name.</summary>
    public static readonly Error NameTaken =
        new("table.name_taken", "This restaurant already has a table with that name.");

    /// <summary>
    /// The table has been used, so the record is history rather than a mistake.
    ///
    /// Orders and bookings both point at the table by foreign key, so the database
    /// would refuse this anyway - it is checked here so the answer is a sentence about
    /// the table instead of a constraint violation. Withdrawing it from service takes
    /// it off the floor without breaking what already happened on it.
    /// </summary>
    public static readonly Error HasHistory =
        new(
            "table.has_history",
            "This table has orders or bookings against it and cannot be deleted. "
            + "Take it out of service instead.");
}
