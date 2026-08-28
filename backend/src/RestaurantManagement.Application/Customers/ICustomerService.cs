using RestaurantManagement.Application.Customers.Dtos;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Application.Customers;

/// <summary>
/// The people a restaurant knows.
///
/// Every method takes the authenticated manager and derives the restaurant from them,
/// the same way every other manager module does. No method accepts a restaurant
/// identifier.
///
/// Deliberately not accounts. Nobody signs in as a customer anywhere in this product,
/// so there is no password, no verification and no self-service: this is a name a
/// manager writes down.
/// </summary>
public interface ICustomerService
{
    /// <summary>
    /// The customers on the books, newest first.
    ///
    /// A search matches the name or the phone number, which are the two things anybody
    /// has to hand when a guest is standing in front of them. Deactivated customers are
    /// left out unless asked for.
    /// </summary>
    Task<Result<IReadOnlyList<CustomerResponse>>> GetCustomersAsync(
        Guid managerUserId,
        string? search,
        bool includeInactive,
        CancellationToken cancellationToken);

    /// <summary>One customer with what they have done.</summary>
    Task<Result<CustomerDetailResponse>> GetCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        CancellationToken cancellationToken);

    /// <summary>Records a customer.</summary>
    Task<Result<CustomerResponse>> CreateCustomerAsync(
        Guid managerUserId,
        CreateCustomerRequest request,
        CancellationToken cancellationToken);

    /// <summary>Changes a customer details.</summary>
    Task<Result<CustomerResponse>> UpdateCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        UpdateCustomerRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Takes a customer off the books, or puts them back.
    ///
    /// This is how somebody stops appearing, because their history has to survive them
    /// leaving.
    /// </summary>
    Task<Result<CustomerResponse>> SetCustomerActiveAsync(
        Guid managerUserId,
        Guid customerId,
        SetCustomerActiveRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Deletes a customer outright.
    ///
    /// Only possible while they have no orders and no bookings, which in practice means
    /// the row was a mistake. Anything else is deactivated, because an order pointing at
    /// a row nobody can look up loses the answer to who it was for.
    /// </summary>
    Task<Result<bool>> DeleteCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        CancellationToken cancellationToken);
}
