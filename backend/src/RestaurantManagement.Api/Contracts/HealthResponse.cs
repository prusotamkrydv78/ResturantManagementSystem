namespace RestaurantManagement.Api.Contracts;

/// <summary>Payload returned by the health endpoint.</summary>
/// <param name="Status">Always "Healthy" when the API can respond.</param>
/// <param name="Service">Name of the service that answered.</param>
/// <param name="Environment">Current hosting environment name.</param>
/// <param name="TimestampUtc">Server time when the response was produced.</param>
public sealed record HealthResponse(
    string Status,
    string Service,
    string Environment,
    DateTimeOffset TimestampUtc);
