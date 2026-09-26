using RestaurantManagement.Api.Authentication;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Api.Hubs;
using RestaurantManagement.Api.Middleware;
using RestaurantManagement.Api.OpenApi;
using RestaurantManagement.Api.RateLimiting;
using RestaurantManagement.Application;
using RestaurantManagement.Application.Realtime;
using RestaurantManagement.Infrastructure;
using RestaurantManagement.Infrastructure.Identity;
using System.Net;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;

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
// Enums as strings on the wire, matching every other response this API sends.
//
// SignalR carries its own serialiser options and inherits nothing from the MVC ones, so
// without this a stage that reads "Confirmed" everywhere else arrives at a phone as 0 -
// and the client, quite reasonably, looks up nothing under that key.
builder.Services
    .AddSignalR()
    .AddJsonProtocol(options =>
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddOpenApi(options =>
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>());

// Global exception handling: any unhandled exception becomes a ProblemDetails response.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Allow the Next.js frontend to call this API. Origins come from configuration so
// more than one port can be permitted; AllowAnyOrigin is not usable here because
// credentialed requests (the refresh cookie) require an explicit origin list.
//
// An entry may name a wildcard subdomain - "https://*.eatery.np" - which is what makes
// restaurant websites work at all. A published site is served from its own host, so
// the guest ordering and review screens on kanchan.eatery.np send that as their
// Origin, and a list holding only the platform's own host answers them with no
// Access-Control-Allow-Origin header at all. The browser then throws away a response
// this server was perfectly happy to give, and the page renders as though the
// restaurant did not exist - with nothing in any log on this side to find it by.
//
// The wildcard is narrower than it reads: the scheme, the port and every label after
// the first must still match exactly, so it grants nothing beyond the hosts this
// deployment hands out itself.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy => policy
        .WithOrigins(allowedOrigins)
        .SetIsOriginAllowedToAllowWildcardSubdomains()
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()); // required for the refresh cookie and SignalR
});

// Who is actually on the other end, when a proxy sits in front.
//
// The deployed frontend forwards /api/* through its own server (API_PROXY_TARGET), so
// every request reaches this process from that server's address. Without this, the
// rate limiter partitioned the entire platform into one bucket and every guest order
// recorded the proxy as where it came from.
//
// Only proxies named in configuration are believed. X-Forwarded-For is a header any
// client can write, and trusting it from anywhere would let a script claim a fresh
// address on every request and walk straight past every limit here. ForwardLimit of one
// takes the hop the trusted proxy added and nothing a client put in front of it.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;

    var forwarding = builder.Configuration.GetSection("ForwardedHeaders");

    foreach (var proxy in forwarding.GetSection("KnownProxies").Get<string[]>() ?? [])
    {
        if (IPAddress.TryParse(proxy, out var address))
        {
            options.KnownProxies.Add(address);
        }
    }

    foreach (var network in forwarding.GetSection("KnownNetworks").Get<string[]>() ?? [])
    {
        if (System.Net.IPNetwork.TryParse(network, out var range))
        {
            options.KnownIPNetworks.Add(range);
        }
    }

    // For a host whose proxy has no fixed address. Safe only when this API cannot be
    // reached except through that proxy - otherwise anybody can set the header.
    if (forwarding.GetValue<bool>("TrustAllProxies"))
    {
        options.KnownProxies.Clear();
        options.KnownIPNetworks.Clear();
    }
});

builder.Services.AddJwtAuthentication(builder.Configuration);

// Bounds on the anonymous ordering routes, which are the only ones in this product a
// script can reach without an account behind it.
builder.Services.AddPublicRateLimiting();

// Telling the floor and the kitchen what just happened. The transport lives here; the
// services that raise the events depend only on the interface.
builder.Services.AddScoped<IRealtimeNotifier, SignalRRealtimeNotifier>();

// Who is signed in, for the modules that record what was done rather than decide what
// may be done. Registered here because this is the only layer that knows what a request
// is; everything below depends on the interface.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();

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

// First, so everything after it - HTTPS redirection, the rate limiter, the address an
// order records - sees the visitor rather than the proxy.
app.UseForwardedHeaders();

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

// Before authentication, so a flood of anonymous requests is turned away without the
// cost of validating anything. Only routes that opt in with a policy are limited.
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// Closed when the token it was opened with expires.
//
// Group membership is decided once, at connect, and a WebSocket can stay open for a
// whole service. Without this a waiter who was deactivated mid-shift kept receiving
// every order in the restaurant for as long as the tab stayed open. The client reopens
// with a fresh token, so somebody still entitled to the feed notices nothing, and
// somebody who is not is refused at the reconnect.
app.MapHub<OperationsHub>(
    "/hubs/operations",
    options => options.CloseOnAuthenticationExpiration = true);

// The customer's own order, followed anonymously by presenting the key they were given
// when they placed it. A separate hub so the staff one keeps its guarantee that every
// connection on it is authenticated.
app.MapHub<CustomerHub>("/hubs/customer")
    .RequireRateLimiting(PublicRateLimiting.PublicRead);

app.Logger.LogInformation(
    "Restaurant Management API started in {Environment} environment.",
    app.Environment.EnvironmentName);

app.Run();
