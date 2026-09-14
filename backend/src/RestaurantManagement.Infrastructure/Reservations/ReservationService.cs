using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Reservations;
using RestaurantManagement.Application.Reservations.Dtos;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Reservations;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;
using RestaurantManagement.Shared.Results;

namespace RestaurantManagement.Infrastructure.Reservations;

/// <summary>
/// Tables held for people at times.
///
/// Isolation works the way it does everywhere else. What is specific to this module is
/// what it deliberately does not do: nothing here writes table occupancy. A booking
/// records an intention; an order records a table being used. Letting this set occupancy
/// too would give the floor two answers to the same question, and the one nobody was
/// looking at would be wrong.
/// </summary>
public sealed class ReservationService : IReservationService
{
    /// <summary>
    /// How many bookings to return at once. There is no pagination in this product, so
    /// the bound lives here.
    /// </summary>
    private const int RowLimit = 200;

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<ReservationService> _logger;

    /// <summary>Creates the service.</summary>
    public ReservationService(
        ApplicationDbContext dbContext,
        ILogger<ReservationService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Result<ReservationBoardResponse>> GetBoardAsync(
        Guid managerUserId,
        DateOnly? onDate,
        bool includeClosed,
        CancellationToken cancellationToken)
    {
        var restaurant = await ResolveRestaurantAsync(managerUserId, cancellationToken);

        if (restaurant is null)
        {
            return Result.Failure<ReservationBoardResponse>(
                ReservationErrors.NoRestaurantAssigned);
        }

        var now = DateTimeOffset.UtcNow;

        // Read in the restaurant own calendar, so "today" means the day the restaurant
        // is having rather than the day the server is having.
        var today = ServiceDay.LocalToday(now);
        var todayStart = ServiceDay.StartOn(today);
        var todayEnd = ServiceDay.StartOn(today.AddDays(1));

        var all = await ReservationsOf(restaurant.Id)
            .AsNoTracking()
            .Include(reservation => reservation.Customer)
            .Include(reservation => reservation.Table)
            .ToListAsync(cancellationToken);

        var live = all.Where(reservation => !reservation.IsClosed).ToList();

        var todays = live
            .Where(reservation =>
                reservation.ReservedForUtc >= todayStart &&
                reservation.ReservedForUtc < todayEnd)
            .ToList();

        IEnumerable<Reservation> shown;

        if (onDate is not null)
        {
            var dayStart = ServiceDay.StartOn(onDate.Value);
            var dayEnd = ServiceDay.StartOn(onDate.Value.AddDays(1));

            shown = all.Where(reservation =>
                reservation.ReservedForUtc >= dayStart &&
                reservation.ReservedForUtc < dayEnd);
        }
        else
        {
            // The question somebody actually has: what is on today, and what is still
            // coming. A booking from last week is history and belongs to a date search.
            shown = all.Where(reservation =>
                reservation.ReservedForUtc >= todayStart);
        }

        if (!includeClosed)
        {
            shown = shown.Where(reservation => !reservation.IsClosed);
        }

        var rows = shown
            .OrderBy(reservation => reservation.ReservedForUtc)
            .Take(RowLimit)
            .Select(ToResponse)
            .ToList();

        return Result.Success(new ReservationBoardResponse(
            rows,
            todays.Count,
            live.Count(reservation => reservation.ReservedForUtc >= now),
            live.Count(reservation => reservation.Status == ReservationStatus.Seated),
            // Only bookings that still hold a table: nobody is coming for a cancelled
            // one, so counting its covers would overstate the evening.
            todays.Where(reservation => reservation.HoldsTable).Sum(r => r.GuestCount)));
    }

    /// <inheritdoc />
    public async Task<Result<ReservationResponse>> GetReservationAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<ReservationResponse>(
                ReservationErrors.NoRestaurantAssigned);
        }

