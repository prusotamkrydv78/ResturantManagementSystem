using RestaurantManagement.Application.Restaurants.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Restaurants;

/// <summary>
/// Restaurant use cases. Implemented in the infrastructure layer, which owns EF Core
/// and ASP.NET Core Identity.
///
/// Authorization by role is applied at the API boundary. The one rule enforced here
/// is ownership: <see cref="GetForManagerAsync"/> resolves the restaurant from the
/// caller identity rather than from any client-supplied identifier.
/// </summary>
public interface IRestaurantService
{
    /// <summary>Creates a restaurant with no manager assigned. Super Admin only.</summary>
    Task<Result<RestaurantResponse>> CreateAsync(
        CreateRestaurantRequest request,
        CancellationToken cancellationToken);

    /// <summary>Lists every restaurant. Super Admin only.</summary>
    Task<Result<IReadOnlyList<RestaurantSummaryResponse>>> GetAllAsync(
        CancellationToken cancellationToken);

    /// <summary>Loads one restaurant by identifier. Super Admin only.</summary>
    Task<Result<RestaurantResponse>> GetByIdAsync(
        Guid restaurantId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates any restaurant by identifier. Super Admin only.
    ///
    /// The counterpart to <see cref="UpdateForManagerAsync"/>, and the only path that
    /// can change a slug. Manager assignment is not touched here: ownership moves
    /// through the manager endpoints so there is one way to do it.
    /// </summary>
    Task<Result<RestaurantResponse>> UpdateAsync(
        Guid restaurantId,
        UpdateRestaurantRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Suspends or restores a restaurant. Super Admin only.
    /// </summary>
    /// <remarks>
    /// The platform's way of taking a restaurant out of service. Deliberately not a
    /// delete: the orders and takings are what every report is built from, and a
    /// restaurant that stops paying still has a history somebody may need to answer
    /// for.
    ///
    /// Allowed at any moment, including mid-service, because the state it produces is
    /// safe: no new order can be opened, while everything already running still
    /// reaches the till.
    /// </remarks>
    Task<Result<RestaurantResponse>> SetActiveAsync(
        Guid restaurantId,
        SetRestaurantActiveRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Loads the restaurant managed by the given user. The identifier comes from the
    /// validated access token, so a manager cannot reach another restaurant by
    /// changing a value in the request.
    /// </summary>
    Task<Result<RestaurantResponse>> GetForManagerAsync(
        Guid managerUserId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates the basic details of the restaurant managed by the given user.
    ///
    /// Like <see cref="GetForManagerAsync"/>, the record is found from the caller
    /// identity rather than from anything in the request, so a manager can only ever
    /// edit their own restaurant. Ownership and the slug are not editable here.
    /// </summary>
    Task<Result<RestaurantResponse>> UpdateForManagerAsync(
        Guid managerUserId,
        UpdateMyRestaurantRequest request,
        CancellationToken cancellationToken);

}
