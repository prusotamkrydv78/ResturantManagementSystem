using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Customers;
using RestaurantManagement.Application.Customers.Dtos;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Customers;

/// <summary>
/// The people a restaurant knows.
///
/// Isolation works the way it does everywhere else: the restaurant comes from the
/// manager who owns it and every read and write is filtered by it, so a customer
/// identifier from another restaurant simply does not resolve.
/// </summary>
public sealed class CustomerService : ICustomerService
{
    /// <summary>
    /// How many rows to return in a list or a history.
    ///
    /// There is no pagination in this product, so the bound lives here. Enough to find
    /// somebody by scrolling; a search is the way to find them by name.
    /// </summary>
    private const int RowLimit = 100;

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<CustomerService> _logger;

    /// <summary>Creates the service.</summary>
    public CustomerService(
        ApplicationDbContext dbContext,
        ILogger<CustomerService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<IReadOnlyList<CustomerResponse>>> GetCustomersAsync(
        Guid managerUserId,
        string? search,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<IReadOnlyList<CustomerResponse>>(
                CustomerErrors.NoRestaurantAssigned);
        }

        var query = CustomersOf(restaurantId.Value).AsNoTracking();

        if (!includeInactive)
        {
            query = query.Where(customer => customer.IsActive);
        }

        var term = search?.Trim();

        if (!string.IsNullOrWhiteSpace(term))
        {
            // Name or number, because those are the two things anybody has to hand when
            // a guest is standing in front of them.
            query = query.Where(customer =>
                customer.Name.Contains(term) ||
                (customer.Phone != null && customer.Phone.Contains(term)));
        }

        var customers = await query
            .OrderBy(customer => customer.Name)
            .Take(RowLimit)
            .ToListAsync(cancellationToken);

        var stats = await StatsFor(
            restaurantId.Value,
            customers.Select(customer => customer.Id).ToList(),
            cancellationToken);

        return Result.Success<IReadOnlyList<CustomerResponse>>(
            customers.Select(customer => ToResponse(customer, stats)).ToList());
    }