        var reservation = await ReservationsOf(restaurantId.Value)
            .AsNoTracking()
            .Include(candidate => candidate.Customer)
            .Include(candidate => candidate.Table)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == reservationId,
                cancellationToken);

        return reservation is null
            ? Result.Failure<ReservationResponse>(ReservationErrors.NotFound)
            : Result.Success(ToResponse(reservation));
    }

    /// <inheritdoc />
    /// <summary>
    /// Who the booking is for, whether they were already on the books or not.
    ///
    /// Three paths, in the order a caller is most likely to mean them:
    ///
    /// An identifier names somebody already recorded, and must belong to this
    /// restaurant - one from another restaurant is simply not found rather than
    /// refused, so the endpoint cannot be used to discover whether a customer exists
    /// elsewhere.
    ///
    /// A name with a telephone number is matched against the book first. The number is
    /// unique within a restaurant, so this is what stops a regular who rings every week
    /// becoming fifty-two customers. A match reuses the record and leaves their name as
    /// it was: the person who first wrote it down had more context than a booking form.
    ///
    /// A name with no number always creates. There is nothing to match on, and guessing
    /// by name would eventually join two different people called Ram.
    ///
    /// Nothing is saved here. The new customer is added to the change tracker and
    /// committed by the same SaveChanges as the booking, so a refused booking cannot
    /// leave a stranger on the books.
    /// </summary>
    private async Task<Result<Guid>> ResolveCustomerAsync(
        Guid restaurantId,
        CreateReservationRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CustomerId is { } customerId)
        {
            var exists = await _dbContext.Customers.AnyAsync(
                customer =>
                    customer.Id == customerId && customer.RestaurantId == restaurantId,
                cancellationToken);

            return exists
                ? Result.Success(customerId)
                : Result.Failure<Guid>(ReservationErrors.CustomerNotFound);
        }

        var name = Normalise(request.CustomerName);

        if (name is null)
        {
            return Result.Failure<Guid>(ReservationErrors.CustomerRequired);
        }

        var phone = Normalise(request.CustomerPhone);

        if (phone is not null)
        {
            var known = await _dbContext.Customers
                .Where(customer =>
                    customer.RestaurantId == restaurantId && customer.Phone == phone)
                .Select(customer => (Guid?)customer.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (known is { } existing)
            {
                return Result.Success(existing);
            }
        }

        var now = DateTimeOffset.UtcNow;

        var created = new Customer
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId,
            Name = name,
            Phone = phone,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _dbContext.Customers.Add(created);

        return Result.Success(created.Id);
    }

    public async Task<Result<ReservationResponse>> CreateAsync(
        Guid managerUserId,
        CreateReservationRequest request,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<ReservationResponse>(
                ReservationErrors.NoRestaurantAssigned);
        }

        var customer = await ResolveCustomerAsync(
            restaurantId.Value,
            request,
            cancellationToken);

        if (customer.IsFailure)
        {
            return Result.Failure<ReservationResponse>(customer.Error!);
        }

        var duration = request.DurationMinutes ?? Reservation.DefaultDurationMinutes;

        var reservation = new Reservation
        {
            Id = Guid.CreateVersion7(),
            RestaurantId = restaurantId.Value,
            CustomerId = customer.Value,
            ReservedForUtc = request.ReservedForUtc,
            DurationMinutes = duration,
            GuestCount = request.GuestCount,
            Status = ReservationStatus.Pending,
            Notes = Normalise(request.Notes),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        var placed = await AssignTableAsync(
            reservation,
            request.TableId,
            restaurantId.Value,
            cancellationToken);

        if (placed.IsFailure)
        {
            return Result.Failure<ReservationResponse>(placed.Error!);
        }

        _dbContext.Reservations.Add(reservation);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Manager {ManagerId} took reservation {ReservationId} for {Guests} at {When}.",
            managerUserId,
            reservation.Id,
            reservation.GuestCount,
            reservation.ReservedForUtc);

        return await ReloadAsync(restaurantId.Value, reservation.Id, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Result<ReservationResponse>> UpdateAsync(
        Guid managerUserId,
        Guid reservationId,
        UpdateReservationRequest request,
        CancellationToken cancellationToken)
    {
        var found = await LoadForWriteAsync(managerUserId, reservationId, cancellationToken);

        if (found.IsFailure)
        {
            return Result.Failure<ReservationResponse>(found.Error!);
        }

        var (restaurantId, reservation) = found.Value;

        if (!reservation.IsEditable)
        {
            return Result.Failure<ReservationResponse>(ReservationErrors.NotEditable);
        }

        reservation.ReservedForUtc = request.ReservedForUtc;
        reservation.DurationMinutes =
            request.DurationMinutes ?? reservation.DurationMinutes;
        reservation.GuestCount = request.GuestCount;
        reservation.Notes = Normalise(request.Notes);
        reservation.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Run again, because moving a time is how most clashes actually appear.
        var placed = await AssignTableAsync(
            reservation,
            request.TableId,
            restaurantId,
            cancellationToken);

        if (placed.IsFailure)
        {
            return Result.Failure<ReservationResponse>(placed.Error!);
        }

        return await SaveAndReloadAsync(restaurantId, reservation, cancellationToken);
    }

    /// <inheritdoc />
    public Task<Result<ReservationResponse>> ConfirmAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            managerUserId,
            reservationId,
            (reservation, now) => reservation.TryConfirm(now),
            cancellationToken);

    /// <inheritdoc />
    public async Task<Result<ReservationResponse>> SeatAsync(
        Guid managerUserId,
        Guid reservationId,
        SeatReservationRequest request,
        CancellationToken cancellationToken)
    {
        var found = await LoadForWriteAsync(managerUserId, reservationId, cancellationToken);

        if (found.IsFailure)
        {
            return Result.Failure<ReservationResponse>(found.Error!);
        }

        var (restaurantId, reservation) = found.Value;

        // A party moved on arrival is recorded where they actually sat, and a guest who
        // turned up before a table was chosen can still be shown in.
        if (request.TableId is not null && request.TableId != reservation.TableId)
        {
            var placed = await AssignTableAsync(
                reservation,
                request.TableId,
                restaurantId,
                cancellationToken);

            if (placed.IsFailure)
            {
                return Result.Failure<ReservationResponse>(placed.Error!);
            }
        }

        if (reservation.TableId is null)
        {
            return Result.Failure<ReservationResponse>(
                ReservationErrors.SeatingNeedsTable);
        }

        var now = DateTimeOffset.UtcNow;

        // Deliberately the only write. The table status is left exactly as it is: an
        // order is what occupies a table, and this must not become a second opinion.
        if (!reservation.TrySeat(now))
        {
            return Result.Failure<ReservationResponse>(ReservationErrors.WrongStatus);
        }

        return await SaveAndReloadAsync(restaurantId, reservation, cancellationToken);
    }

    /// <inheritdoc />
    public Task<Result<ReservationResponse>> CompleteAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            managerUserId,
            reservationId,
            (reservation, now) => reservation.TryComplete(now),
            cancellationToken);

    /// <inheritdoc />
    public Task<Result<ReservationResponse>> CancelAsync(
        Guid managerUserId,
        Guid reservationId,
        CancelReservationRequest request,
        CancellationToken cancellationToken) =>
        TransitionAsync(
            managerUserId,
            reservationId,
            (reservation, now) => reservation.TryCancel(Normalise(request.Reason), now),
            cancellationToken);

    /* ------------------------------------------------------------------- Helpers */

    /// <summary>
    /// The shape every status step shares: load, ask the booking to move, save.
    ///
    /// Written once because the steps differ only in which method they call. The rules
    /// about what may follow what live on the booking, so the screen and the write path
    /// answer from the same place.
    /// </summary>
    private async Task<Result<ReservationResponse>> TransitionAsync(
        Guid managerUserId,
        Guid reservationId,
        Func<Reservation, DateTimeOffset, bool> move,
        CancellationToken cancellationToken)
    {
        var found = await LoadForWriteAsync(managerUserId, reservationId, cancellationToken);

        if (found.IsFailure)
        {
            return Result.Failure<ReservationResponse>(found.Error!);
        }

        var (restaurantId, reservation) = found.Value;

        if (!move(reservation, DateTimeOffset.UtcNow))
        {
            return Result.Failure<ReservationResponse>(ReservationErrors.WrongStatus);
        }

        return await SaveAndReloadAsync(restaurantId, reservation, cancellationToken);
    }

    /// <summary>
    /// Puts a booking on a table, or takes it off one, refusing a clash.
    ///
    /// The table must be ours and in service: a table out of service cannot be promised
    /// to anybody, and one belonging elsewhere must be indistinguishable from missing.
    /// Passing no table clears the assignment, which is how a booking goes back to
    /// having nowhere decided.
    /// </summary>
    private async Task<Result<bool>> AssignTableAsync(
        Reservation reservation,
        Guid? tableId,
        Guid restaurantId,
        CancellationToken cancellationToken)
    {
        if (tableId is null)
        {
            reservation.TableId = null;
            return Result.Success(true);
        }

        var table = await _dbContext.RestaurantTables
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == tableId &&
                    candidate.RestaurantId == restaurantId &&
                    candidate.IsActive,
                cancellationToken);

        if (table is null)
        {
            return Result.Failure<bool>(ReservationErrors.TableUnavailable);
        }

        reservation.TableId = tableId;

        // Only bookings that still hold the table can clash, which is why a cancelled or
        // finished one never blocks the next sitting. Loaded rather than filtered in SQL
        // because the overlap rule lives on the entity and must not be written twice.
        var others = await _dbContext.Reservations
            .AsNoTracking()
            .Where(candidate =>
                candidate.RestaurantId == restaurantId &&
                candidate.TableId == tableId &&
                candidate.Id != reservation.Id)
            .Include(candidate => candidate.Customer)
            .ToListAsync(cancellationToken);

        var clash = others.FirstOrDefault(candidate => reservation.ClashesWith(candidate));

        if (clash is not null)
        {
            return Result.Failure<bool>(ReservationErrors.TableAlreadyHeld(
                table.Name,
                clash.Customer.Name));
        }

        return Result.Success(true);
    }

    private async Task<Result<(Guid RestaurantId, Reservation Reservation)>> LoadForWriteAsync(
        Guid managerUserId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        var restaurantId = await ResolveRestaurantIdAsync(managerUserId, cancellationToken);

        if (restaurantId is null)
        {
            return Result.Failure<(Guid, Reservation)>(
                ReservationErrors.NoRestaurantAssigned);
        }

        var reservation = await ReservationsOf(restaurantId.Value)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == reservationId,
                cancellationToken);

        return reservation is null
            ? Result.Failure<(Guid, Reservation)>(ReservationErrors.NotFound)
            : Result.Success((restaurantId.Value, reservation));
    }

    private async Task<Result<ReservationResponse>> SaveAndReloadAsync(
        Guid restaurantId,
        Reservation reservation,
        CancellationToken cancellationToken)
    {
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Two people acting on the same booking at once is realistic on a busy
            // service. The loser is told rather than silently undoing the winner.
            return Result.Failure<ReservationResponse>(ReservationErrors.Conflict);
        }

        return await ReloadAsync(restaurantId, reservation.Id, cancellationToken);
    }

    /// <summary>
    /// Reads the booking back with its customer and table.
    ///
    /// Rather than mapping the tracked entity, whose navigations may not be loaded: a
    /// response missing a customer name would render as a blank row.
    /// </summary>
    private async Task<Result<ReservationResponse>> ReloadAsync(
        Guid restaurantId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        var reservation = await ReservationsOf(restaurantId)
            .AsNoTracking()
            .Include(candidate => candidate.Customer)
            .Include(candidate => candidate.Table)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == reservationId,
                cancellationToken);

        return reservation is null
            ? Result.Failure<ReservationResponse>(ReservationErrors.NotFound)
            : Result.Success(ToResponse(reservation));
    }

    private IQueryable<Reservation> ReservationsOf(Guid restaurantId) =>
        _dbContext.Reservations.Where(
            reservation => reservation.RestaurantId == restaurantId);

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

    private async Task<Restaurant?> ResolveRestaurantAsync(
        Guid managerUserId,
        CancellationToken cancellationToken) =>
        await _dbContext.Restaurants
            .AsNoTracking()
            .SingleOrDefaultAsync(
                restaurant => restaurant.ManagerId == managerUserId,
                cancellationToken);

    private static string? Normalise(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ReservationResponse ToResponse(Reservation reservation) =>
        new(
            reservation.Id,
            reservation.CustomerId,
            reservation.Customer.Name,
            reservation.Customer.Phone,
            reservation.ReservedForUtc,
            reservation.DurationMinutes,
            reservation.EndsAtUtc,
            reservation.GuestCount,
            reservation.TableId,
            reservation.Table?.Name,
            reservation.Table?.Capacity,
            reservation.Status,
            reservation.Notes,
            reservation.CancellationReason,
            reservation.CanConfirm,
            // Without a table there is nowhere to seat them, so the screen should not
            // offer it. The write path checks the same thing.
            reservation.CanSeat && reservation.TableId is not null,
            reservation.CanComplete,
            reservation.CanCancel,
            reservation.IsEditable,
            reservation.CreatedAtUtc);
}
