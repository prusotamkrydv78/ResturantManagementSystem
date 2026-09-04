using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RestaurantManagement.Application.Realtime;

namespace RestaurantManagement.Api.Hubs;

/// <summary>
/// What a customer hears about their own order.
///
/// A separate hub from the staff one rather than an exception carved into it, and that
/// separation is the point: <see cref="OperationsHub"/> gets to keep the flat guarantee
/// that every connection on it is an authenticated member of one restaurant's staff. An
/// anonymous method living there would put that guarantee behind a code review forever.
///
/// This one is anonymous, because a customer has no account anywhere in this product.
/// What it has instead is exactly one method, and a connection that has not successfully
/// called it hears nothing at all - it sits in no group, so there is no traffic to
/// receive. Being connected grants nothing; presenting the key does.
///
/// Every message that goes out is a stage and an order number. Nothing about the
/// restaurant, the table, the kitchen or the member of staff who acted reaches a phone,
/// which is the difference between telling somebody their food is coming and putting a
/// restaurant's service on a stranger's screen.
/// </summary>
[AllowAnonymous]
public sealed class CustomerHub : Hub
{
    /// <summary>
    /// How many wrong keys one connection may present before it is dropped.
    ///
    /// The keys are 128 bits of randomness, so guessing one is not a realistic attack
    /// and this is not what stands between a customer and an attacker - that is the key
    /// itself. It is here so that a client stuck in a retry loop, or somebody probing
    /// out of curiosity, costs a bounded number of database lookups rather than an
    /// unbounded stream of them down a socket that is cheap to hold open.
    /// </summary>
    private const int MaxAttempts = 5;

    private readonly ICustomerOrderWatch _watch;
    private readonly ILogger<CustomerHub> _logger;

    /// <summary>Creates the hub.</summary>
    public CustomerHub(ICustomerOrderWatch watch, ILogger<CustomerHub> logger)
    {
        _watch = watch;
        _logger = logger;
    }

    /// <summary>The group carrying updates about one order.</summary>
    public static string OrderGroup(Guid orderId) => $"order:{orderId}";

    /// <summary>
    /// Asks to follow the order this key names.
    ///
    /// Returns the order number on success and null on refusal, deliberately without
    /// saying which of the several reasons applied - a wrong key, a wrong restaurant, or
    /// an order that has already been settled or called off all answer the same way. The
    /// page turns a null into "we cannot follow this one", which is the whole of what a
    /// customer can usefully do about it.
    ///
    /// Callable more than once, so a reconnection re-joins without a new connection, and
    /// so a customer who orders a second round can follow the new order.
    /// </summary>
    /// <param name="slug">The restaurant's public slug.</param>
    /// <param name="cancelKey">The key handed back when the order was placed.</param>
    public async Task<int?> WatchOrder(string slug, string cancelKey)
    {
        var attempts = Context.Items.TryGetValue(nameof(MaxAttempts), out var stored)
            ? (int)(stored ?? 0)
            : 0;

        if (attempts >= MaxAttempts)
        {
            Context.Abort();

            return null;
        }

        var handle = await _watch.ResolveAsync(slug, cancelKey, Context.ConnectionAborted);

        if (handle is null)
        {
            Context.Items[nameof(MaxAttempts)] = attempts + 1;

            return null;
        }

        // Counted from zero again on success, so a customer who mistypes nothing but
        // reconnects through a tunnel all evening is never locked out.
        Context.Items[nameof(MaxAttempts)] = 0;

        await Groups.AddToGroupAsync(Context.ConnectionId, OrderGroup(handle.OrderId));

        _logger.LogDebug(
            "Customer connection {ConnectionId} is following order {OrderNumber}.",
            Context.ConnectionId,
            handle.OrderNumber);

        return handle.OrderNumber;
    }
}