    /// <inheritdoc />
    public async Task<Result<CustomerDetailResponse>> GetCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<CustomerDetailResponse>(
                CustomerErrors.NoRestaurantAssigned);
        }

        var customer = await CustomersOf(restaurantId.Value)
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate => candidate.Id == customerId,
                cancellationToken);

        if (customer is null)
        {
            return Result.Failure<CustomerDetailResponse>(CustomerErrors.NotFound);
        }

        var orders = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.CustomerId == customerId &&
                order.RestaurantId == restaurantId.Value)
            .Include(order => order.Items)
            .Include(order => order.Table)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Take(RowLimit)
            .ToListAsync(cancellationToken);

        var reservations = await _dbContext.Reservations
            .AsNoTracking()
            .Where(reservation =>
                reservation.CustomerId == customerId &&
                reservation.RestaurantId == restaurantId.Value)
            .Include(reservation => reservation.Table)
            .OrderByDescending(reservation => reservation.ReservedForUtc)
            .Take(RowLimit)
            .ToListAsync(cancellationToken);

        var stats = await StatsFor(restaurantId.Value, [customerId], cancellationToken);

        return Result.Success(new CustomerDetailResponse(
            ToResponse(customer, stats),
            orders
                .Select(order => new CustomerOrderResponse(
                    order.Id,
                    order.OrderNumber,
                    order.Status,
                    order.Table.Name,
                    order.Subtotal,
                    order.Items.Sum(item => item.Quantity),
                    order.CreatedAtUtc))
                .ToList(),
            reservations
                .Select(reservation => new CustomerReservationResponse(
                    reservation.Id,
                    reservation.ReservedForUtc,
                    reservation.GuestCount,
                    reservation.Table?.Name,
                    reservation.Status))
                .ToList()));
    }

    /// <inheritdoc />
    public async Task<Result<CustomerResponse>> CreateCustomerAsync(
        Guid managerUserId,
        CreateCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.NoRestaurantAssigned);
        }

        var phone = Normalise(request.Phone);

        if (phone is not null &&
            await PhoneExistsAsync(restaurantId.Value, phone, null, cancellationToken))
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.PhoneTaken);
        }

        var now = DateTimeOffset.UtcNow;

        var customer = new Customer
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            Name = request.Name.Trim(),
            Phone = phone,
            Email = Normalise(request.Email),
            Notes = Normalise(request.Notes),
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.Customers.Add(customer);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} recorded customer {CustomerId}.",
            managerUserId,
            customer.Id);

        // No history to look up: a customer recorded a moment ago has never eaten here.
        return Result.Success(ToResponse(customer, NoHistory));
    }

    /// <inheritdoc />
    public async Task<Result<CustomerResponse>> UpdateCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        UpdateCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.NoRestaurantAssigned);
        }

        var customer = await CustomersOf(restaurantId.Value)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == customerId,
                cancellationToken);

        if (customer is null)
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.NotFound);
        }

        var phone = Normalise(request.Phone);

        if (phone is not null &&
            await PhoneExistsAsync(restaurantId.Value, phone, customerId, cancellationToken))
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.PhoneTaken);
        }

        customer.Name = request.Name.Trim();
        customer.Phone = phone;
        customer.Email = Normalise(request.Email);
        customer.Notes = Normalise(request.Notes);
        customer.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var stats = await StatsFor(restaurantId.Value, [customerId], cancellationToken);

        return Result.Success(ToResponse(customer, stats));
    }

    /// <inheritdoc />
    public async Task<Result<CustomerResponse>> SetCustomerActiveAsync(
        Guid managerUserId,
        Guid customerId,
        SetCustomerActiveRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.NoRestaurantAssigned);
        }

        var customer = await CustomersOf(restaurantId.Value)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == customerId,
                cancellationToken);

        if (customer is null)
        {
            return Result.Failure<CustomerResponse>(CustomerErrors.NotFound);
        }

        customer.IsActive = request.IsActive;
        customer.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var stats = await StatsFor(restaurantId.Value, [customerId], cancellationToken);

        return Result.Success(ToResponse(customer, stats));
    }

    /// <inheritdoc />
    public async Task<Result<bool>> DeleteCustomerAsync(
        Guid managerUserId,
        Guid customerId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<bool>(CustomerErrors.NoRestaurantAssigned);
        }

        var customer = await CustomersOf(restaurantId.Value)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == customerId,
                cancellationToken);

        if (customer is null)
        {
            return Result.Failure<bool>(CustomerErrors.NotFound);
        }

        // Either kind of history is enough to keep the row. An order or a booking
        // pointing at somebody nobody can look up loses the answer to who it was for.
        var hasOrders = await _dbContext.Orders
            .AnyAsync(order => order.CustomerId == customerId, cancellationToken);

        var hasReservations = await _dbContext.Reservations
            .AnyAsync(
                reservation => reservation.CustomerId == customerId,
                cancellationToken);

        if (hasOrders || hasReservations)
        {
            return Result.Failure<bool>(CustomerErrors.HasHistory);
        }

        _dbContext.Customers.Remove(customer);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// How much history each customer has, in one pair of queries.
    ///
    /// What decides whether a customer can be deleted, and what the screen shows so a
    /// manager can see why they cannot.
    /// </summary>
    private async Task<Dictionary<Guid, (int Orders, int Reservations, DateTimeOffset? Last)>>
        StatsFor(
            Guid restaurantId,
            IReadOnlyList<Guid> customerIds,
            CancellationToken cancellationToken)
    {
        if (customerIds.Count == 0)
        {
            return [];
        }

        var orderRows = await _dbContext.Orders
            .AsNoTracking()
            .Where(order =>
                order.RestaurantId == restaurantId &&
                order.CustomerId != null &&
                customerIds.Contains(order.CustomerId.Value))
            .GroupBy(order => order.CustomerId!.Value)
            .Select(group => new
            {
                CustomerId = group.Key,
                Count = group.Count(),
                Last = group.Max(order => order.CreatedAtUtc),
            })
            .ToListAsync(cancellationToken);

        var reservationRows = await _dbContext.Reservations
            .AsNoTracking()
            .Where(reservation =>
                reservation.RestaurantId == restaurantId &&
                customerIds.Contains(reservation.CustomerId))
            .GroupBy(reservation => reservation.CustomerId)
            .Select(group => new
            {
                CustomerId = group.Key,
                Count = group.Count(),
                Last = group.Max(reservation => reservation.ReservedForUtc),
            })
            .ToListAsync(cancellationToken);

        var stats = new Dictionary<Guid, (int Orders, int Reservations, DateTimeOffset? Last)>();

        foreach (var id in customerIds)
        {
            var order = orderRows.SingleOrDefault(row => row.CustomerId == id);
            var reservation = reservationRows.SingleOrDefault(row => row.CustomerId == id);

            // The later of the two, because a visit is a visit whether it was booked or
            // walked in.
            DateTimeOffset? last = (order?.Last, reservation?.Last) switch
            {
                (null, null) => null,
                (var o, null) => o,
                (null, var r) => r,
                var (o, r) => o > r ? o : r,
            };

            stats[id] = (order?.Count ?? 0, reservation?.Count ?? 0, last);
        }

        return stats;
    }

    private IQueryable<Customer> CustomersOf(Guid restaurantId) =>
        _dbContext.Customers.Where(customer => customer.RestaurantId == restaurantId);

    private Task<bool> PhoneExistsAsync(
        Guid restaurantId,
        string phone,
        Guid? exceptId,
        CancellationToken cancellationToken) =>
        CustomersOf(restaurantId)
            .Where(customer => exceptId == null || customer.Id != exceptId)
            .AnyAsync(customer => customer.Phone == phone, cancellationToken);

    private async Task<Guid?> ResolveRestaurantIdAsync(
        Guid managerUserId,
        CancellationToken cancellationToken)
    {
        var ids = await _dbContext.Restaurants
            .AsNoTracking()
            .Where(restaurant => restaurant.ManagerId == managerUserId)
            .Select(restaurant => restaurant.Id)
            .ToListAsync(cancellationToken);

        return ids.Count == 0 ? null : ids[0];
    }

    /// <summary>
    /// A trimmed value, or null when there was nothing there.
    ///
    /// Blank and absent are the same thing for every optional field here, and storing an
    /// empty string would make the unique phone index treat two unknown numbers as a
    /// clash.
    /// </summary>
    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Stands in for a history lookup that would find nothing.
    ///
    /// Held as a field rather than written inline, because the empty case turns up whenever
    /// a customer has only just been created and the alternative is a query guaranteed to
    /// come back empty.
    /// </summary>
    private static readonly IReadOnlyDictionary<Guid, (int Orders, int Reservations, DateTimeOffset? Last)>
        NoHistory = new Dictionary<Guid, (int Orders, int Reservations, DateTimeOffset? Last)>();

    private static CustomerResponse ToResponse(
        Customer customer,
        IReadOnlyDictionary<Guid, (int Orders, int Reservations, DateTimeOffset? Last)> stats)
    {
        var found = stats.TryGetValue(customer.Id, out var value)
            ? value
            : (Orders: 0, Reservations: 0, Last: (DateTimeOffset?)null);

        return new CustomerResponse(
            customer.Id,
            customer.Name,
            customer.Phone,
            customer.Email,
            customer.Notes,
            customer.IsActive,
            found.Orders,
            found.Reservations,
            found.Last,
            customer.CreatedAtUtc,
            customer.UpdatedAtUtc);
    }
}
