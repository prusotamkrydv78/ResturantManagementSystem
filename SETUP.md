# Running this project on a new machine

Nothing in this archive is machine-specific except two secrets, which are deliberately
not in it. Setting them is the only step that is not "install and run".

---

## 1. Prerequisites

| Need | Check it is there | Where to get it |
|---|---|---|
| .NET 10 SDK | `dotnet --version` → 10.x | dotnet.microsoft.com/download |
| Node.js 20+ | `node --version` → v20 or higher | nodejs.org |
| SQL Server LocalDB | `sqllocaldb info` lists `MSSQLLocalDB` | part of SQL Server Express |
| EF Core tools | `dotnet ef --version` | `dotnet tool install --global dotnet-ef` |

**LocalDB is Windows only.** On macOS or Linux, run SQL Server in Docker and change the
connection string in `backend/src/RestaurantManagement.Api/appsettings.Development.json`:

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Your_Strong_Pass1" \
  -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
```

```jsonc
"DefaultConnection": "Server=localhost,1433;Database=RestaurantManagement;User Id=sa;Password=Your_Strong_Pass1;TrustServerCertificate=True;MultipleActiveResultSets=true"
```

---

## 2. The two secrets

`appsettings.json` ships with these **blank on purpose**. A signing key committed to a
repository is not a signing key, and a super admin password in source control is an
account anybody who reads the code owns.

They live in .NET user secrets, which sit outside the project folder and so are not in
this archive. Set them once per machine:

```powershell
cd backend/src/RestaurantManagement.Api

# a fresh signing key. Must be at least 32 bytes or the API refuses to start.
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 })))"

# the only account that will exist on a fresh database
dotnet user-secrets set "Bootstrap:SuperAdmin:Email"    "superadmin@localhost"
dotnet user-secrets set "Bootstrap:SuperAdmin:Password" "ChangeMe!SuperAdmin1"
```

On macOS or Linux:

```bash
cd backend/src/RestaurantManagement.Api
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)"
dotnet user-secrets set "Bootstrap:SuperAdmin:Email"    "superadmin@localhost"
dotnet user-secrets set "Bootstrap:SuperAdmin:Password" "ChangeMe!SuperAdmin1"
```

Confirm with `dotnet user-secrets list`. Pick your own password — the one above is a
placeholder, and there are no password rules in this product, so anything works.

---

## 3. Create the database

```bash
cd backend
dotnet ef database update \
  --project src/RestaurantManagement.Infrastructure \
  --startup-project src/RestaurantManagement.Api
```

Applies all 15 migrations to an empty database. Takes about a minute the first time.

---

## 4. Install and run

Two terminals, both left running.

**Backend**

```bash
cd backend
# Development is REQUIRED. User secrets only load in Development, and without them
# start-up fails with "Jwt:Key is not configured".
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/RestaurantManagement.Api
```

PowerShell:

```powershell
cd backend
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project src/RestaurantManagement.Api
```

→ http://localhost:5080 · health check at **`/health`** (not `/api/health`)

**Frontend**

```bash
cd frontend
npm install          # node_modules is not in this archive; first run takes a few minutes
npm run dev
```

→ http://localhost:3000

The frontend defaults to `http://localhost:5080` for the API. To point it elsewhere,
copy `.env.example` to `.env.local` and edit `NEXT_PUBLIC_API_URL`.

---

## 5. First sign-in

Open http://localhost:3000 and sign in with the super admin from step 2.

**That is the only account that exists.** There is no public sign-up: a platform
administrator creates a restaurant and issues its manager an account, and that manager
issues accounts to their own staff.

What to do next is in **`PROJECT_GUIDE.md` §4** — the setup order, with what breaks if you
skip a step. `TEST_GUIDE.md` has 166 manual test cases if you want to walk the whole
product.

---

## 6. If something fails

| Symptom | Cause | Fix |
|---|---|---|
| `Jwt:Key is not configured` | Not running in Development, so user secrets never loaded | Set `ASPNETCORE_ENVIRONMENT=Development` |
| `Jwt:Key must be at least 32 bytes` | Key too short | Regenerate with the command in step 2 |
| `Cannot open database` / login failed | LocalDB not installed or not started | `sqllocaldb start MSSQLLocalDB`, then rerun step 3 |
| `dotnet ef` not found | EF tools missing | `dotnet tool install --global dotnet-ef` |
| Frontend loads, every request fails | API not running, or on a different port | Check `/health`; set `NEXT_PUBLIC_API_URL` |
| CORS errors in the browser console | Frontend on a port the API does not allow | Add it to `Cors:AllowedOrigins` in `appsettings.Development.json` |
| Sign-in works, then random logouts | Two roles in one browser profile | One browser profile per role — the refresh cookie is shared and rotates |
| Port 5080 or 3000 already in use | Something else is on it | Stop it, or `dotnet run … --urls http://localhost:5081` / `npm run dev -- -p 3001` |

---

## 7. Starting over

```bash
cd backend
dotnet ef database drop --force \
  --project src/RestaurantManagement.Infrastructure \
  --startup-project src/RestaurantManagement.Api
dotnet ef database update \
  --project src/RestaurantManagement.Infrastructure \
  --startup-project src/RestaurantManagement.Api
```

Everything is deleted. The super admin is re-created from your secrets at the next API
start-up.

---

## 8. What is not in this archive

| Excluded | Why | Restored by |
|---|---|---|
| `node_modules/` | hundreds of megabytes, platform-specific | `npm install` |
| `.next/` | build output | `npm run dev` |
| `bin/`, `obj/` | build output | `dotnet build` |
| `.git/` | history, not needed to run | — |
| user secrets | they are secrets | step 2 |
| the database | LocalDB lives outside the project | step 3 |
