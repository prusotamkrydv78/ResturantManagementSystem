# Restaurant Management SaaS

Foundation for a restaurant management SaaS platform. In place: project scaffolding, the
**authentication module**, and the **restaurant + manager ownership foundation**.
Restaurant operations (branches, staff, menus, orders) are not implemented yet.

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Backend:** ASP.NET Core 10 Web API, modular monolith
- **Database:** Microsoft SQL Server via Entity Framework Core 10
- **Auth:** ASP.NET Core Identity, GUID user keys, JWT access tokens + rotating refresh tokens
- **Real-time:** SignalR

## Repository layout

```
.
├── frontend/                                Next.js application
│   ├── app/
│   │   ├── login/  register/                Public auth pages
│   │   ├── dashboard/                       Protected test page
│   │   ├── admin/restaurants/               Super Admin restaurant management
│   │   ├── my-restaurant/                   Restaurant Manager view
│   │   └── layout.tsx  page.tsx             Root layout (AuthProvider) and landing page
│   ├── components/{ui,common,layout}/       Shared UI building blocks
│   ├── features/{auth,restaurants}/         API calls, context, route guard
│   ├── lib/{api,auth,utils,config}/         API client, in-memory token store, env config
│   ├── hooks/  types/                       Shared hooks and types
│   └── .env.example
│
└── backend/
    ├── RestaurantManagement.sln
    ├── Directory.Build.props                Shared build settings for all projects
    ├── src/
    │   ├── RestaurantManagement.Api/            Host: DI, logging, Swagger, JWT validation, controllers
    │   ├── RestaurantManagement.Application/    Auth + restaurant contracts, DTOs, options
    │   ├── RestaurantManagement.Domain/         ApplicationUser, RefreshToken, Restaurant
    │   ├── RestaurantManagement.Infrastructure/ EF Core, Identity, Auth + Restaurant services, migrations
    │   └── RestaurantManagement.Shared/         Result and Error primitives
    └── tests/                               Test projects (empty for now)
```

### Layer dependencies

Dependencies point inward; `Api` is the composition root.

```
Shared  ←  Domain  ←  Application  ←  Infrastructure  ←  Api
```

`IAuthService` is declared in **Application**; the implementation lives in
**Infrastructure** because it needs Identity and EF Core. The controller only maps
results to status codes and owns the refresh cookie.

## Prerequisites

