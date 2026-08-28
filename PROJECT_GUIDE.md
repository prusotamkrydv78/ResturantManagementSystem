# Project Guide

How this codebase is laid out, how a request travels through it, and the exact order to
set a restaurant up so nothing dead-ends on you while testing.

Read §4 first if you just want to test. §1–§3 are the map.

---

## 1. The shape of the repository

```
RMS/
├── backend/                     ASP.NET Core 10, one solution, four layers + tests
│   ├── src/
│   │   ├── RestaurantManagement.Domain/          ← no dependencies at all
│   │   ├── RestaurantManagement.Application/     ← depends on Domain + Shared
│   │   ├── RestaurantManagement.Infrastructure/  ← depends on Application
│   │   ├── RestaurantManagement.Api/             ← depends on Infrastructure
│   │   └── RestaurantManagement.Shared/          ← Result and Error, nothing else
│   └── tests/
│       ├── RestaurantManagement.Domain.Tests/         38 tests, no database
│       ├── RestaurantManagement.Application.Tests/    19 tests, no database
│       └── RestaurantManagement.IntegrationTests/     73 tests, real LocalDB
│
├── frontend/                    Next.js 16 App Router, TypeScript, Tailwind 4
│   ├── app/                     routes only
│   ├── features/                one folder per module: API calls and shared widgets
│   ├── components/              the design system
│   ├── lib/                     client, tokens, config, utilities
│   ├── types/                   the shape of every API response
│   └── tests/                   unit + contract
│
├── TEST_GUIDE.md                166 manual test cases
└── PROJECT_GUIDE.md             this file
```

**The dependency arrow only ever points one way**: Api → Infrastructure → Application →
Domain. Domain references nothing, which is why business rules can be tested without a
database. If you ever find yourself wanting Domain to reach for EF Core or `HttpContext`,
the rule belongs somewhere else.

### 1.1 Backend, in detail

```
Domain/                          The rules. Plain C#, no EF, no ASP.NET.
├── Orders/                      Order, OrderItem, KitchenTicket, OrderSource
├── Restaurants/                 Restaurant, RestaurantTable, PublicOrderingToken
├── Menu/                        MenuCategory, MenuItem
├── Inventory/                   InventoryItem, StockMovement, recipes, units
├── Reservations/                Reservation and its lifecycle
├── Customers/                   Customer
├── Payments/                    Payment, PaymentMethod
└── Identity/                    ApplicationUser, PlatformRole, StaffRole

Application/                     Contracts and shapes. No EF, no SQL.
└── <Module>/
    ├── I<Module>Service.cs      what the module can do
    ├── <Module>Errors.cs        every way it can refuse, with the message
    └── Dtos/                    request and response records

Infrastructure/                  The doing. EF Core lives here and nowhere else.
├── <Module>/<Module>Service.cs  implements the Application contract
├── Persistence/
│   ├── ApplicationDbContext.cs
│   ├── Configurations/          keys, indexes, check constraints, what to Ignore
│   └── Migrations/              generated, applied in order
└── DependencyInjection.cs       every service registration, one place

Api/                             Thin. Maps HTTP to a service call and back.
├── Controllers/                 one per module, role gate at the top
├── Authentication/              JWT, role policies, refresh cookie
├── Middleware/                  global exception handler
└── Program.cs                   pipeline, CORS, JSON options
```

**Controllers are deliberately thin.** A controller reads the user id from the token,
calls one service method, and turns a `Result` into a status code. If you find logic in a
controller, it is in the wrong place.

### 1.2 Frontend, in detail

```
app/
├── page.tsx                     public landing page, static, no JavaScript
├── layout.tsx                   fonts + AuthProvider, wraps everything
├── globals.css                  every colour token, the type scale, both themes
│
├── (auth)/login/                sign-in. There is no sign-up.
│
├── (app)/                       everything behind a session
│   ├── layout.tsx               RequireAuth + AppShell (sidebar, header)
│   ├── dashboard/               every role lands here
│   ├── admin/                   Super Admin only
│   │   ├── restaurants/  managers/  reports/  settings/
│   ├── orders/  orders/new/  orders/[id]/       Waiter
│   ├── kitchen/                                 Chef
│   ├── floor/                                   Manager + Waiter
│   ├── billing/  billing/[id]/  billing/[id]/receipt/  billing/history/
│   ├── menu/  tables/  staff/  inventory/  inventory/[id]/
│   ├── customers/  customers/[id]/  reservations/
│   ├── reports/  settings/  my-restaurant/      Manager
│
└── t/[token]/                   the guest QR page. No session, no chrome.

features/<module>/api.ts         every fetch for that module, typed
components/ui/                   badge, button, dialog, field, input, password-input,
                                 qr-code, states, surface, table
components/layout/               app-shell, sidebar, nav-config, page-header
lib/api/client.ts                apiFetch: token, single refresh on 401, ApiError
lib/auth/token-store.ts          access token in memory only, never persisted
lib/qr/encode.ts                 the QR encoder, written here, no dependency
types/<module>.ts                the shape of every response the screens read
```

