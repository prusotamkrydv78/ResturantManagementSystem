using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Api.Hubs;
using RestaurantManagement.Api.Middleware;
using RestaurantManagement.Api.OpenApi;
using RestaurantManagement.Application;
using RestaurantManagement.Infrastructure;
using RestaurantManagement.Infrastructure.Identity;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicyName = "FrontendCors";

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

// Enums travel as their names, not their numbers.
//
// Every status in this API is a small named set that a client branches on, and the
// frontend types declare them as string unions. Without this they serialise as
// integers, so a comparison against "Ready" or "Completed" silently fails instead of
// erroring: the response still parses, the field is just quietly the wrong shape.
// Names are also what keeps a response readable, and stop a value shifting meaning
// if an enum ever gains a member in the middle.
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSignalR();

builder.Services.AddOpenApi(options =>
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>());

// Global exception handling: any unhandled exception becomes a ProblemDetails response.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Allow the Next.js frontend to call this API. Origins come from configuration so
// more than one port can be permitted; AllowAnyOrigin is not usable here because
// credentialed requests (the refresh cookie) require an explicit origin list.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()); // required for the refresh cookie and SignalR
});

builder.Services.AddJwtAuthentication(builder.Configuration);

// Layer registrations.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// ---------------------------------------------------------------------------
// Startup bootstrap
// ---------------------------------------------------------------------------

// Creates the platform Super Admin when one does not exist. Idempotent, and a
// no-op unless Bootstrap:SuperAdmin is configured.
await app.Services.BootstrapIdentityAsync();

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    // Serves the OpenAPI document at /openapi/v1.json and Swagger UI at /swagger.
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
        options.SwaggerEndpoint("/openapi/v1.json", "Restaurant Management API v1"));
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors(CorsPolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<SystemHub>("/hubs/system");

app.Logger.LogInformation(
    "Restaurant Management API started in {Environment} environment.",
    app.Environment.EnvironmentName);

app.Run();