- [.NET SDK 10.0+](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- SQL Server. The development connection string points at LocalDB
  (`(localdb)\MSSQLLocalDB`), which ships with the SQL Server tooling. Point
  `ConnectionStrings:DefaultConnection` elsewhere if you run a full instance.
- `dotnet-ef` for migrations: `dotnet tool install --global dotnet-ef`

## Running the backend

The JWT signing key is not committed. Set it once per machine:

```bash
cd backend/src/RestaurantManagement.Api
dotnet user-secrets init
dotnet user-secrets set "Jwt:Key" "<a random string of at least 32 characters>"
```

Then create the database and run:

```bash
cd backend
dotnet restore
dotnet ef database update --project src/RestaurantManagement.Infrastructure --startup-project src/RestaurantManagement.Api
dotnet run --project src/RestaurantManagement.Api
```

Startup fails fast with a clear message if `Jwt:Key` is missing or shorter than 32 bytes.

| URL                      | Description                    |
| ------------------------ | ------------------------------ |
| `http://localhost:5080`  | HTTP                           |
| `https://localhost:7080` | HTTPS                          |
| `/health`                | Health check                   |
| `/api/ping`              | Example endpoint               |
| `/swagger`               | Swagger UI (Development only)  |
| `/openapi/v1.json`       | OpenAPI document (Development) |
| `/hubs/system`           | SignalR placeholder hub        |

### Authentication endpoints

| Method | Route                | Auth   | Purpose                                            |
| ------ | -------------------- | ------ | -------------------------------------------------- |
| POST   | `/api/auth/register` | Public | Create an account, return an access token          |
| POST   | `/api/auth/login`    | Public | Sign in, return an access token                    |
| POST   | `/api/auth/refresh`  | Cookie | Rotate the refresh token, return a new access token |
| POST   | `/api/auth/logout`   | Cookie | Revoke the refresh token and clear the cookie      |
| GET    | `/api/auth/me`       | Bearer | The user identified by the access token            |

Swagger UI has an **Authorize** button: paste the `accessToken` from a login
response to call `/api/auth/me`.

`backend/src/RestaurantManagement.Api/RestaurantManagement.Api.http` contains ready-made
requests for the whole flow.

## Running the frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

| Route        | Access                                     |
| ------------ | ------------------------------------------ |
| `/`          | Public landing page                        |
| `/login`     | Public                                     |
| `/register`  | Public                                     |
| `/dashboard` | Protected; redirects to `/login` when anonymous |
| `/admin/restaurants` | Protected, SuperAdmin only |
| `/my-restaurant` | Protected, RestaurantManager only |

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Token strategy

| | Access token | Refresh token |
| --- | --- | --- |
| Format | JWT, HS256 | 32 random bytes, Base64 |
| Lifetime | 15 minutes (`Jwt:AccessTokenMinutes`) | 7 days (`Jwt:RefreshTokenDays`) |
| Transport | `Authorization: Bearer` header | HttpOnly cookie, `path=/api/auth` |
| Frontend storage | Module memory only | Never readable by JavaScript |
| Database | Not stored | SHA-256 hash only |

- The access token is **never** written to `localStorage` or `sessionStorage`, so it
  cannot be read back out of persistent storage.
- The refresh token never appears in a response body and is never returned to JS.
- Only a SHA-256 hash of the refresh token is persisted, so a database leak yields no
  usable sessions.
- **Rotation:** every `/api/auth/refresh` revokes the presented token and issues a new
  one. Presenting an already-rotated token is treated as reuse and revokes every
  active token for that user.
- **Session restore:** on startup the frontend calls `/api/auth/refresh` once. If the
  cookie is still valid the user is restored, which is what survives a browser refresh.
- The API client attaches the access token, and on a `401` performs at most one
  refresh and one retry. Concurrent 401s share a single refresh request.

## Configuration

### Frontend (`frontend/.env.local`)

| Variable              | Description              |
| --------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL` | Base URL of the Web API. |

### Backend (`backend/src/RestaurantManagement.Api/appsettings*.json`)

| Key                                   | Description                                              |
| ------------------------------------- | -------------------------------------------------------- |
| `ConnectionStrings:DefaultConnection` | SQL Server connection string.                            |
| `Cors:AllowedOrigins`                 | Array of allowed frontend origins.                       |
| `Jwt:Issuer` / `Jwt:Audience`         | Validated on every request.                              |
| `Jwt:Key`                             | Signing key. **User secrets or environment only.**       |
| `Jwt:AccessTokenMinutes`              | Access token lifetime.                                   |
| `Jwt:RefreshTokenDays`                | Refresh token lifetime.                                  |
| `RefreshTokenCookie:Secure`           | `true` in production, `false` in development over HTTP.   |
| `RefreshTokenCookie:SameSite`         | `Lax` by default; use `None` (with `Secure`) if the frontend is genuinely cross-site. |
| `Logging:LogLevel`                    | Log levels per category.                                 |

No secrets are committed. `Jwt:Key` is blank in `appsettings.json` on purpose.

CORS is configured from `Cors:AllowedOrigins` because credentialed requests (the
refresh cookie) cannot use `AllowAnyOrigin`. Add whichever port the frontend uses;
`3000`, `3001` and `3002` are allowed in development.

## Platform hierarchy and Super Admin bootstrap

The platform model authentication is being prepared for:

```
System bootstrap  →  Super Admin exists
                     → Super Admin creates a Restaurant
                       → Super Admin creates/assigns a Restaurant Manager
                         → Manager runs their own restaurant
```

Only the first step exists today. Restaurant creation and manager assignment arrive
in later phases.

A user carries a single `PlatformRole` (`User`, `SuperAdmin`, or `RestaurantManager`). This is intentionally
**not** a role-management system: there are no role tables, no role CRUD, and no
restaurant-level roles. The value is emitted as the standard `role` claim, so future
admin endpoints can use `[Authorize(Roles = "SuperAdmin")]` with no extra plumbing.

### Creating the Super Admin

Credentials come from configuration only — nothing is hardcoded:

```bash
cd backend/src/RestaurantManagement.Api
dotnet user-secrets set "Bootstrap:SuperAdmin:Email" "admin@yourdomain.com"
dotnet user-secrets set "Bootstrap:SuperAdmin:Password" "<a strong password>"
```

Environment variables work too: `Bootstrap__SuperAdmin__Email`,
`Bootstrap__SuperAdmin__Password`.

The bootstrap runs on every startup and is safe to repeat:

| Situation | Behaviour |
| --- | --- |
| Not configured (no email/password, or `Enabled: false`) | Skipped, logged at Information |
| A Super Admin already exists | Skipped — a second one is never created |
| The configured email exists as an ordinary user | Skipped with a warning; the account is **not** auto-promoted, so a config change cannot escalate an existing user |
| Otherwise | Created via Identity, `EmailConfirmed = true` |

Passwords go through ASP.NET Core Identity. The plain-text value is never stored or
logged.

### Restaurants and manager assignment

A restaurant is created by a Super Admin, then given exactly one manager.

Ownership is recorded in **one** place: `Restaurants.ManagerId`. A filtered unique
index (`WHERE ManagerId IS NOT NULL`) means a user manages at most one restaurant,
and a restaurant has at most one manager. There is deliberately no second copy of
this link on the user row, so the two can never disagree. When staff arrive in a
later phase they get their own association to a restaurant, which is additive.

| Method | Route | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/restaurants` | SuperAdmin | Create a restaurant (no manager yet) |
| GET | `/api/restaurants` | SuperAdmin | List all restaurants |
| GET | `/api/restaurants/{id}` | SuperAdmin | Restaurant detail with manager |
| POST | `/api/restaurants/{id}/manager` | SuperAdmin | Assign the initial manager |
| GET | `/api/restaurants/mine` | RestaurantManager | The restaurant of the caller |

Manager assignment accepts either form, and exactly one of them:

```jsonc
{ "userId": "…" }                                        // promote an existing user
{ "fullName": "…", "email": "…", "password": "…" }        // create a new account
```

Creating the account and linking the restaurant run in one database transaction, so
a failure cannot leave a manager account attached to nothing.

Assignment is refused when the target user does not exist, is a Super Admin, already
manages another restaurant, or when the restaurant already has a different manager
(this phase covers initial assignment only).

### How manager access is confined

`GET /api/restaurants/mine` takes **no identifier**. The restaurant is found with
`ManagerId == sub`, reading the subject from the validated JWT. No manager-facing
endpoint accepts a restaurant id, so there is no value in any request a manager could
change to reach a restaurant that is not theirs. Frontend route guards are cosmetic;
`[Authorize(Roles = ...)]` plus the ownership query are what actually enforce this.

A newly assigned manager keeps their old `role` claim until their access token is
renewed. The next refresh regenerates the token from the database row, so the new
role takes effect within the access-token lifetime without a forced sign-out.

### Registration is unprivileged

`POST /api/auth/register` always sets `PlatformRole = User`; there is no code path by
which a client can self-register as a privileged account. The endpoint exists for
development and testing. Production onboarding is the Super Admin flow above, so this
endpoint should be removed or restricted before going live.

## Database

Migrations: `AddAuthentication` creates the Identity and refresh-token schema;
`AddPlatformRole` adds the `PlatformRole` column; `AddRestaurants` adds the restaurant
table and its ownership relationship. Together they create:

| Table | Purpose |
| --- | --- |
| `AspNetUsers` | Identity users, `Id uniqueidentifier`, plus `FullName`, `PlatformRole` and `CreatedAtUtc` |
| `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens` | Identity support tables |
| `RefreshTokens` | Token hash, expiry, revocation, and the id of the replacement token |
| `Restaurants` | Name, unique slug, optional contact/address, `ManagerId` FK, timestamps |

The context derives from `IdentityUserContext<ApplicationUser, Guid>` rather than the
full Identity context, so **no role tables are created** — roles are out of scope.

## Not implemented yet

Tenants and tenant context, branches, staff (waiters, chefs, cashiers), restaurant-level
roles and permissions, a role-management UI, manager reassignment or removal, tables,
menus, orders, kitchen/KOT, QR ordering, payments, inventory, reporting, subscription
billing, email verification, forgot password, social login, two-factor authentication,
real-time business events, Docker, and automated tests. These arrive in later phases.