**Route groups `(auth)` and `(app)` do not appear in URLs.** `app/(app)/billing/page.tsx`
serves `/billing`. The group exists so everything inside `(app)` shares one auth gate and
one shell.

**`app/t/[token]/` is outside `(app)` on purpose** — a guest gets no sidebar, no account
menu, and no route into the application.

---

## 2. How one request travels

Taking `POST /api/waiter/orders` end to end:

```
1  Browser      features/orders/api.ts → createOrder(payload)
2  lib/api      apiFetch attaches the in-memory access token
                  on 401 → one refresh via the HttpOnly cookie → retry once
3  Api          WaiterController.Create
                  [Authorize(Policy = Waiter)]        role checked here
                  User.GetUserId()                    identity from the token
4  Application   IOrderService.CreateAsync(staffUserId, request, ct)
                  the contract. No restaurant id in the request, anywhere.
5  Infrastructure OrderService
                  resolves the restaurant FROM the waiter, not from the payload
                  re-reads every price from its own menu
                  asks the Domain whether the table may take an order
6  Domain        Order + OrderItem, snapshots taken, table marked Occupied
7  EF Core       one SaveChanges, order number retried on collision
8  back up       Result<OrderResponse> → 201 → typed by types/order.ts
```

Three properties of this path are worth knowing because they explain most "why did it
refuse me" moments:

- **No endpoint anywhere accepts a restaurant id.** It is always derived from the signed-in
  account. Adding one to a request body does nothing.
- **Prices are never read from the request.** The server prices from its own menu every
  time. Editing a price in devtools changes nothing.
- **Eligibility is decided by the Domain and sent to the screen as a flag.** The button you
  see and the rule the server enforces are the same expression, so a button is never
  offered for something that would be refused.

---

## 3. The spine: one order, table to till

Everything else in the product hangs off this. Learn these five states and most of the
system explains itself.

```
   TABLE AVAILABLE
        │
        │  waiter: /orders/new → Place order
        ▼
   ORDER OPEN ──────────────► table becomes OCCUPIED  (a consequence, not a switch)
   lines: not sent            stock: untouched
        │
        │  waiter: /orders/[id] → "Send N to kitchen"     ◄── SEPARATE STEP
        ▼
   KOT RAISED  (Pending)      stock: ingredients leave HERE, once, per line
        │                     lines: now locked, cannot be edited
        │  chef: /kitchen → Start preparing
        ▼
   KOT PREPARING
        │  chef: /kitchen → Mark ready
        ▼
   KOT READY                  ticket leaves the rail
        │
        │  manager: /billing/[id] → Complete & record payment
        ▼
   ORDER COMPLETED ─────────► table AVAILABLE again, if no other order is open
   receipt available          report and dashboard pick it up
```

### 3.1 The four gates, exactly

An order can be **settled** only when all four hold. Any one of them false and the button
is disabled and the API returns 409:

| # | Condition | If it fails you see |
|---|---|---|
| 1 | Status is Open | "already completed" / "already paid" |
| 2 | No payment recorded yet | "already paid" |
| 3 | **Every line has been sent to the kitchen** | *"N items have never been sent to the kitchen"* |
| 4 | Every raised ticket is Ready | *"N kitchen tickets are not ready yet"* |

Gate 3 is the one that bit you. It is about **lines**, not tickets: sending one of three
lines does not unlock the bill.

An order can be **cancelled** whenever it is Open and unpaid. The kitchen deliberately
does not appear in that rule — a guest who walks out has to be recordable at any moment,
and waiting for food nobody will pay for would strand the order open forever.

### 3.2 Where stock moves

Exactly one place: **when a waiter sends lines to the kitchen.** Not at ordering, not at
payment.

- Before sending → balances unchanged. Nothing is taken for food that may never be made.
- On sending → one `Used for cooking` movement per ingredient, carrying the order number.
- Sending a second round → only the new lines deduct. Nothing is counted twice.
- Cancelling afterwards → **no reversal.** Food that was cooked was really consumed. Fix
  the count with a manual **Correction** if it genuinely was not made.
