using RestaurantManagement.Application.Realtime;

namespace RestaurantManagement.IntegrationTests.Infrastructure;

/// <summary>
/// A notifier that says nothing.
///
/// Unlike the stock consumption these tests deliberately use for real, there is nothing
/// to be learned here by delivering anything: notifications are a courtesy laid over
/// work that has already committed, they change no state, and no assertion in this suite
/// is about what a screen was told. A real hub would need a host to be running.
///
/// It does still stand in for the failure mode that matters. Every service publishes
/// after its save, so a notifier that does nothing proves the work completes without
/// one - which is exactly what happens in the product when a hub is unreachable.
/// </summary>
internal sealed class SilentRealtimeNotifier : IRealtimeNotifier
{
    public Task OrderPlacedAsync(
        Guid restaurantId,
        OrderPlacedEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task OrderConfirmedAsync(
        Guid restaurantId,
        OrderConfirmedEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task TicketQueuedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task TicketStartedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task TicketReadyAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task OrderSettledAsync(
        Guid orderId,
        int orderNumber,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task BillRequestedAsync(
        Guid restaurantId,
        BillRequestedEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;

    public Task TicketServedAsync(
        Guid restaurantId,
        TicketEvent payload,
        CancellationToken cancellationToken) => Task.CompletedTask;
}
