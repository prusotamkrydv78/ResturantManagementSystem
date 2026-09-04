using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Realtime;

namespace RestaurantManagement.Api.Hubs;

/// <summary>
/// What the floor and the kitchen hear while they are standing there.
///
/// The product works without this. Every screen can load the truth for itself, and two
/// of them poll; this exists because twenty seconds is a long time when a customer is
/// sitting at a table nobody has come to, and because a waiter cannot poll a screen they
/// are not looking at.
///
/// Authenticated like everything else, and then placed in groups by what the person
/// does. Membership is decided here, on connect, rather than accepted from the client:
/// a hub method that let a caller name its own group would let anybody join any
/// restaurant and listen to its service.
///
/// The connection is deliberately given nothing to call. Real-time in this product is
/// one directional - the server tells screens that something changed and they go and
/// read it through the ordinary authorised endpoints. A hub method that performed work
/// would be a second way in with its own permission rules to get wrong.
/// </summary>
[Authorize]
public sealed class OperationsHub : Hub
{
    private readonly IConnectionScopeLookup _scope;
    private readonly ILogger<OperationsHub> _logger;

    /// <summary>Creates the hub.</summary>
    public OperationsHub(IConnectionScopeLookup scope, ILogger<OperationsHub> logger)
    {
        _scope = scope;
        _logger = logger;
    }

    /// <summary>The group carrying a restaurant's floor events.</summary>
    public static string FloorGroup(Guid restaurantId) => $"floor:{restaurantId}";

    /// <summary>The group carrying a restaurant's kitchen events.</summary>
    public static string KitchenGroup(Guid restaurantId) => $"kitchen:{restaurantId}";

    /// <inheritdoc />
    public override async Task OnConnectedAsync()
    {
        // Null-checked rather than assumed. The hub is [Authorize]d, so in practice
        // there is always a principal, but the type says otherwise and a NullReference
        // inside OnConnectedAsync would fail the handshake with nothing useful logged.
        var userId = Context.User?.GetUserId();

        if (userId is null)
        {
            // Authorised but unreadable, which should not happen. Aborted rather than
            // left connected in no group: a connection that hears nothing is a bug that
            // looks exactly like a quiet evening.
            Context.Abort();

            return;
        }

        var restaurantId = await _scope.RestaurantOfAsync(userId.Value, Context.ConnectionAborted);

        if (restaurantId is null)
        {
            // A platform administrator, or an account deactivated since its token was
            // issued. Neither belongs to a restaurant's service.
            Context.Abort();

            return;
        }

        // Both, for a manager. They are excluded from floor and kitchen operations by
        // policy - they cannot take an order or cook - but a manager standing in their
        // own restaurant watching it run is the whole point of the floor screen, and
        // there is nothing here they are not already entitled to read.
        var staffRole = Context.User?.FindFirst(JwtClaimNames.StaffRole)?.Value;

        var groups = staffRole switch
        {
            StaffRoleNames.Waiter => new[] { FloorGroup(restaurantId.Value) },
            StaffRoleNames.Chef => [KitchenGroup(restaurantId.Value)],
            _ => [FloorGroup(restaurantId.Value), KitchenGroup(restaurantId.Value)],
        };

        foreach (var group in groups)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
        }

        _logger.LogDebug(
            "Realtime client {ConnectionId} joined {GroupCount} group(s) for restaurant {RestaurantId}.",
            Context.ConnectionId,
            groups.Length,
            restaurantId);

        await base.OnConnectedAsync();
    }

    /// <inheritdoc />
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // Group membership is dropped for us. Logged at debug because a phone going
        // through a tunnel disconnects constantly and it is not news.
        _logger.LogDebug(
            "Realtime client {ConnectionId} disconnected.",
            Context.ConnectionId);

        return base.OnDisconnectedAsync(exception);
    }
}
