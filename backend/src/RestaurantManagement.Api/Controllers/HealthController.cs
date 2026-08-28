using Microsoft.AspNetCore.Mvc;
using RestaurantManagement.Api.Contracts;

namespace RestaurantManagement.Api.Controllers;

/// <summary>Liveness endpoint used to verify that the API is running.</summary>
[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    private readonly IHostEnvironment _environment;
    private readonly ILogger<HealthController> _logger;

    /// <summary>Creates the controller.</summary>
    public HealthController(IHostEnvironment environment, ILogger<HealthController> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    /// <summary>Reports that the backend is running.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        _logger.LogDebug("Health check requested.");

        return Ok(new HealthResponse(
            Status: "Healthy",
            Service: "RestaurantManagement.Api",
            Environment: _environment.EnvironmentName,
            TimestampUtc: DateTimeOffset.UtcNow));
    }
}