- Short stock never blocks a submission. A service must not stop because a count was
  wrong; the balance goes negative and is flagged as a records problem.

### 3.3 What owns table occupancy

**Orders, and only orders.** There is no control anywhere to set a table busy.

- Opening an order → Occupied.
- Closing or cancelling the **last** open order on it → Available.
- Two parties on one table → still Occupied until both bills are settled.
- **Seating a reservation does not occupy the table.** A booking says a table is intended
  for somebody later; whether it is busy now is decided by whether an order is running.
  Two systems both claiming to know that is how a floor gets double-booked.

---

## 4. Setup order — follow this exactly

Each step depends on the ones above it. Skipping one is what produces an empty screen
that looks like a bug.

### Step 0 · Bring it up

```bash
# database (only when the schema changed, or to start clean)
cd backend
dotnet ef database update --project src/RestaurantManagement.Infrastructure \
                          --startup-project src/RestaurantManagement.Api

# API — Development is REQUIRED or start-up fails with "Jwt:Key is not configured"
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/RestaurantManagement.Api
#   → http://localhost:5080     health at /health   (not /api/health)

# frontend
cd ../frontend && npm run dev
#   → http://localhost:3000
```

**Use one browser profile per role.** The refresh cookie is HttpOnly, shared across tabs
of a profile, and rotated on every refresh — signing in as a chef in a second tab
silently kills the manager session in the first. This will look like random logouts if
you skip it.

### Step 1 · Super Admin

Sign in with the bootstrapped account. **This is the only account that exists on a fresh
database.** Everything else is created by hand — there is no public sign-up.

### Step 2 · Restaurant → Manager

| # | Where | Do | Blocks |
|---|---|---|---|
| 2.1 | `/admin/restaurants` | Create a restaurant (name + slug, slug is unique platform-wide) | everything |
| 2.2 | `/admin/managers` | Add a manager **and assign that restaurant** | everything |

> A restaurant with no manager **cannot trade at all**. `/admin/reports` flags this.
> One restaurant takes exactly one manager; a second is refused.

### Step 3 · Sign in as the manager, set the restaurant up

Do these **in order**. Later steps genuinely cannot happen without earlier ones.

| # | Where | Do | Skip it and… |
|---|---|---|---|
| 3.1 | `/settings` | Set timezone + the hour the service day starts | reports and "today" count against the wrong window |
| 3.2 | `/tables` | Add tables | the waiter sees **"No tables in service"** and cannot order |
| 3.3 | `/menu` | Add a **category first**, then items | the add-item button is disabled: **"Add a category first"** |
| 3.4 | `/staff` | Add Waiters and Chefs | nobody can take an order or cook |
| 3.5 | `/inventory` | Add stock items *(optional)* | nothing deducts; ordering still works fine |
| 3.6 | `/menu` → **Recipe** | Link a dish to its ingredients *(optional)* | that dish deducts nothing when cooked |

> **3.3 is the classic dead end.** Items live inside categories. No category, no items, no
> menu for the waiter.

### Step 4 · Trade one order, all the way

Three profiles: waiter, chef, manager.

| # | Who | Where | Do |
|---|---|---|---|
| 4.1 | Waiter | `/orders/new` | Choose a table → add items → **Place order** |
| 4.2 | Waiter | `/orders/[id]` | **Send N to kitchen** ← *the step everyone misses* |
| 4.3 | Chef | `/kitchen` | **Start preparing** → **Mark ready** |
| 4.4 | Manager | `/billing/[id]` | Choose a method → **Complete & record payment** |
| 4.5 | Manager | `/billing/[id]/receipt` | Receipt exists only now |
| 4.6 | Manager | `/reports`, `/dashboard`, `/floor` | Takings up, table free again |

> **4.2 is not optional and not automatic.** Placing an order records it; sending it is a
> separate action. Until you send it: the kitchen rail is empty, no stock moves, and the
> bill cannot be settled.

### Step 5 · Optional modules

| Module | Needs | Where |
|---|---|---|
| Reservations | at least one **customer** first | `/customers` → `/reservations` |
| Guest QR ordering | a table, **in service**, with ordering **switched on** | `/tables` → Manage → Guest ordering |
| Platform reports/settings | Super Admin | `/admin/reports`, `/admin/settings` |

---

## 5. If it looks broken, check here first

Ordered by how often each one catches people.

