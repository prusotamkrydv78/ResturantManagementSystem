using Microsoft.AspNetCore.SignalR;

namespace RestaurantManagement.Api.Hubs;

/// <summary>
/// Placeholder hub that exists only to verify SignalR is wired up.
/// Real-time business events (orders, kitchen, etc.) are not implemented yet.
/// </summary>
public sealed class SystemHub : Hub
{
    private readonly ILogger<SystemHub> _logger;

    /// <summary>Creates the hub.</summary>
    public SystemHub(ILogger<SystemHub> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public override Task OnConnectedAsync()
    {
        _logger.LogInformation("SignalR client connected: {ConnectionId}", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    /// <inheritdoc />
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("SignalR client disconnected: {ConnectionId}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>Round-trips a message back to the caller to prove the connection works.</summary>
    /// <param name="message">Any text supplied by the client.</param>
    public Task<string> Echo(string message) => Task.FromResult(message);
}
