namespace RestaurantManagement.Shared.Results;

/// <summary>
/// A machine-readable failure descriptor passed between layers.
/// Kept intentionally small; richer error handling can grow around it later.
/// </summary>
/// <param name="Code">Stable identifier for the failure, e.g. "menu.item_not_found".</param>
/// <param name="Message">Human-readable description safe to return to a caller.</param>
public sealed record Error(string Code, string Message);