| Symptom | Cause | Fix |
|---|---|---|
| **Kitchen screen empty after an order was placed** | Placing ≠ sending. No ticket was raised. | Waiter opens the order → **Send N to kitchen** |
| **Cannot settle a bill** | A line was never sent to the kitchen | Same as above. The billing screen names the count |
| **Stock did not move after ordering** | Correct. Stock leaves at *sending*, not ordering | Send it through |
| **Waiter sees "No tables in service"** | No tables, or all withdrawn | `/tables` |
| **Waiter sees "Nothing on the menu yet"** | No categories, no items, or the category is hidden | `/menu` |
| **Cannot add a menu item** | No category exists | Add a category first |
| **Manager screens say "No restaurant assigned"** | The account owns no restaurant | Super Admin → `/admin/managers` → assign |
| **Random logouts between roles** | One browser profile, rotating refresh cookie | One profile per role |
| **Reports look off by hours** | Timezone / day-start not set for that restaurant | `/settings`, or `/admin/settings` as Super Admin |
| **Reservation seated but table still Available** | Correct. Bookings never set occupancy | Open an order to occupy it |
| **QR link 404s** | Table withdrawn, ordering off, or the token was reissued | `/tables` → Manage → Guest ordering |
| **Guest order not on the kitchen rail** | Correct. Staff must send guest lines too | Waiter opens it → send |
| **API will not start, "Jwt:Key is not configured"** | Not running in Development, so user secrets never load | `ASPNETCORE_ENVIRONMENT=Development` |
| **Cannot delete a customer or stock item** | It has history | Archive it instead |
| **Chef cannot see prices** | By design | — |

---

## 6. Roles and what each one gets

| Role | Sidebar | Cannot |
|---|---|---|
| **Super Admin** | Overview, Restaurants, Managers, Reports, Settings | touch any restaurant's floor: no orders, kitchen, billing or stock |
| **Manager** | Overview, My restaurant, Floor, Billing, Reservations, Customers, Reports, Menu, Inventory, Tables, Staff, Settings | take orders or work the kitchen |
| **Waiter** | Overview, Floor, Orders, New order | see billing, menu setup, staff or reports |
| **Chef** | Overview, Kitchen | see prices, or anything but the rail |

There were three staff roles; **Cashier has been removed** while nothing was built for it.
Billing is the manager's job. `StaffRole` is now Waiter or Chef only, and value 3 is left
unused rather than reassigned.

Enforced by the API on every request, not by hiding links. Typing a URL directly gets a
**403**, not the page.

---

## 7. Where to change what

| To change… | Go to |
|---|---|
| A business rule (what may be cancelled, settled, seated) | `Domain/<Module>/<Entity>.cs` |
| A refusal message | `Application/<Module>/<Module>Errors.cs` |
| A response shape | `Application/<Module>/Dtos/` **and** `frontend/types/<module>.ts` |
| A query or a write | `Infrastructure/<Module>/<Module>Service.cs` |
| A route, status code or role gate | `Api/Controllers/<Module>Controller.cs` |
| Keys, indexes, check constraints | `Infrastructure/Persistence/Configurations/` |
| A screen | `frontend/app/(app)/<route>/page.tsx` |
| A fetch call | `frontend/features/<module>/api.ts` |
| Colours, type scale, dark mode | `frontend/app/globals.css` |
| Sidebar entries | `frontend/components/layout/nav-config.ts` |

**Changing a DTO means changing two files** — the C# record and the matching TypeScript
interface. `apiFetch<T>` is an unchecked cast, so TypeScript will not catch a mismatch;
the contract tests are what do.

After any Domain entity change, add or update the corresponding `builder.Ignore(...)` in
`Persistence/Configurations/` if the new member is derived, or EF will try to make it a
column.

---

## 8. Commands

```bash
# backend
cd backend
dotnet build RestaurantManagement.sln          # compile
dotnet test                                    # 130 tests
dotnet ef migrations add <Name> --project src/RestaurantManagement.Infrastructure \
                                --startup-project src/RestaurantManagement.Api
dotnet ef database update  --project src/RestaurantManagement.Infrastructure \
                           --startup-project src/RestaurantManagement.Api
dotnet ef database drop --force …              # start completely clean

# frontend
cd frontend
npm run dev                                    # http://localhost:3000
npm run build                                  # production build + typecheck
npx tsc --noEmit                               # typecheck only
npx eslint                                     # lint
npm test                                       # unit tests, no backend needed
RMS_SUPERADMIN_EMAIL=… RMS_SUPERADMIN_PASSWORD=… npm run test:contract
                                               # 268 tests against a RUNNING API
```

Contract tests seed their own restaurants through the real endpoints, so they leave data
behind. Drop the database afterwards if you want a clean slate to test in.
