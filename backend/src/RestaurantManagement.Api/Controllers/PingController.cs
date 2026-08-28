using Microsoft.AspNetCore.Mvc;

namespace RestaurantManagement.Api.Controllers;

/// <summary>
/// Example endpoint kept only so the frontend can confirm it reaches the API
/// (routing, CORS, base URL). Remove once real endpoints exist.
/// </summary>
[ApiController]
[Route("api/ping")]
public sealed class PingController : ControllerBase
{
    /// <summary>Returns a fixed greeting.</summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Get() => Ok(new { message = "pong" });
}
