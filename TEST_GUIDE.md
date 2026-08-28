# Manual End-to-End Test Guide

Restaurant Management System — manual verification of the whole product as it stands today.

Every test case below was written against the current implementation: the routes, endpoints, roles, lifecycle rules and screen labels named here all exist. Where the product deliberately does **not** do something, that is stated rather than tested for.

---

## 1. Testing Overview

### 1.1 Purpose

Automated tests already cover a great deal of this system: 130 backend tests (`dotnet test`) and 268 frontend contract tests that talk to a live API. What none of them cover is the browser. **No React component in this project has ever executed in a real browser under test**, and no printed QR code has ever been in front of a camera. This guide exists to cover exactly that gap:

- that every screen renders, loads its data, and shows the right state (loading, empty, error, no-restaurant)
- that buttons appear and disappear according to the server's own eligibility flags
- that a full service — seat, order, cook, pay — works from end to end through the interface
- that a role sees only what it should, and that one restaurant's data never appears in another
- that the printed QR code actually scans

### 1.2 What is covered

| Area | Screens | Covered in |
|---|---|---|
| Platform administration | `/admin/restaurants`, `/admin/managers` | §4 |
| Platform reports and settings | `/admin/reports`, `/admin/settings` | §4 |
| Restaurant profile and settings | `/my-restaurant`, `/settings` | §4 |
| Tables | `/tables` | §4, §12 |
| Menu | `/menu` | §4 |
| Staff | `/staff` | §4 |
| Inventory and recipes | `/inventory`, `/inventory/[id]`, recipe dialog on `/menu` | §5 |
| Waiter ordering | `/orders`, `/orders/new`, `/orders/[id]` | §6 |
| Kitchen rail | `/kitchen` | §6, §7 |
| Billing and cancellation | `/billing`, `/billing/[id]`, `/billing/history` | §8 |
| Receipts and reports | `/billing/[id]/receipt`, `/reports` | §9 |
| Floor and overview | `/floor`, `/dashboard` | §10 |
| Customers | `/customers`, `/customers/[id]` | §11 |
| Reservations | `/reservations` | §12 |
| Guest QR ordering | `/t/{token}` | §13 |
| Roles and isolation | all | §14 |
| Concurrency and edge cases | all | §15 |

### 1.3 What does not exist — do not test for it

These are deliberate absences. A tester who goes looking for them will report bugs that are not bugs:

- No online or card-terminal payment. Payment is a **record** of how money arrived, entered by a manager.
- No refunds, no partial payments, no split bills, no bill merging.
- No tax, discount, service charge or tip anywhere. An order total is the sum of its lines.
- No customer accounts, logins or passwords. Customers are records a manager writes down.
- No email, SMS or push notification of any kind. Nothing is ever sent to a customer's email address.
- No delivery, takeaway or table-service distinction beyond staff vs. QR.
- No loyalty points, deposits, waitlists or table floor plan editor.
- No supplier, purchase order or costing in inventory.
- No pagination anywhere. Lists are bounded server-side instead (100 customers, 200 reservations, 100 orders).
- No CSV/PDF export, no charts, no date-range picker outside `/reports`.
- No multi-branch or multi-restaurant manager. One manager owns exactly one restaurant.
- Currency is never named. Amounts are bare numbers to two decimal places.

### 1.4 Roles that exist

| Role | How it is created | Navigation it gets |
|---|---|---|
| **Super Admin** | Bootstrapped from configuration at API start-up | Overview, Restaurants, Managers, Reports, Settings |
| **Restaurant Manager** | Created by a Super Admin at `/admin/managers`, assigned one restaurant | Overview, My restaurant, Floor, Billing, Reservations, Customers, Reports, Menu, Inventory, Tables, Staff, Settings |
| **Staff · Waiter** | Created by a manager at `/staff` | Overview, Floor, Orders, New order |
| **Staff · Chef** | Created by a manager at `/staff` | Overview, Kitchen |
| **Staff · Cashier** | Created by a manager at `/staff` | Overview only — **nothing is built for this role yet** |
| **User** | Self-registration at `/register` | Overview only |

Role gates are enforced by the API, not by hiding buttons. Anywhere this guide says a role is refused, expect **403** from the API even if a URL is typed directly.

### 1.5 Recommended testing environment

- **One machine.** SQL Server LocalDB, the API, and the frontend all local.
- **A fresh database, or at least a fresh restaurant.** See §3.
- **A separate browser profile (or private window) per role.** This matters: the refresh token lives in an HttpOnly cookie that is *rotated on every refresh*, and it is shared across tabs of the same profile. Signing in as a chef in a second tab will silently invalidate the waiter session in the first. Use Chrome profiles, Firefox containers, or one private window per role.
- **A real phone** for the QR tests in §13, on the same network as the dev server. `localhost` will not resolve from a phone — see TC-QR-08.
- Browser devtools open on the Network tab throughout. Several expectations below are about the *status code*, not the message.

### 1.6 Bringing the system up

```bash
# 1. Database — apply migrations
cd backend
dotnet ef database update --project src/RestaurantManagement.Infrastructure --startup-project src/RestaurantManagement.Api

# 2. API — Development is required, or user secrets do not load and start-up fails
#    with "Jwt:Key is not configured"
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/RestaurantManagement.Api
#    -> http://localhost:5080   health check at http://localhost:5080/health  (not /api/health)

# 3. Frontend
cd ../frontend
npm run dev
#    -> http://localhost:3000   talks to NEXT_PUBLIC_API_URL, default http://localhost:5080
```

Required configuration (user secrets or environment, never committed):

| Key | Purpose |
|---|---|
| `ConnectionStrings:DefaultConnection` | LocalDB connection string |
| `Jwt:Key` | At least 32 bytes. Start-up fails loudly without it. |
| `Bootstrap:SuperAdmin:Email` | The only account that can create restaurants |
| `Bootstrap:SuperAdmin:Password` | — |

**Before starting**, confirm the automated suites are green so a manual failure is a real finding and not a known break:

```bash
cd backend  && dotnet test                 # expect 130 passed
cd frontend && npm test                    # expect 20 passed
cd frontend && RMS_SUPERADMIN_EMAIL=… RMS_SUPERADMIN_PASSWORD=… npm run test:contract
                                           # expect 268 passed, API must be running
```

### 1.7 How to record results

Each test case ends with a line to fill in:

> **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

Mark **Fail** for anything that does not match the expectation exactly, including a wrong HTTP status behind a right-looking screen. Record the order number, table name and timestamp in Notes — most failures in this system are only reproducible with the exact record.

---

## 2. Required Test Accounts — Checklist

Create these before starting. §4 walks through creating all of them; this is the shopping list.

| ☐ | Account | Role | Belongs to | Used for |
|---|---|---|---|---|
| ☐ | `superadmin@localhost` | Super Admin | platform | §4, §14 |
| ☐ | `manager.a@test.local` | Restaurant Manager | **Restaurant A** | most of the guide |
| ☐ | `waiter.a@test.local` | Staff · Waiter | Restaurant A | §6, §7, §13 |
| ☐ | `chef.a@test.local` | Staff · Chef | Restaurant A | §6, §7 |
| ☐ | `cashier.a@test.local` | Staff · Cashier | Restaurant A | §14 (has no screens) |
| ☐ | `manager.b@test.local` | Restaurant Manager | **Restaurant B** | §14 isolation |
| ☐ | `waiter.b@test.local` | Staff · Waiter | Restaurant B | §14 isolation |
| ☐ | `unassigned@test.local` | Restaurant Manager | **no restaurant** | §14 empty-state tests |
| ☐ | `plain@test.local` | User (self-registered) | none | §14 |

Use one password for all seeded accounts, e.g. `Manual-Test-Pass-1`. Two restaurants are **not optional** — a third of the security expectations in this guide cannot be checked with one.

---

## 3. Preparing a Clean Test Restaurant

Isolation in this product is by restaurant, so the cleanest reset is a **new restaurant**, not a wiped database. Prefer that.

**Option A — new restaurant (recommended, non-destructive).** Follow §4 with a fresh name and slug. Slugs are unique platform-wide; suffix them with a date, e.g. `manual-a-0825`. Nothing you do inside it can touch existing data.

**Option B — full reset (destructive, local only).**

```bash
cd backend
dotnet ef database drop --force --project src/RestaurantManagement.Infrastructure --startup-project src/RestaurantManagement.Api
dotnet ef database update --project src/RestaurantManagement.Infrastructure --startup-project src/RestaurantManagement.Api
```

The super admin is re-bootstrapped at the next API start. Everything else is gone.

> **Do not modify records directly in SQL to set up a test.** Half the rules in this system are enforced by the write path — order numbering, table occupancy, stock ledger balances, the one-payment-per-order index — and a hand-written row produces states the application cannot produce, which then read as bugs. Every precondition in this guide is reachable through the interface.

**What "clean" looks like for Restaurant A**, and what the rest of the guide assumes:

| ☐ | Item | Value |
|---|---|---|
| ☐ | Tables | `T1` (4 seats), `T2` (2 seats), `T3` (6 seats) |
| ☐ | Menu categories | `Starters` (position 1), `Mains` (position 2), `Drinks` (position 3) |
| ☐ | Menu items | Starters: `Soup` 4.50 · Mains: `Burger` 12.50, `Curry` 11.00 · Drinks: `Cola` 2.50, `Water` 1.50 |
| ☐ | Staff | one waiter, one chef, one cashier |
| ☐ | Inventory | `Beef patty` (Piece), `Rice` (Kilogram), `Cola syrup` (Millilitre) |
| ☐ | Recipes | `Burger` → 1 Piece beef patty · `Curry` → 200 Gram rice |
| ☐ | Settings | Timezone and day-start hour set deliberately, not left at default |

---

## 4. Initial Restaurant Setup

#### TC-SETUP-01 · Super Admin signs in

- **Feature** — Authentication, platform administrator
- **Preconditions** — API answering on `/health`; frontend running; `Bootstrap:SuperAdmin` credentials to hand
- **Steps**
  1. Open `http://localhost:3000` in a clean browser profile.
  2. You should be redirected to `/login`. Sign in with the super admin email and password.
- **Expected** — Landed on `/dashboard`. Sidebar shows **Overview, Restaurants, Managers** and, under a Platform heading, **Reports** and **Settings** — every one a working link. No Floor, Billing, Menu, Tables, Kitchen or Staff entry anywhere, and no disabled placeholder rows.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-02 · Rejected sign-in reveals nothing

- **Feature** — Authentication, negative
- **Preconditions** — signed out
- **Steps**
  1. Sign in with the super admin email and a wrong password.
  2. Sign in with an email that does not exist at all.
- **Expected** — Both fail with the **same** message. Neither says whether the account exists. Network tab shows 401 for both. No token is stored — check Application → Local Storage and Session Storage are empty of anything token-shaped.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-03 · Create Restaurant A

- **Feature** — Restaurants, create
- **Preconditions** — TC-SETUP-01 passed
- **Steps**
  1. Go to `/admin/restaurants` and start a new restaurant.
  2. Name `Manual Test A`, slug `manual-a-<today>`. Save.
- **Expected** — Restaurant appears in the list with no manager assigned. Response is **201**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-04 · Duplicate slug is refused

- **Feature** — Restaurants, uniqueness
- **Preconditions** — TC-SETUP-03 passed
- **Steps**
  1. Create a second restaurant with a different name but the **same slug**.
- **Expected** — Refused with a readable message naming the slug. **409**. No second restaurant created.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-05 · Create Restaurant B

- **Feature** — Restaurants, create
- **Preconditions** — TC-SETUP-03 passed
- **Steps**
  1. Create `Manual Test B`, slug `manual-b-<today>`.
- **Expected** — Two restaurants in the list. Needed for every isolation test in §14.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-06 · Create and assign a manager

- **Feature** — Managers, create with assignment
- **Preconditions** — TC-SETUP-03 passed
- **Steps**
  1. Go to `/admin/managers` and add a manager: full name, email `manager.a@test.local`, password, restaurant **Manual Test A**.
  2. Repeat for `manager.b@test.local` → **Manual Test B**.
  3. Add `unassigned@test.local` with **no restaurant** if the form allows it; otherwise create them and leave them unassigned, or unassign them afterwards.
- **Expected** — Each manager appears with their restaurant beside them. The unassigned one shows as having none. **201** each.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-07 · One restaurant cannot have two managers

- **Feature** — Managers, assignment uniqueness
- **Preconditions** — TC-SETUP-06 passed
- **Steps**
  1. Create another manager and try to assign them to **Manual Test A**.
- **Expected** — Refused, **409**, with a message saying the restaurant already has a manager. Restaurant A still belongs to `manager.a`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-08 · Manager signs in and sees their own restaurant

- **Feature** — Authentication and restaurant resolution
- **Preconditions** — TC-SETUP-06 passed. **Use a different browser profile from the super admin.**
- **Steps**
  1. Sign in as `manager.a@test.local`.
  2. Open `/my-restaurant`.
- **Expected** — Sidebar shows the full manager set: Overview, My restaurant, Floor, Billing, Reservations, Customers, Reports, Menu, Inventory, Tables, Staff, Settings. `/my-restaurant` shows **Manual Test A**, its slug, and the manager's own name under Manager. No restaurant picker anywhere — a manager has exactly one.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-08b · The platform screens answer on an empty estate

- **Feature** — `/admin/reports` and `/admin/settings`
- **Preconditions** — signed in as the super admin on a database with no restaurants yet
- **Steps**
  1. Open `/admin/settings`. Read every counter and the operational configuration table.
  2. Open `/admin/reports` with no dates set.
- **Expected** — Both answer rather than failing. Settings shows zeros, an empty-state panel where the restaurant table would be, this account, and the server clock. Reports shows zero collected, **average bill 0 rather than `NaN`**, and all three payment methods still listed at zero so the shape does not change with the data.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-11b · The platform admin corrects a restaurant timezone

- **Feature** — `/admin/settings`, operational configuration
- **Preconditions** — at least one restaurant exists, ideally one with no manager assigned yet
- **Steps**
  1. On `/admin/settings`, find the restaurant and press **Configure**.
  2. Change the timezone and set the service day to start at 06:00. Save.
  3. Re-read its row: timezone, offset, day-starts and **Current day began**.
  4. Sign in as that restaurant manager and open their own `/settings`.
  5. Back as super admin, try to save an unknown zone by editing the request, and an hour of 24.
- **Expected** — The save takes effect and the row shows the new zone, its offset and a recomputed service-day boundary. **The manager own settings screen shows exactly the same values** — there is one setting, reachable from two places, not two copies. An unknown zone is refused (**400**) rather than stored, and the hour must be **0–23**. A restaurant with no manager is flagged in the dialog as having nobody else who could fix it.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-09 · A manager with no restaurant gets a calm empty state, not an error

- **Feature** — Missing-restaurant state
- **Preconditions** — `unassigned@test.local` exists and owns nothing
- **Steps**
  1. Sign in as the unassigned manager in a clean profile.
  2. Visit each of: `/dashboard`, `/customers`, `/reservations`, `/inventory`, `/reports`, `/settings`, `/floor`, `/billing`, `/menu`, `/tables`, `/staff`.
- **Expected** — On `/customers`, `/reservations`, `/inventory` and `/reports` you should see the **"No restaurant assigned"** panel: a calm explanation with **no red error styling and no Retry button**. The API returns 404 on these routes for this account, which is the correct signal.
- **Known gap** — several older manager screens still frame this as a red error with a Retry button that can never help. Record which screens do that in Notes; it is a known cosmetic defect, not a new one.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-10 · Edit restaurant profile

- **Feature** — Restaurant profile
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. On `/my-restaurant`, set contact email, contact phone, address, city, country. Save.
  2. Reload the page.
- **Expected** — Values persisted. **Last updated** has moved. Restaurant ID and Slug are shown but not editable here.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-11 · Timezone and operational settings

- **Feature** — Operational settings, `/settings`
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. Open `/settings`. Note the current **Timezone** and **A service day starts at**.
  2. Change the timezone to one clearly offset from your own machine, e.g. `Asia/Kolkata` or `America/New_York`.
  3. Set the service day to start at **06:00**. Save.
  4. Read the **In effect now** panel.
- **Expected** — Save succeeds. **In effect now** shows the chosen timezone, its offset from UTC, the day-start hour, and **Current day began** as a real instant consistent with both. The timezone dropdown only offers zones the server will accept.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-12 · Day-start hour is bounded

- **Feature** — Operational settings, validation
- **Preconditions** — TC-SETUP-11
- **Steps**
  1. Try to set the service day start to `24`, then to `-1`.
- **Expected** — Both refused. Valid range is **0 to 23**. Existing setting unchanged.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-13 · Create tables

- **Feature** — Tables, create
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. On `/tables`, add `T1` / 4 seats, `T2` / 2 seats, `T3` / 6 seats.
- **Expected** — Three rows. Each shows **In service**, status not settable by hand, **Self-service: Off**, and an **Added** date. Header counts read "3 tables" and total seats in service.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-14 · Table name is unique within the restaurant, capacity is bounded

- **Feature** — Tables, validation
- **Preconditions** — TC-SETUP-13 passed
- **Steps**
  1. Try to add a second table called `T1`.
  2. Try to add a table with 0 seats, then with 500 seats.
  3. Try a name longer than 32 characters.
- **Expected** — Duplicate name refused (**409**). Capacity must be **1–100**. Name capped at **32 characters**. In every case nothing is created.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-15 · Take a table out of service and back

- **Feature** — Tables, in-service status
- **Preconditions** — TC-SETUP-13 passed
- **Steps**
  1. Open **Manage** on `T3`, take it out of service, close the dialog.
  2. Sign in as the waiter in another profile and open `/orders/new`.
  3. Return as manager and put `T3` back into service.
- **Expected** — `T3` shows **Out of service** and is **not offered** to the waiter. Nothing is deleted. After restoring, it is offered again. Occupancy (`status`) is untouched by this — in service and occupied are separate ideas.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-16 · Create menu categories

- **Feature** — Menu categories
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. On `/menu`, add `Starters` with **Menu position** 1, `Mains` 2, `Drinks` 3.
  2. Try adding a second `Mains`.
- **Expected** — Three categories, ordered by position (lower first). Duplicate name refused. The page notes that items live inside a category.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-17 · Items cannot exist without a category

- **Feature** — Menu items, precondition
- **Preconditions** — a restaurant with **no** categories (use Restaurant B before setting it up)
- **Steps**
  1. Sign in as `manager.b`, open `/menu`, and try to add an item.
- **Expected** — The add-item action is unavailable and the screen says **"Add a category first"**. It does not offer a form that would fail on submit.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-18 · Create menu items

- **Feature** — Menu items
- **Preconditions** — TC-SETUP-16 passed
- **Steps**
  1. Add `Soup` 4.50 in Starters; `Burger` 12.50 and `Curry` 11.00 in Mains; `Cola` 2.50 and `Water` 1.50 in Drinks.
  2. Give `Burger` a description.
  3. Use **Filter by category** to show only Mains.
- **Expected** — Five items, each under its category with its price. Description shown where given. Filter narrows the list correctly.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-19 · Hide an item, then a whole category

- **Feature** — Menu availability
- **Preconditions** — TC-SETUP-18 passed; waiter signed in elsewhere
- **Steps**
  1. **Hide from menu** on `Water`. Refresh the waiter's `/orders/new`.
  2. Hide the whole `Drinks` category. Refresh the waiter's menu again.
  3. **Show on menu** for both.
- **Expected** — Hiding the item removes only it. Hiding the category removes **every item in it**, `Cola` included, and the category heading disappears from the waiter menu entirely. Nothing is deleted; restoring brings both back. Prices and names are unchanged by the round trip.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-20 · Create staff accounts

- **Feature** — Staff
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. On `/staff`, add a **Waiter** (`waiter.a@test.local`), a **Chef** (`chef.a@test.local`) and a **Cashier** (`cashier.a@test.local`), each with an initial password.
  2. Try adding a second person with the waiter's email.
  3. Use **Search staff** to find the chef by name and by email.
- **Expected** — Three staff rows with their roles. Duplicate email refused. Search matches name and email. The **Initial password** is never shown again after creation and never appears in any response — check the Network tab for the create call: no password or hash in the body.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-21 · Staff sign in and get the right workspace

- **Feature** — Role-based navigation
- **Preconditions** — TC-SETUP-20 passed. **One browser profile each.**
- **Steps**
  1. Sign in as the waiter. Note the sidebar.
  2. Sign in as the chef in another profile. Note the sidebar.
  3. Sign in as the cashier in a third profile.
- **Expected** — Waiter: **Overview, Floor, Orders, New order**. Chef: **Overview, Kitchen**. Cashier: **Overview only**, with no disabled placeholder rows — nothing is built for a cashier and nothing pretends otherwise.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-22 · Deactivating staff ends the shift immediately

- **Feature** — Staff status and session invalidation
- **Preconditions** — waiter signed in and on `/orders`
- **Steps**
  1. As manager, **Deactivate** the waiter on `/staff`.
  2. In the waiter's window, refresh or navigate to `/orders/new`.
  3. Try to sign in as the waiter again from a clean profile.
  4. Reactivate the waiter and confirm they can work again.
- **Expected** — The waiter is stopped **without waiting for the token to expire**: the waiter routes return 403 and the interface stops offering them. A fresh sign-in is also refused while deactivated. Reactivating restores access. The staff record is never deleted.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SETUP-23 · Self-registration produces a powerless account

- **Feature** — Public registration
- **Preconditions** — signed out
- **Steps**
  1. Register at `/register` as `plain@test.local`.
  2. Note the sidebar. Then type `/menu`, `/tables` and `/kitchen` into the address bar.
- **Expected** — Signed in, but the role is **User**: sidebar shows Overview only. Every manager and staff route is refused (**403**), not merely hidden. Registration cannot choose a role — confirm the request body has no role field.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 5. Inventory and Recipes

Two things to hold in mind throughout this section:

- **Stock is never edited directly.** Every change is a *movement* that says why, and the item's balance is the running total. The manager can enter three kinds — **Delivery**, **Correction**, **Written off** — and the system writes two more: **Opening balance** when an item is created, and **Used for cooking** when a waiter sends food to the kitchen.
- **Units convert only inside a family.** Piece is `Count`; Gram and Kilogram are `Mass`; Millilitre and Litre are `Volume`. Grams of a liquid would need a density this product does not store.

#### TC-INV-01 · Create inventory items with an opening balance

- **Feature** — Inventory, create
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. On `/inventory`, add `Beef patty`, unit **Piece**, quantity in stock 40, warn below 10.
  2. Add `Rice`, unit **Kilogram**, quantity 25, warn below 5.
  3. Add `Cola syrup`, unit **Millilitre**, quantity 5000, warn below 1000.
  4. Open `/inventory/<Beef patty>` and read the History panel.
- **Expected** — Three items with their balances and units (`pc`, `kg`, `ml`). Each item's history contains exactly one movement: **Opening balance**, recorded by the manager, with the balance after it. The opening figure was never typed as a "movement" — it came from the create form and the system wrote the entry.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-02 · The unit cannot be changed after creation

- **Feature** — Inventory, edit
- **Preconditions** — TC-INV-01 passed
- **Steps**
  1. Edit `Rice`. Look for a unit field.
- **Expected** — Name and **Warn below** are editable; the **unit is not offered at all**. Changing it would silently reinterpret every quantity already recorded. To change a unit, archive the item and create a new one.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-03 · Record a delivery

- **Feature** — Stock movement, `Received`
- **Preconditions** — TC-INV-01 passed
- **Steps**
  1. On `/inventory/<Rice>`, use **Move stock**: What happened = **Delivery**, quantity 10.
  2. Read the balance and the new history entry.
- **Expected** — Balance 25 → **35 kg**. History gains a **Delivery** of `+10` with **balance after 35**, the manager's name, and a timestamp. Movement count increments. A reason is optional for a delivery.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-04 · A correction needs a direction and a reason

- **Feature** — Stock movement, `Adjusted`
- **Preconditions** — TC-INV-03 passed
- **Steps**
  1. Choose **Correction**, quantity 3, and try to save with the **Why** field empty.
  2. Fill in "Stocktake found three fewer", set the direction to **decrease**, save.
- **Expected** — The empty save is refused with a message asking why. Once given, the balance drops by 3 and history shows a **Correction** of `-3` **carrying that reason**. A correction offers a direction choice; a delivery does not.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-05 · A write-off also needs a reason

- **Feature** — Stock movement, `Wasted`
- **Preconditions** — TC-INV-01 passed
- **Steps**
  1. On `Beef patty`, choose **Written off**, quantity 2, save with no reason.
  2. Then with reason "Dropped".
- **Expected** — First refused, second succeeds. Balance falls by 2. History shows **Written off** `-2` with the reason. A write-off is always outward — there is no "un-waste".
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-06 · Consumption cannot be entered by hand

- **Feature** — Stock movement, restricted kinds
- **Preconditions** — TC-INV-01 passed
- **Steps**
  1. Open the **What happened** dropdown on any item.
- **Expected** — Only **Delivery**, **Correction** and **Written off** are offered. **Used for cooking** and **Opening balance** are absent: the first is written when a kitchen ticket is raised, the second at creation, and offering either here would let the same stock be counted twice.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-07 · Low stock is flagged

- **Feature** — Low stock warning
- **Preconditions** — `Beef patty` warn-below is 10
- **Steps**
  1. Write off or correct `Beef patty` down to **8**.
  2. Return to `/inventory`.
- **Expected** — The row is marked as low, and the page header shows a **low** count. The item is still fully orderable — a low warning is information, not a block.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-08 · Zero stock is a distinct state

- **Feature** — Out of stock
- **Preconditions** — TC-INV-07
- **Steps**
  1. Bring `Beef patty` to exactly **0**.
- **Expected** — Marked **out of stock** and counted in the header's out-of-stock figure, separately from low stock. Still no block on ordering.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-09 · Negative stock is shown as a records problem, not an empty shelf

- **Feature** — Negative balance
- **Preconditions** — `Beef patty` at 0; `Burger` has a recipe using 1 patty (do TC-REC-01 first)
- **Steps**
  1. As the waiter, place an order for 2 × `Burger` on `T2` and send it to the kitchen.
  2. As manager, look at `/inventory` and then at the patty's history.
- **Expected** — Balance is **−2**, and the interface presents this as its **own state — a data problem — distinct from being merely empty**, with a negative count in the header. History shows a **Used for cooking** entry of `-2` **linked to the order number**. Crucially, the kitchen submission **was not blocked**: a service must not stop because a count was wrong.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-10 · The ledger is append-only and readable

- **Feature** — Inventory history
- **Preconditions** — TC-INV-03 … TC-INV-09 done on the same item
- **Steps**
  1. Read the full history of `Beef patty` top to bottom.
- **Expected** — Every movement from the opening balance onward is present, newest first, each with its kind, signed amount, **balance after**, who recorded it, when, and — for cooking — which order caused it. **No entry can be edited or deleted anywhere in the interface.** The balances form an unbroken chain: each `balance after` equals the previous one plus the delta.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-11 · Archive and restore

- **Feature** — Inventory, active status
- **Preconditions** — TC-INV-01 passed
- **Steps**
  1. Archive `Cola syrup`. Note it leaves the default list.
  2. Tick the archived filter and confirm it is still there with its history.
  3. Restore it.
- **Expected** — Archiving hides without deleting; history survives; restoring returns it to the list unchanged.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-INV-12 · An item with history cannot be deleted

- **Feature** — Inventory, delete guard
- **Preconditions** — `Rice` has several movements
- **Steps**
  1. Try to delete `Rice`.
  2. Create a throwaway item `Test salt` with **0** opening quantity and no movements, and delete that.
- **Expected** — `Rice` is refused (**409**) with a message pointing to its history and suggesting archiving instead. `Test salt` deletes cleanly (**204**). Deletion exists only for rows created by mistake.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-01 · Create a recipe

- **Feature** — Recipes
- **Preconditions** — TC-INV-01 and TC-SETUP-18 passed
- **Steps**
  1. On `/menu`, use the **Recipe** action on `Burger`.
  2. Add `Beef patty` 1 **Piece**. Save.
  3. Reopen the recipe.
- **Expected** — Saved and reloaded with the one line. The dialog also reports **portions available** — how many burgers the current stock could make. `/inventory` now shows `Beef patty` as used in 1 recipe.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-02 · Unit conversion within a family

- **Feature** — Recipes, unit conversion
- **Preconditions** — `Rice` stocked in **Kilogram**
- **Steps**
  1. Open the recipe for `Curry` and add `Rice` **200 Gram**. Save.
  2. Note the portions-available figure against the kilogram balance.
- **Expected** — Accepted. A gram quantity against a kilogram stock converts by an exact factor of 1000, so nothing rounds. With 35 kg of rice, portions available should read **175**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-03 · Cross-family units are not even offered

- **Feature** — Recipes, incompatible units
- **Preconditions** — TC-REC-02
- **Steps**
  1. In the `Curry` recipe, look at the unit choices for the `Rice` line.
- **Expected** — Only **Gram** and **Kilogram** are offered — the same family as the stock unit. Piece, Millilitre and Litre are not selectable, so an impossible recipe cannot be typed in the first place. (The server refuses it too, but the point is that the editor does not let you get there.)
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-04 · The same ingredient cannot appear twice

- **Feature** — Recipes, validation
- **Preconditions** — TC-REC-01
- **Steps**
  1. In the `Burger` recipe, add `Beef patty` a second time and save.
- **Expected** — Refused with a message naming the duplicate. One line per ingredient; change the quantity instead.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-05 · Saving a recipe replaces it wholesale

- **Feature** — Recipes, replacement semantics
- **Preconditions** — `Burger` recipe has one line
- **Steps**
  1. Open the `Burger` recipe, add a second ingredient, save.
  2. Reopen it, **remove both lines**, save.
  3. Reopen it once more.
- **Expected** — After step 2 the recipe is **empty** — the lines on screen become the recipe, so removing them removes them. No partial state at any point. An item with no recipe deducts nothing when cooked.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-06 · An ingredient used in a recipe cannot be deleted

- **Feature** — Inventory delete guard, recipe reference
- **Preconditions** — `Beef patty` is in the `Burger` recipe
- **Steps**
  1. Try to delete `Beef patty` from `/inventory`.
- **Expected** — Refused (**409**) with a message saying **how many recipes** name it. Archive instead.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-07 · Recipes and inventory are isolated between restaurants

- **Feature** — Isolation
- **Preconditions** — Restaurant B set up with its own category, item and at least one inventory item
- **Steps**
  1. As `manager.b`, open `/inventory` and the recipe editor for a Restaurant B menu item.
  2. Look at the ingredient dropdown.
- **Expected** — Only Restaurant B's own inventory items appear. Nothing from Restaurant A is listed or selectable, and no count of A's items leaks into B's header figures.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-08 · Stock moves at kitchen submission, not at ordering

- **Feature** — Stock deduction timing — **the most important case in this section**
- **Preconditions** — `Beef patty` at a known balance, e.g. 40; `Burger` recipe = 1 patty
- **Steps**
  1. Note the exact patty balance.
  2. As the waiter, open an order on `T1` with 3 × `Burger`. **Do not send it to the kitchen.**
  3. As manager, check the patty balance.
  4. As the waiter, **Send 3 to kitchen**.
  5. Check the balance again, and the patty's history.
- **Expected** — After step 3 the balance is **unchanged**: nothing has been taken for food that might never be cooked. After step 5 it has fallen by **3**, with one **Used for cooking** movement carrying the order number. The deduction and the kitchen ticket appear together — there is no window in which one exists without the other.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-09 · A second submission on the same order deducts only the new lines

- **Feature** — Stock deduction, incremental
- **Preconditions** — TC-REC-08 done, order still open
- **Steps**
  1. Add 1 more `Burger` to the same order and save.
  2. Note the patty balance, then **Send 1 to kitchen**.
  3. Check the balance and history.
- **Expected** — Exactly **1** more patty is taken, not 4. Lines already with the kitchen are not deducted twice. History shows a second **Used for cooking** entry against the same order number.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-REC-10 · Cancelling an order does not return stock

- **Feature** — Stock and cancellation
- **Preconditions** — an order with food already sent to the kitchen
- **Steps**
  1. Note the ingredient balance.
  2. As manager, cancel that order from `/billing/<id>` with a reason.
  3. Check the balance and history.
- **Expected** — The balance is **unchanged** and **no reversing movement is written**. Food that was cooked was really consumed; the ledger records what happened, not what was billed. Correct the count by hand with a **Correction** if the food was genuinely not made.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 6. Normal Waiter Order Workflow

The full happy path, in order. Run it as one continuous scenario in one sitting — TC-FLOW-02 onward each depend on the last.

```text
Free table
  → open order            (waiter · /orders/new)          TC-FLOW-02
  → add items             (waiter · /orders/[id])         TC-FLOW-04
  → edit items            (waiter)                        TC-FLOW-05
  → add notes             (waiter)                        TC-FLOW-06
  → submit kitchen ticket (waiter)                        TC-FLOW-07
  → chef starts           (chef · /kitchen)               TC-FLOW-09
  → chef marks ready      (chef)                          TC-FLOW-10
  → payment               (manager · /billing/[id])       TC-FLOW-12
  → order completed       (server)                        TC-FLOW-12
  → table released        (server)                        TC-FLOW-13
  → receipt available     (manager · …/receipt)           TC-FLOW-14
  → report updated        (manager · /reports)            TC-FLOW-15
```

Have three browser profiles open: **waiter**, **chef**, **manager**.

#### TC-FLOW-01 · The table starts free

- **Feature** — Floor, initial state
- **Preconditions** — `T1` in service with no open order
- **Steps**
  1. As manager, open `/floor`. Find `T1`.
- **Expected** — `T1` is **available**, with no open order, zero open value, and no seated-since time. The header counts show it among the available tables.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-02 · Waiter opens an order

- **Feature** — Order creation
- **Preconditions** — signed in as `waiter.a`
- **Steps**
  1. Open `/orders/new`. Note that the screen asks you to **choose a table first**.
  2. Choose `T1`.
  3. Add 1 × `Burger` and 2 × `Cola`. Watch the running **Total**.
  4. **Place order**.
- **Expected** — Before a table is chosen, the item list is not usable and the screen says so. The running total is **17.50** (12.50 + 2 × 2.50) — computed from the menu, not typed. On placing, you land on the order's own page with a **sequential order number** (not a GUID) and status Open.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-03 · Placing an order occupies the table

- **Feature** — Table occupancy
- **Preconditions** — TC-FLOW-02 passed
- **Steps**
  1. As manager, refresh `/floor` and `/tables`.
- **Expected** — `T1` is now **Occupied**, showing the order, its value and a **seated since** time. On `/tables` the Status column reads Occupied — and there is still **no control anywhere to set it by hand**. Occupancy is a consequence of an order existing.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-04 · Add items to the open order

- **Feature** — Order editing, additions
- **Preconditions** — order open, nothing sent to the kitchen
- **Steps**
  1. On `/orders/[id]`, add 1 × `Soup`.
  2. Note the **Unsaved changes** indicator, then **Save changes**.
- **Expected** — The screen marks the order dirty before saving and shows **Up to date** afterwards. Total becomes **22.00**. Item count reflects 4 units. The saved line carries the price from the menu at that moment.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-05 · Edit and remove items

- **Feature** — Order editing, quantities and removal
- **Preconditions** — TC-FLOW-04 passed
- **Steps**
  1. Change `Cola` from 2 to 3. Save.
  2. Remove the `Soup` line entirely. Save.
- **Expected** — Total tracks each change (24.50, then 20.00). A removed line disappears from the order. Nothing on screen offers to edit an item's **name or price** — a line keeps the snapshot taken when it was created, and swapping one dish for another means removing the line and adding the other item.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-06 · Add a guest note to a line

- **Feature** — Order line notes
- **Preconditions** — TC-FLOW-05 passed
- **Steps**
  1. Put "No ice" on the `Cola` line (the field is prompted with *No ice, extra spicy…*). Save.
  2. Add a second `Cola` line **without** a note and save.
- **Expected** — Both saved. The two `Cola` entries stay as **separate lines**, because the note is what distinguishes one from another — identical items with identical notes fold together, differing notes do not. Notes are capped at 200 characters.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-07 · Send the order to the kitchen

- **Feature** — Kitchen ticket submission (KOT)
- **Preconditions** — order saved with everything still unsent
- **Steps**
  1. Read the button label — it should say **Send N to kitchen** with the real unit count.
  2. Press it.
- **Expected** — **One** kitchen ticket is created for everything unsent — not one per item. It gets a **sequential ticket number** for the restaurant. The Items panel now marks those lines **Sent to the kitchen**, showing `KOT #<n>` against each, and they are no longer editable. The Kitchen panel lists the ticket with its lines. The send button becomes unavailable and the screen says **Everything is with the kitchen**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-08 · Unsaved changes cannot be sent

- **Feature** — Submission guard
- **Preconditions** — order open with at least one unsent line
- **Steps**
  1. Add an item but **do not save**. Try to send to the kitchen.
- **Expected** — Refused, with a message telling you to save first **so the kitchen receives what is actually on the order**. Nothing reaches the kitchen.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-09 · Chef starts preparation

- **Feature** — Kitchen rail, `Pending → Preparing`
- **Preconditions** — TC-FLOW-07 passed; signed in as `chef.a`
- **Steps**
  1. Open `/kitchen`. Find the ticket under **Waiting**.
  2. Press **Start preparing**.
- **Expected** — The ticket moves to **On the stove**, and cooking tickets are listed **before** waiting ones. The card shows the table, the ticket number, and each line with its quantity and note — as the kitchen was told it, from the ticket's own snapshot. The chef sees no prices anywhere.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-10 · Chef marks ready

- **Feature** — Kitchen rail, `Preparing → Ready`
- **Preconditions** — TC-FLOW-09 passed
- **Steps**
  1. Press **Mark ready** on the ticket.
  2. Refresh `/kitchen`.
- **Expected** — The ticket **leaves the rail** — the rail shows live work only. With nothing else outstanding the screen reads **Nothing on the rail**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-11 · The order is not settleable until the kitchen is finished

- **Feature** — Billing eligibility
- **Preconditions** — an order with a ticket still Pending or Preparing
- **Steps**
  1. Raise a second small order on `T2` and send it to the kitchen. Leave the ticket **Waiting**.
  2. As manager, open `/billing` and then that order.
- **Expected** — The order appears in the queue but is **not actionable**: the take-payment control is unavailable and the screen says the kitchen is not ready. Attempting the payment endpoint directly returns **409**. The screen shows the counts behind the decision, so the reason is visible without guessing.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-12 · Manager records payment and closes the order

- **Feature** — Payment and order completion
- **Preconditions** — TC-FLOW-10 passed; signed in as `manager.a`
- **Steps**
  1. Open `/billing` — the `T1` order should show as ready. Open it.
  2. Read **Amount due**. Confirm the screen says **Everything is ready**.
  3. Choose **Cash** and press **Complete & record payment**.
- **Expected** — Amount due equals the order total exactly. Confirmation reads **Payment recorded and order closed**. The order is now **Completed** and locked — the waiter's page for it shows **This order is locked** with no editable lines. Only **Cash, Card, Digital** are offered; there is no amount field anywhere, because the amount comes from the server's own total and is never accepted from the client.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-13 · Closing the order releases the table

- **Feature** — Table release
- **Preconditions** — TC-FLOW-12 passed
- **Steps**
  1. Refresh `/floor`.
- **Expected** — `T1` is **available** again, with no open order and no open value. It went from Occupied to Available without anyone setting it.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-14 · The receipt is available

- **Feature** — Receipts
- **Preconditions** — TC-FLOW-12 passed
- **Steps**
  1. From `/billing/<id>`, open the receipt.
  2. Compare every line, the total, the method and the timestamp against the order.
  3. Print-preview it (Ctrl/Cmd-P).
- **Expected** — The receipt shows the restaurant, the table, the order number, every line with its recorded price, the total, how it was paid and when. Every figure matches the order. Print preview is clean — no sidebar, no navigation.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-15 · The report picks it up

- **Feature** — Reports
- **Preconditions** — TC-FLOW-12 passed
- **Steps**
  1. Open `/reports` with a range covering today.
- **Expected** — **Collected** has increased by the payment, **Orders closed** by one, the **Cash** row of "How it was paid" by one and by the amount, and the order appears in the **Completed** list with its number, table, amount and method. **Average bill** = collected ÷ payment count.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-FLOW-16 · The dashboard reflects the whole shift

- **Feature** — Manager overview
- **Preconditions** — §6 complete
- **Steps**
  1. Open `/dashboard` and read every panel.
- **Expected** — Open orders, ready-to-settle count, open value, floor counts and kitchen load all agree with `/floor`, `/billing` and `/kitchen`. Today's takings agree with `/reports` for today. The activity feed lists **Order opened, Sent to kitchen, Cooking started, Ready at the pass, Paid and closed** for this order, newest first, with the right table and order number on each.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 7. Kitchen Workflow — Further Cases

#### TC-KOT-01 · A second round becomes a second ticket

- **Feature** — Multiple tickets per order
- **Preconditions** — an open order with one ticket already Ready (drinks sent first)
- **Steps**
  1. As waiter, add a main course to that order and save.
  2. Send it to the kitchen.
  3. As chef, work the new ticket through Start and Ready.
- **Expected** — A **second** ticket with the next sequential number, carrying only the new lines. The order's Kitchen panel lists both tickets, newest first, as read-only history. The first ticket's status is untouched.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-02 · Nothing to send

- **Feature** — Submission guard
- **Preconditions** — an order with everything already sent
- **Steps**
  1. Press the send control.
- **Expected** — Unavailable, labelled **Nothing to send**, and the Items panel says all items have been sent. No empty ticket is ever created.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-03 · A line already with the kitchen cannot be changed

- **Feature** — Snapshot integrity
- **Preconditions** — an order with sent and unsent lines side by side
- **Steps**
  1. Try to change the quantity or note on a sent line, and to remove it.
  2. Do the same on an unsent line.
- **Expected** — The sent line has **no editable controls at all** and shows its KOT number. The unsent line is fully editable. The kitchen has been told to cook that line; the record of what it was told does not change afterwards.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-04 · Steps cannot be skipped or repeated

- **Feature** — Ticket lifecycle
- **Preconditions** — a Pending ticket
- **Steps**
  1. As chef, press **Start preparing**, then immediately look for the same control again.
  2. Mark it ready, then look for **Mark ready** again.
- **Expected** — Each control disappears once used. The rail offers exactly the one step that follows the ticket's current state. A repeated attempt against the API returns **409**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-05 · Every ticket on an order must finish before it can be settled

- **Feature** — Billing eligibility across tickets
- **Preconditions** — an order with two tickets, one Ready and one Preparing
- **Steps**
  1. As manager, try to settle it.
  2. Finish the second ticket as chef, then settle.
- **Expected** — Refused while any ticket is unfinished (**409**); the screen names the outstanding count. Once every ticket is Ready, settling succeeds.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-06 · Moving a ticket never touches the table

- **Feature** — Occupancy independence
- **Preconditions** — an occupied table with a Pending ticket
- **Steps**
  1. Note the table's status on `/floor`.
  2. Start and finish the ticket as chef.
  3. Re-read the table's status.
- **Expected** — The table stays **Occupied** throughout. Kitchen progress changes the rail and the ready-to-settle count, not occupancy. Only opening and closing an order moves that.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-KOT-07 · A chef sees their restaurant's rail only

- **Feature** — Kitchen isolation
- **Preconditions** — open tickets in both restaurants
- **Steps**
  1. As `chef.a`, open `/kitchen`.
- **Expected** — Only Restaurant A's tickets. No count, table name or order number from Restaurant B appears. Ticket numbers are per-restaurant, so both restaurants can legitimately have a "#1".
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 8. Billing, Cancellation and History

#### TC-BILL-01 · The billing queue shows what is actionable

- **Feature** — Billing list
- **Preconditions** — several open orders in mixed kitchen states
- **Steps**
  1. Open `/billing` and read each row.
- **Expected** — Each row carries its own eligibility answer and the counts behind it, so what can be settled now is visible **without opening a single order**. An order that never went to the kitchen shows **Nothing went to the kitchen** — and is settleable, since it is not waiting on a kitchen that was never involved.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-02 · Settle an order that never went to the kitchen

- **Feature** — Payment without kitchen involvement
- **Preconditions** — an open order with no tickets at all
- **Steps**
  1. Settle it with **Card**.
- **Expected** — Succeeds. Order Completed, table released, receipt available. Zero outstanding tickets is not the same as waiting.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-03 · Each payment method records correctly

- **Feature** — Payment methods
- **Preconditions** — three settleable orders
- **Steps**
  1. Settle one with **Cash**, one with **Card**, one with **Digital**.
  2. Check `/reports` → "How it was paid" and `/dashboard` today's totals.
- **Expected** — Three methods only. Each payment lands under the method actually used, with its own count and total. No provider, reference or card detail is captured anywhere — Digital means "money arrived digitally" and nothing more.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-04 · An order cannot be paid twice

- **Feature** — One payment per order
- **Preconditions** — a Completed, paid order
- **Steps**
  1. Reopen `/billing/<id>`.
  2. Look for a payment control. Then re-issue the payment request from devtools (replay the POST).
- **Expected** — No payment control is offered. The replayed request is refused (**409**). This is guaranteed by a database constraint, not only by the screen — so the second payment cannot exist even under a race.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-05 · Cancellation requires a reason

- **Feature** — Order cancellation
- **Preconditions** — an open, unpaid order
- **Steps**
  1. On `/billing/<id>`, choose to cancel. Submit with an empty reason, then with `ab`.
  2. Then with "Guests left before ordering arrived".
- **Expected** — Empty and 2-character reasons refused; the reason must be **3–200 characters**. With a real reason the order becomes **Cancelled**, carrying **who cancelled it and why**. Free text on purpose — a fixed list would be guessing at a restaurant's vocabulary.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-06 · Cancellation preserves everything

- **Feature** — Cancellation, history
- **Preconditions** — TC-BILL-05 passed on an order that had food cooked
- **Steps**
  1. Open the cancelled order as the waiter and as the manager.
  2. Check the kitchen tickets on it, and the ingredient balances.
- **Expected** — **Nothing is deleted.** Every line keeps its snapshot, every ticket keeps its own status, the reason and canceller are stored, and the stock consumed stays consumed. The order is locked to further edits. The table is released.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-07 · The kitchen does not block cancellation, but the manager is warned

- **Feature** — Cancellation eligibility
- **Preconditions** — an order with a ticket **Preparing**
- **Steps**
  1. Open the cancellation flow and read what the screen tells you before you confirm.
  2. Confirm.
- **Expected** — Cancellation is **allowed**, and the screen first tells you how much kitchen work has already been started, because throwing away food on the stove is a different act from voiding an order nobody has touched. Waiting for the kitchen would strand the order open forever — there is no way to un-cook a plate.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-08 · A paid order cannot be cancelled

- **Feature** — Cancellation eligibility
- **Preconditions** — a Completed, paid order
- **Steps**
  1. Look for a cancellation control; then replay the cancellation request.
- **Expected** — Not offered, and refused (**409**) if forced. There is no refund path in this product, so money taken cannot be un-taken.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-BILL-09 · Order history, filtered

- **Feature** — `/billing/history`
- **Preconditions** — at least one completed and one cancelled order
- **Steps**
  1. Open `/billing/history`. Read a row of each kind.
  2. Filter to cancellations only, then to everything.
- **Expected** — Completed rows show the amount and method; cancelled rows show the reason and **no amount as revenue**. KOT counts are shown per order. The cancellations filter excludes payments entirely, and a cancelled order never appears among payments.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 9. Receipts and Reports

#### TC-RPT-01 · No receipt for an open order

- **Feature** — Receipt guard
- **Preconditions** — an Open order
- **Steps**
  1. Navigate directly to `/billing/<open order id>/receipt`.
- **Expected** — No receipt. The screen explains the order has not been paid for; the API returns a refusal, not a blank receipt. Only **completed and paid** orders have receipts.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-02 · No receipt for a cancelled order

- **Feature** — Receipt guard
- **Preconditions** — a Cancelled order
- **Steps**
  1. Navigate directly to its receipt URL.
- **Expected** — Refused, same as above. A cancellation is not a sale.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-03 · Cancelled value is never revenue

- **Feature** — Reports
- **Preconditions** — at least one completed and one cancelled order today
- **Steps**
  1. On `/reports`, read **Collected**, **Cancelled**, and the **Not taken** panel.
  2. Add them up by hand.
- **Expected** — The cancelled figure is reported **separately and is never added to Collected**. The two are different things: money that arrived, and money that did not. The cancelled list shows each order's reason.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-04 · The range is read in the restaurant's own calendar

- **Feature** — Reports, timezone
- **Preconditions** — TC-SETUP-11 set a timezone well away from your machine's, and a day start of 06:00
- **Steps**
  1. Note the timezone the report itself reports back.
  2. Ask for a single day covering today and note the range instants shown.
- **Expected** — The report names the **restaurant's** timezone, and the range opens at **06:00 local**, not at midnight and not in your browser's zone. This is the point of §4's settings: an order at 02:00 belongs to the previous service day.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-05 · Range validation

- **Feature** — Reports, bounds
- **Preconditions** — on `/reports`
- **Steps**
  1. Set **From** later than **To**.
  2. Ask for a range longer than 92 days.
- **Expected** — Both refused with a readable message. The maximum range is **92 days**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-06 · An empty range is empty, not broken

- **Feature** — Reports, empty state
- **Preconditions** — a date range with no trade, e.g. last year
- **Steps**
  1. Ask for it.
- **Expected** — All figures zero, both lists show their own empty states (**Nothing cancelled** and its completed counterpart), **average bill is 0** and not a division error, and nothing renders as `NaN`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-06b · The platform total equals the sum of the manager reports

- **Feature** — `/admin/reports`
- **Preconditions** — trade recorded today in **two** restaurants, ideally set to different timezones
- **Steps**
  1. Note **Collected** on each manager own `/reports` for today.
  2. As super admin, open `/admin/reports` for the same day.
  3. Compare the platform Collected against the sum, and each **By restaurant** row against that restaurant own figure.
  4. Read the **Its window** column on two rows in different timezones.
- **Expected** — The platform total is **exactly** the sum of the manager figures, and each row matches its own restaurant to the penny. The window column shows a **different absolute instant** for restaurants in different zones — deliberately: each range is read in that restaurant own calendar, which is what makes the totals reconcile. Restaurants with no manager are counted and flagged as unable to trade.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RPT-07 · One restaurant's figures never include another's

- **Feature** — Reports isolation
- **Preconditions** — trade recorded in both restaurants today
- **Steps**
  1. Compare `/reports` as `manager.a` and as `manager.b` for the same range.
- **Expected** — Each shows only its own. No order number, table name or amount crosses over. The sum of the two is not visible to either.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 10. Floor and Dashboard

#### TC-VIEW-01 · The floor is one consistent answer

- **Feature** — `/floor`
- **Preconditions** — a mix of free, occupied and out-of-service tables
- **Steps**
  1. Open `/floor` and reconcile every header count against the tables listed below it.
- **Expected** — Total, in service, occupied, available and out of service all agree with the rows, and **occupied + available = in service**. Out-of-service tables are counted as neither occupied nor available. Open value and ready-to-settle counts agree with `/billing`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-02 · The floor is a way into an order, not a second place to edit one

- **Feature** — `/floor`
- **Preconditions** — an occupied table
- **Steps**
  1. Examine a table card carrying an open order.
- **Expected** — It shows the order number, value, item count, who placed it, how long it has been running, kitchen ticket counts by state, and whether it can be settled. It offers a route to the order or the bill — but **no control to change occupancy** and no way to edit lines here.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-03 · Two orders on one table

- **Feature** — Occupancy with multiple orders
- **Preconditions** — `T3` free, in service
- **Steps**
  1. As waiter, open **two** separate orders on `T3`.
  2. Check `/floor`.
  3. Settle one of them. Check `/floor` again.
  4. Settle the second. Check once more.
- **Expected** — Both orders appear on the one table card, with a combined open value. After the **first** is settled the table is **still Occupied** — the other party is still there. Only after the **last** open order closes does it become Available. This is the case a naive "release on close" would get wrong.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-04 · Taking a table out of service does not change occupancy

- **Feature** — In service vs. occupied
- **Preconditions** — an occupied table with an open order
- **Steps**
  1. As manager, take it out of service on `/tables`.
  2. Check `/floor` and the open order.
- **Expected** — The table shows **out of service** but its open order is untouched and still settleable. The order does not vanish, and the guests at it are not forgotten. Restoring the table changes nothing about the order.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-05 · The waiter's floor view

- **Feature** — `/floor` for a waiter
- **Preconditions** — signed in as `waiter.a`
- **Steps**
  1. Open `/floor`.
- **Expected** — The waiter sees the room and can pick up any open table — orders are restaurant-wide, not per-waiter — with who placed each one still shown. No manager-only actions are present.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-06 · Dashboard activity feed is derived, not written

- **Feature** — `/dashboard`
- **Preconditions** — a full order lifecycle completed today
- **Steps**
  1. Read the feed for one order end to end.
  2. Cancel a different order and re-read.
- **Expected** — Six kinds appear where applicable — **Order opened, Sent to kitchen, Cooking started, Ready at the pass, Paid and closed, Cancelled** — each with the right table, order number and ticket number, newest first, **today only**. Nothing is stored to produce this: every entry is a timestamp that already existed on an order or a ticket. Cancelled entries show the reason and no revenue.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-VIEW-07 · Empty states across the shift

- **Feature** — Empty states
- **Preconditions** — a freshly set-up restaurant with no trade at all
- **Steps**
  1. Visit `/dashboard`, `/floor`, `/billing`, `/kitchen` (as chef), `/orders` (as waiter), `/reports`.
- **Expected** — Every screen shows a purposeful empty state: **Nothing running**, **Nothing waiting on you**, **Nothing to settle**, **Nothing on the rail**, **Nothing yet today**. No spinner that never resolves, no red error, no blank panel.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 11. Customers

#### TC-CUST-01 · Record a customer

- **Feature** — `/customers`, create
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. **Add customer**: name `Priya Raman`, phone, email, a note. Save.
  2. Add a second with a **name only**.
- **Expected** — Both created (**201**). Only the name is required. The list shows name, phone, visit and booking counts (0 each), and **Last in: Never**. The note appears under the name.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-02 · A phone number is unique inside one restaurant

- **Feature** — Customers, phone uniqueness
- **Preconditions** — TC-CUST-01 passed
- **Steps**
  1. Add another customer with the **same phone number** as `Priya Raman`.
- **Expected** — Refused (**409**) with a readable message. Nothing created.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-03 · Blank phone numbers do not collide

- **Feature** — Customers, uniqueness edge case
- **Preconditions** — one customer already recorded with no phone
- **Steps**
  1. Add two more customers with **no phone number**.
- **Expected** — Both accepted. A walk-in who gave only a name is still worth recording, and the second must not be refused as a duplicate of the first.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-04 · The same number in a different restaurant is fine

- **Feature** — Customers, isolation
- **Preconditions** — TC-CUST-01 passed
- **Steps**
  1. As `manager.b`, add a customer with **Priya's exact phone number**.
- **Expected** — Accepted. The number identifies a person **to one restaurant**; treating it as a platform identity would leak the fact that somebody eats somewhere else.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-05 · Search by name and by phone

- **Feature** — Customers, search
- **Preconditions** — several customers recorded
- **Steps**
  1. Search a partial **name**. Then a partial **phone number**. Then something matching nothing. Then **Clear**.
- **Expected** — Both fields match. The no-match state says search covers a name or a phone number and suggests trying part of either — it does not offer an "Add customer" button, since you were looking for somebody who exists.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-06 · Archive and restore

- **Feature** — Customers, active status
- **Preconditions** — a customer with no history
- **Steps**
  1. **Archive** them. Note they leave the list.
  2. Tick **Show archived** — the count beside it should be right.
  3. **Restore** them.
- **Expected** — Archiving hides without deleting and marks the row **Archived** when shown. Restoring returns them to the default list.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-07 · Delete only a customer with no history

- **Feature** — Customers, delete guard
- **Preconditions** — one customer with no bookings and no orders; one with a booking (see §12)
- **Steps**
  1. Note which rows offer a **Delete** action.
  2. Delete the clean one.
  3. Try to delete the one with a booking — via the API if the button is absent.
- **Expected** — **Delete is only offered on a row with zero visits and zero bookings.** The clean one deletes (**204**) and its detail page then 404s. The one with history is refused (**409**) even when forced, with a message pointing to archiving instead — an order or booking pointing at a row nobody can look up loses the answer to who it was for.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-08 · Customer detail shows both histories

- **Feature** — `/customers/[id]`
- **Preconditions** — a customer with at least one booking
- **Steps**
  1. Open the customer from the list.
- **Expected** — Details panel with name, phone, email, notes, **Last in**, first recorded, and an on-the-books / archived badge. **Bookings** and **Visits** sections below, newest first, both read-only. An empty history reads as its own state, not as a failure. Bookings link out to `/reservations`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-09 · Validation

- **Feature** — Customers, field limits
- **Preconditions** — the add-customer dialog open
- **Steps**
  1. Save with a name of only spaces.
  2. Enter `not-an-email` in the email field and save.
  3. Try a note longer than 500 characters.
- **Expected** — Blank name refused (**400**). Malformed email refused with the message on the email field. Name capped at 120, phone 32, email 256, notes 500.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-CUST-10 · Nothing about a customer is ever sent anywhere

- **Feature** — Absent by design
- **Preconditions** — a customer with an email address
- **Steps**
  1. Look for any control that emails, texts or notifies a customer.
- **Expected** — There is none, anywhere. The email field's own hint says it is kept for records and that nothing is ever sent to it. Customers have no login, no password and no self-service.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 12. Reservations

The rule to keep in mind: **a booking says a table is *intended* for somebody later; whether it is in use *now* is decided entirely by whether an order is running on it.** Nothing on this screen writes table occupancy — seating included. TC-RES-06 is the case that proves it and the most important test in this section.

#### TC-RES-01 · Take a booking

- **Feature** — `/reservations`, create
- **Preconditions** — at least one customer recorded (§11)
- **Steps**
  1. **Take a booking**: choose the customer, a time tomorrow evening, 4 guests, table `T1`, sitting 90 minutes, a note.
  2. Read the row that appears.
- **Expected** — Created (**201**) as **Pending**. The row shows the expected time, an **until** time exactly 90 minutes later, the customer with their phone, guest count, table, status and the note. The four header counts (Today, Covers today, Still to come, Seated now) update sensibly.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-02 · A booking with no table decided

- **Feature** — Optional table
- **Preconditions** — as above
- **Steps**
  1. Take a booking leaving the table as **Not decided**.
- **Expected** — Accepted — a booking can be taken before anybody decides where to put it. The table reads **Not decided**, and **Seat is not offered**, because there is nowhere to seat them.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-03 · Overlapping bookings on one table are refused

- **Feature** — Clash detection
- **Preconditions** — TC-RES-01 booked `T1` for 19:00–20:30
- **Steps**
  1. Book `T1` again at **19:30**.
  2. Book `T2` at 19:30.
- **Expected** — The first is refused (**409**) with a message **naming the table and the customer already holding it**, so the manager can go and look rather than guess. The different table is accepted.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-04 · A booking may start exactly when the last one ends

- **Feature** — Clash boundary
- **Preconditions** — `T3` booked 18:00 for a 60-minute sitting
- **Steps**
  1. Book `T3` at exactly **19:00**.
- **Expected** — Accepted. A table freed at seven is available at seven; refusing this would lose a sitting every evening for no reason.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-05 · Cancelling frees the slot

- **Feature** — Clash detection and closed bookings
- **Preconditions** — TC-RES-03: a booking holding `T1` at 19:00
- **Steps**
  1. Confirm that 19:30 on `T1` is still refused.
  2. **Cancel** the 19:00 booking (reason optional).
  3. Try 19:30 on `T1` again.
- **Expected** — Blocked, then accepted. Only bookings that still hold a table can clash — a cancelled or finished one never blocks the next sitting.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-06 · Seating a party does **not** occupy the table — critical

- **Feature** — Occupancy independence
- **Preconditions** — a booking on `T2` with `T2` **Available** and no open order on it
- **Steps**
  1. On `/floor` and `/tables`, note `T2` is **Available**.
  2. On `/reservations`, **Confirm** the booking, then **Seat** it.
  3. Re-read `T2` on `/floor` and `/tables`.
  4. Now have the waiter open an order on `T2`. Re-read again.
- **Expected** — After seating, the booking is **Seated** — and **`T2` is still Available**. Only when the waiter opens an order does it become **Occupied**. Two systems both claiming to know whether a table is free is how a floor gets double-booked; this product has exactly one answer, and it comes from orders.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-07 · The lifecycle, and only the step that follows

- **Feature** — Reservation status
- **Preconditions** — a Pending booking with a table
- **Steps**
  1. Note which action buttons are offered. **Confirm**. Note them again.
  2. **Seat**. Note again. **Sitting over**. Note again.
  3. At each stage, try the previous step again from devtools.
- **Expected** — Pending offers Confirm, Seat, Edit, Cancel. Confirmed drops Confirm. Seated offers **Sitting over** and Cancel but not Confirm. Completed offers nothing. Every repeated or skipped step returns **409**. The buttons come from flags the server sends, so the screen and the write path cannot disagree.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-08 · Seating with no table is refused

- **Feature** — Seating guard
- **Preconditions** — a Confirmed booking with **Not decided** as its table
- **Steps**
  1. Look for a Seat control. Then force the seat request from devtools.
- **Expected** — Not offered, and refused (**409**) with a message telling you to **choose the table they are being shown to** — a distinct message from the general wrong-status refusal, because the fix is different.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-09 · A party moved on arrival is recorded where they actually sat

- **Feature** — Seating with a table override
- **Preconditions** — a booking on `T1`
- **Steps**
  1. Seat it, supplying `T3` instead.
- **Expected** — Status **Seated** and the booking now shows **`T3`**. Neither table's occupancy changes.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-10 · Editing a booking re-checks for clashes

- **Feature** — Edit
- **Preconditions** — two non-overlapping bookings on the same table
- **Steps**
  1. Edit the later one to start **inside** the earlier one's sitting.
  2. Then move it to a genuinely free slot.
- **Expected** — First refused (**409**) naming the clash; second accepted. Moving a time is how most clashes actually appear, so the check runs again on every edit. The **customer cannot be changed** by an edit — booking somebody else means taking a new booking.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-11 · A closed booking is a record

- **Feature** — Edit guard
- **Preconditions** — one Completed and one Cancelled booking
- **Steps**
  1. Look for Edit on each; then force an update request.
- **Expected** — Not offered, refused (**409**). A **Seated** booking, by contrast, **is** still editable — a party booked for four that arrives as three is worth correcting while they are sitting there. Only closing locks it.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-12 · Cancellation reason is optional here

- **Feature** — Cancel
- **Preconditions** — a live booking
- **Steps**
  1. Cancel with **no** reason. Cancel another **with** one.
- **Expected** — Both accepted. Unlike an order cancellation, a booking that never happened costs nothing and often has no reason worth recording. Where given, the reason shows under the status.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-13 · The board's default view and its filters

- **Feature** — Board filters
- **Preconditions** — bookings yesterday, today and next week; some closed
- **Steps**
  1. Open `/reservations` with no filters.
  2. Tick **Show finished and cancelled**.
  3. Pick a specific date, including a past one. Then **Back to upcoming**.
- **Expected** — The default is **today and everything still to come** — yesterday's bookings are history and are reached by date, which is the question a manager actually has. The closed toggle adds Completed and Cancelled rows. A date shows that day in the **restaurant's own calendar**, honouring §4's settings.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-14 · Header counts

- **Feature** — Board counts
- **Preconditions** — a mix including a cancelled booking for today and one Seated party
- **Steps**
  1. Reconcile Today, Covers today, Still to come, Seated now against the rows.
- **Expected** — **Covers today counts only bookings that still hold a table** — a cancelled one is excluded, because nobody is coming and counting its covers would overstate the evening. Seated now matches the Seated rows.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-15 · A booking larger than the table is flagged, not refused

- **Feature** — Capacity hint
- **Preconditions** — `T2` seats 2
- **Steps**
  1. Book `T2` for 6 guests.
- **Expected** — Accepted, and the row **points out the table's capacity** beneath the table name. Restaurants combine tables; the product warns rather than forbids.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-16 · Validation

- **Feature** — Bounds
- **Preconditions** — the booking dialog open
- **Steps**
  1. Try 0 guests, then 500.
  2. Try a sitting of 5 minutes, then 600.
  3. Try a note over 500 characters.
- **Expected** — Guests must be **1–200**, the sitting **15–480 minutes**, notes at most 500. Each refused with a readable message.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-17 · Only your own customers and tables can be booked

- **Feature** — Isolation
- **Preconditions** — customers and tables in both restaurants
- **Steps**
  1. As `manager.a`, open the booking dialog and inspect the customer and table dropdowns.
  2. Force a create request using a **Restaurant B** customer id, then a Restaurant B table id.
- **Expected** — Only Restaurant A's own customers and **in-service** tables are listed. A foreign customer id returns **404** — the *same* answer as a made-up one, so a caller cannot learn that the id exists. A foreign or withdrawn table is refused (**409**) as not available to reserve.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-RES-18 · Times are shown in the device's timezone — known limitation

- **Feature** — Reservation times
- **Preconditions** — TC-SETUP-11 set a timezone different from your machine's
- **Steps**
  1. Take a booking for "19:00" and note what the board then displays.
  2. Read the hint under the time field and the note at the foot of the page.
- **Expected** — The field and the board both work in **this device's timezone**, and both say so. **This is a known limitation, not a bug to file:** unlike reports and the service day, reservation times are not read in the restaurant's timezone, so a manager working remotely from their restaurant will book an hour or more out. Record it in Notes and move on.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 13. Guest QR Table Ordering

What a guest can reach is decided entirely by the **token in the link**. There is no account, no session and no restaurant id involved. Every case below is about whether that token grants exactly one table and nothing else.

Token facts worth knowing while testing: **32 characters**, drawn from `abcdefghjkmnpqrstvwxyz23456789` — no uppercase, no `i`, `l`, `o`, `u`, `0` or `1`, because those are misread off a printed card. The public URL is `/t/<token>`.

#### TC-QR-01 · Every table has a token, and ordering starts off

- **Feature** — Token issue
- **Preconditions** — TC-SETUP-13 passed
- **Steps**
  1. On `/tables`, note the **Self-service** column for each table.
  2. Open **Manage** on `T1` and read the **Guest ordering** section.
- **Expected** — Every table shows **Off**. The Guest ordering panel already has a **QR code and an ordering link** — a token exists from the moment the table does, so a manager who decides months later to put codes out has nothing to set up. But guest ordering itself is **off until switched on**: holding a token is not the same as inviting the public.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-02 · A switched-off link does not resolve

- **Feature** — Public link, disabled
- **Preconditions** — TC-QR-01: `T1` ordering off
- **Steps**
  1. Copy `T1`'s ordering link and open it in a **private window** (no session).
- **Expected** — **"This link is not working"**, with advice to ask a member of staff, and a **Try again** button. API returns **404**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-03 · Every way of failing looks the same

- **Feature** — Public link, non-disclosure — **security-critical**
- **Preconditions** — TC-QR-02
- **Steps**
  1. Visit `/t/<T1's real but switched-off token>`.
  2. Visit `/t/not-a-real-token`.
  3. Visit `/t/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (well-formed, unknown).
  4. Visit `/t/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` (uppercase — not in the alphabet).
  5. Visit a token 31 and then 33 characters long.
  6. Switch `T1` ordering **on**, take `T1` **out of service**, and visit its link.
  7. Compare all six responses in the Network tab.
- **Expected** — **All six return 404 with the identical message.** A different answer per case would let anybody map the restaurant's tables by trying links. Nothing distinguishes "wrong shape" from "unknown" from "switched off" from "withdrawn".
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-04 · Switch guest ordering on

- **Feature** — Manager QR control
- **Preconditions** — `T1` in service
- **Steps**
  1. Manage `T1` → Guest ordering → **Switch on**.
  2. Note that the dialog stays open and the badge flips to **On**.
  3. Check the `/tables` list.
- **Expected** — Badge **On**; the row now reads **Guests can order**. The dialog stays open, since a manager who has just switched ordering on is about to look at the code.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-05 · A withdrawn table is warned about

- **Feature** — Manager QR control, cross-check
- **Preconditions** — `T1` with ordering **on**
- **Steps**
  1. Take `T1` out of service, then reopen its Manage dialog.
- **Expected** — A warning saying the table is out of service so **the code will not work until you put it back**. Guest ordering is left as it was, not silently switched off — the two settings are deliberately separate.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-06 · The scanned page

- **Feature** — `/t/{token}` render
- **Preconditions** — `T1` in service with ordering on
- **Steps**
  1. Open the link in a **private window**.
- **Expected** — The **restaurant name** and **table name** at the top, so the guest can see they scanned the right thing, and the menu grouped as the restaurant groups it, with descriptions and prices. **And critically, none of the application:** no sidebar, no Workspace breadcrumb, no sign-in link, no account menu, no route into the manager interface. Empty menu sections are omitted rather than rendered as headings with nothing under them.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-07 · The page exposes no identifiers

- **Feature** — Public page, non-disclosure
- **Preconditions** — TC-QR-06
- **Steps**
  1. In the Network tab, read the full JSON of the `GET /api/public/tables/{token}` response.
  2. Search it for the restaurant id, the table id, the category id and the token.
  3. Check `<title>` and the robots meta tag in the page source.
- **Expected** — **None of those ids appear.** Only menu item ids are present, because an order has to name what it wants somehow. Title is **"Order at your table"**; robots is **`noindex, nofollow`** — these links are private to a table and must not end up in a search index.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-08 · The printed QR code actually scans — the one test only a human can do

- **Feature** — QR encoding
- **Preconditions** — `T1` ordering on; a real phone on the same network as the dev machine
- **Steps**
  1. Start the frontend so it is reachable by IP: `npm run dev -- -H 0.0.0.0`, and set `NEXT_PUBLIC_API_URL=http://<your-lan-ip>:5080` so the phone can reach the API too.
  2. Open `/tables` on the dev machine **at that LAN address** — the code encodes whatever host the manager is looking at, so opening it via `localhost` produces a card only that machine can use.
  3. Manage `T1`, and scan the on-screen QR code with the phone's camera.
  4. Print the dialog (Ctrl/Cmd-P) and scan the **paper** copy.
  5. Scan again from further away, at an angle, and with part of the code covered by a thumb.
- **Expected** — The camera resolves the link and the phone opens the guest page for `T1`. **The paper copy scans too.** The code is black on white regardless of light or dark theme, has a white quiet-zone border, and stays crisp when printed. Error correction is level M, so a partly obscured code should still read.
- **Why this matters** — the encoder is written in this repository rather than installed. It is unit-tested against the published format strings and round-trips its own output, but **nothing in this project has ever put a code in front of a camera.** A structurally valid symbol that no scanner reads would pass every automated test.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-09 · Copy link and print

- **Feature** — Manager QR utilities
- **Preconditions** — the Manage dialog open on a table with ordering on
- **Steps**
  1. Press **Copy link**, then paste it somewhere.
  2. Print-preview the dialog.
- **Expected** — The button confirms **Copied** and the clipboard holds the full `http://…/t/<token>` URL. The link is also shown on screen in full and is selectable by hand, so a browser that refuses clipboard access loses nothing.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-10 · A guest places an order

- **Feature** — Public ordering, create
- **Preconditions** — `T1` in service, ordering on, **no open order on it**
- **Steps**
  1. In a private window on `/t/<T1 token>`, use the **+** buttons to choose 2 × `Burger` and 1 × `Cola`.
  2. Note the bar that appears at the foot of the screen and its label.
  3. Add "No ice" in the note box and press the order button.
- **Expected** — The steppers are thumb-sized; **−** only appears once a quantity is above zero. The order bar reads **Order 3 items · 27.50**. After ordering: a confirmation saying the order is with the restaurant and **a member of staff will send it to the kitchen**, and a **Your order · #N** panel listing the lines, a running total, and a badge saying how many units are **waiting to go to the kitchen**. The guest is told to pay with staff and quote the order number.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-11 · A guest order is an ordinary order

- **Feature** — One ordering system
- **Preconditions** — TC-QR-10 passed
- **Steps**
  1. As waiter, open `/orders`.
  2. As manager, open `/floor`, `/billing` and `/tables`.
- **Expected** — The order appears in the waiter's list with a sequential number from the **same** sequence, and is attributed to **"Guest at the table"** — not to a member of staff, and not to "Unknown". `T1` is now **Occupied**. It shows on the floor and in the billing queue exactly like any other order. There is no separate guest-orders screen anywhere, because there is no separate ordering system.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-12 · Guest orders do not reach the kitchen by themselves

- **Feature** — Kitchen submission and stock — **security-relevant**
- **Preconditions** — TC-QR-10 passed; `Burger` has a recipe
- **Steps**
  1. As chef, open `/kitchen`.
  2. As manager, check the ingredient balances and the item's history.
  3. As waiter, open the guest order and press **Send N to kitchen**.
  4. Re-check the rail, the balances, and refresh the guest page.
- **Expected** — Before step 3 the rail shows **nothing** for this order and **no stock has moved**. Somebody holding a photograph of a code must not be able to put food on a stove. After the waiter sends it, the ticket appears on the rail, stock is deducted with a **Used for cooking** entry naming the order, and the guest page's waiting badge drops to zero with the lines marked as with the kitchen.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-13 · A second round joins the same bill

- **Feature** — Public ordering, append
- **Preconditions** — TC-QR-10: a guest order open on `T1`
- **Steps**
  1. On the same guest page, order 1 more `Cola`.
  2. Check the guest's order panel, then the waiter's `/orders` and the floor.
- **Expected** — The **same order number**, with the total increased by exactly 2.50 — not doubled, and not a second order. One order on the table: a party leaving with two bills would be the clearest sign this had become a separate ordering system.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-14 · While a waiter is serving, the guest is handed back to staff

- **Feature** — Self-service vs. table service
- **Preconditions** — `T2` in service, ordering on, **no** open order
- **Steps**
  1. As waiter, open an order on `T2`.
  2. Open `/t/<T2 token>` in a private window.
  3. Try to order anyway by replaying the POST from devtools.
- **Expected** — The page says a member of staff is looking after this table and to ask them, the menu offers no way to order, and **the staff order's contents are not shown** — that bill is not the guest's to read through a link. The forced request is refused (**409**).
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-15 · The next party gets a clean page

- **Feature** — Public ordering after settlement
- **Preconditions** — a guest order on `T1`, cooked and ready
- **Steps**
  1. As manager, settle it.
  2. Refresh the guest page.
  3. Order something.
- **Expected** — The previous party's bill is **gone** from the page and ordering is open again. The new order gets a **different** order number. No guest ever sees the previous party's spending.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-16 · A guest cannot influence prices

- **Feature** — Server-side pricing — **security-critical**
- **Preconditions** — a guest page that can order
- **Steps**
  1. From devtools, POST to `/api/public/tables/{token}/orders` with extra fields: `"price": 0.01`, `"unitPrice": 0.01`, `"subtotal": 0.01`.
  2. Read the response and the resulting order.
- **Expected** — Accepted, but priced entirely from the restaurant's own menu — the returned subtotal is the **real** amount. Every extra field is ignored. Confirm the same in `/billing`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-17 · A guest cannot reach past their own table

- **Feature** — Token scope — **security-critical**
- **Preconditions** — tokens for `T1` (Restaurant A) and a Restaurant B table, both with ordering on
- **Steps**
  1. Open both links and confirm each shows its own restaurant name and table name.
  2. POST an order to `T1`'s token naming a **Restaurant B menu item** id.
  3. POST an order to `T1`'s token with an extra `"tableId"` or `"restaurantId"` field pointing at Restaurant B.
- **Expected** — Each token resolves only to its own table. The foreign menu item is refused (**409**) as no longer available — inactive, hidden and belonging-elsewhere are all refused identically. Extra id fields are ignored entirely: the endpoint takes the token and nothing else, so there is nothing to substitute.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-18 · Reissuing a code invalidates every printed card

- **Feature** — Token regeneration
- **Preconditions** — a working guest link, ordering on
- **Steps**
  1. Note the current link. Confirm it works.
  2. Manage the table → **New code**.
  3. Try the **old** link, then the **new** one.
- **Expected** — The link changes and ordering stays on. The **old link now 404s** and the new one works. This is the answer to a code being photographed or walked off with; the dialog says as much. Only one token is ever live for a table.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-19 · Switching off does not reprint anything

- **Feature** — Token stability
- **Preconditions** — a working guest link
- **Steps**
  1. Note the token. **Switch off**. Confirm the link 404s.
  2. **Switch on** again. Compare the token and retry the link.
- **Expected** — The token is **identical** and the original link works again. Stopping self-service for the evening must not mean reprinting the cards on every table.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-20 · The guest page is usable on a real phone

- **Feature** — Mobile rendering
- **Preconditions** — TC-QR-08's LAN setup; a real phone
- **Steps**
  1. Order two or three things on the phone, with a note.
  2. Rotate to landscape. Scroll with the order bar showing.
  3. Repeat with the phone set to **dark mode**, then **light mode**.
- **Expected** — Everything is reachable one-handed; the order bar stays pinned above the fold without covering the last menu item; the page never scrolls sideways; text is legible in both themes with no white-on-white or black-on-black.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-21 · Guest ordering limits

- **Feature** — Public ordering bounds
- **Preconditions** — a guest page that can order
- **Steps**
  1. Try to raise one item above 99 with the **+** button.
  2. From devtools, POST two lines of the same item with quantity 60 each.
  3. POST an empty `items` array.
  4. POST 50 distinct lines.
- **Expected** — The stepper caps at 99. The split 120 is refused (**409**) — the per-line cap survives consolidation, so twenty requests of five cannot walk past it. An empty order is refused (**400**). More than **40 distinct lines** in one request is refused.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-QR-22 · No rate limiting — known gap

- **Feature** — Absent protection
- **Preconditions** — a working token
- **Steps**
  1. Replay the order POST twenty times quickly.
- **Expected** — All succeed, appending to one order. **This is a known gap, not a finding:** the public routes have no rate limiting, so a scripted caller with a valid token can pile items onto a bill. The per-request line and quantity caps are the only bound, and staff see every line before anything is cooked. Record the observed behaviour and move on.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 14. Roles, Authorisation and Restaurant Isolation

Every case here should be checked **by typing the URL directly**, not by looking for a missing button. The backend is authoritative; hiding a control is presentation only.

#### TC-SEC-01 · Route matrix by role

- **Feature** — Authorisation
- **Preconditions** — all accounts from §2, one browser profile each
- **Steps** — For each role, type each URL below into the address bar and record what happens.

| URL | Super Admin | Manager | Waiter | Chef | Cashier | User | Signed out |
|---|---|---|---|---|---|---|---|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | → `/login` |
| `/admin/restaurants` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/admin/managers` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/admin/reports` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/admin/settings` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/my-restaurant` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/settings` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/tables` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/menu` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/staff` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/inventory` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/billing` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/reports` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/customers` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/reservations` | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/floor` | ⛔ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/orders`, `/orders/new` | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | → `/login` |
| `/kitchen` | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | → `/login` |
| `/t/{valid token}` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **✅ — by design** |

- **Expected** — Every ⛔ is a refusal, and the underlying API call returns **403**. Note especially that a **manager cannot take orders or work the kitchen**, and a **waiter and chef cannot do each other's job** — configuring a restaurant, taking orders and cooking are three different jobs, and blurring them would make "who placed this order" ambiguous. Signed out, everything redirects to `/login` **except** the public table link.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-02 · No endpoint accepts a restaurant id

- **Feature** — Restaurant resolution — **security-critical**
- **Preconditions** — signed in as `manager.a`; devtools open
- **Steps**
  1. Watch the request bodies and query strings as you create a table, a menu item, a customer, a booking, an inventory item, and place an order.
  2. Then take any of those creates and **add** `"restaurantId": "<Restaurant B's id>"` to the body. Send it.
- **Expected** — **No request carries a restaurant id at any point.** The added field is ignored: the record lands in Restaurant A regardless. The restaurant is derived from the token and is never accepted from a client.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-03 · A foreign id is indistinguishable from a nonexistent one

- **Feature** — Isolation — **security-critical**
- **Preconditions** — records in both restaurants; ids for Restaurant B's customer, booking, order, table, menu item and inventory item
- **Steps**
  1. As `manager.a`, request each of these by **Restaurant B's** id: `/api/customers/{id}`, `/api/reservations/{id}`, `/api/tables/{id}`, `/api/menu/items/{id}`, `/api/inventory/items/{id}`, `/api/billing/orders/{id}`.
  2. Repeat with `00000000-0000-0000-0000-000000000000`.
  3. Compare status **and message** for each pair.
- **Expected** — Every pair matches: **404 with the identical message**. Same status alone is not enough — a different message would still tell a caller that the id exists somewhere. A foreign id must be as unfindable as one that was never issued.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-04 · Writes to another restaurant's records are refused and change nothing

- **Feature** — Isolation, writes
- **Preconditions** — as above
- **Steps**
  1. As `manager.a`, attempt: rename Restaurant B's customer; archive it; edit its table; switch its guest ordering on; reissue its token; confirm/seat/complete/cancel its booking; settle or cancel its order.
  2. Then sign in as `manager.b` and inspect every one of those records.
- **Expected** — Every attempt returns **404**, and **nothing in Restaurant B has changed** — same names, same statuses, same tokens, same active flags. A refusal that had already half-applied would be worse than a success.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-05 · Cross-restaurant lists never leak

- **Feature** — Isolation, reads
- **Preconditions** — data in both restaurants
- **Steps**
  1. As `manager.a`, review every list screen: tables, menu, staff, inventory, customers, reservations, billing, history, floor, dashboard, reports.
- **Expected** — No name, number, table, amount or count from Restaurant B appears in any of them — including in header **totals**, which is the easiest place for a leak to hide.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-06 · Waiters and chefs are scoped too

- **Feature** — Staff isolation
- **Preconditions** — open orders and tickets in both restaurants
- **Steps**
  1. As `waiter.a`, review `/orders` and `/floor`, and try to open a Restaurant B order by id.
  2. As `chef.a`, review `/kitchen`, and try to start a Restaurant B ticket by id.
- **Expected** — Only their own restaurant's work is listed. Foreign ids return **404**. Per-restaurant numbering means both restaurants can have an order "#7" and a ticket "#3"; confirm the right one is shown.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-07 · The ordering token is a credential

- **Feature** — Token disclosure
- **Preconditions** — tables with tokens in both restaurants
- **Steps**
  1. As `manager.b`, list tables and search the response for any of Restaurant A's tokens.
  2. As waiter, chef and cashier, request `/api/tables`.
  3. Signed out, request `/api/tables`.
- **Expected** — A token is returned **only** to the manager of the restaurant that owns the table, and only so a code can be printed. Staff get **403**; signed out gets **401**. Anybody holding a token can order onto that table, which is precisely why reissuing exists.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-08 · Tokens are never stored where a script could read them

- **Feature** — Session handling
- **Preconditions** — signed in as any role
- **Steps**
  1. In devtools → Application, inspect Local Storage, Session Storage and IndexedDB.
  2. Inspect Cookies and look at the flags on the refresh cookie.
  3. Sign out and re-inspect.
- **Expected** — **No access token in any persistent store** — it lives in memory only. The refresh token is an **HttpOnly** cookie, unreadable from JavaScript. No API response anywhere contains a refresh token or a password hash. Signing out clears the session locally even if the server call fails.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-SEC-09 · Session survives a reload but not a sign-out

- **Feature** — Session restore
- **Preconditions** — signed in as `manager.a`
- **Steps**
  1. Hard-refresh a deep page such as `/customers`.
  2. Sign out, then press the browser Back button.
- **Expected** — The reload restores the session through the refresh cookie and the page loads normally — the access token was never persisted, yet the session survives. After signing out, Back does **not** restore access; you land on `/login`.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 15. Concurrency and Edge Cases

#### TC-EDGE-01 · Two managers settling the same order

- **Feature** — Optimistic concurrency
- **Preconditions** — one settleable order; the same manager signed in in two windows of the **same** profile (or two tabs)
- **Steps**
  1. Open `/billing/<id>` in both. Settle in the first.
  2. Settle in the second **without refreshing**.
- **Expected** — The second is refused (**409**) with a message telling you to reload — not a second payment, and not a silent overwrite. One payment per order is a database guarantee.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-02 · Settling and cancelling at once

- **Feature** — Order lifecycle race
- **Preconditions** — one settleable order open in two windows
- **Steps**
  1. Settle in one; cancel in the other without refreshing.
- **Expected** — Exactly one succeeds. The order has **one ending** — it can never be both paid and cancelled. The loser gets a conflict.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-03 · Two waiters editing one order

- **Feature** — Row version check
- **Preconditions** — an open order in two windows
- **Steps**
  1. Change a quantity and save in the first.
  2. Change a different quantity and save in the second, without refreshing.
- **Expected** — The second save is refused with a reload prompt. The first waiter's work is **not** silently discarded — two waiters editing one order is a realistic situation on a busy service.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-04 · Two chefs starting the same ticket

- **Feature** — Ticket concurrency
- **Preconditions** — a Pending ticket, `/kitchen` open in two windows
- **Steps**
  1. Press **Start preparing** in both, as close together as you can.
- **Expected** — One succeeds; the other is refused (**409**) and the rail corrects itself on refresh. The ticket does not end up started twice.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-05 · Two submissions of the same lines

- **Feature** — One ticket per line
- **Preconditions** — an order with unsent lines, open in two windows
- **Steps**
  1. Press the send control in both, as close together as you can.
- **Expected** — Exactly **one** ticket is created. The second is refused as already submitted. A line can appear on only one kitchen ticket — enforced by the database, so no race can duplicate it. Confirm stock was deducted **once**.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-06 · Two orders opened at the same instant

- **Feature** — Order numbering
- **Preconditions** — two waiters (or two windows) on `/orders/new`
- **Steps**
  1. Place both orders as close together as possible.
  2. Read both order numbers.
- **Expected** — Two **different**, consecutive numbers. Numbering is per restaurant and has no gaps caused by the collision; a duplicate is retried rather than stored.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-07 · A guest and a waiter ordering on the same table at once

- **Feature** — Public and staff ordering race
- **Preconditions** — a free table with ordering on
- **Steps**
  1. Have the guest page and `/orders/new` both ready for that table.
  2. Submit both as close together as you can.
- **Expected** — No crash and no lost order. Either both orders exist on the table with different numbers, or the guest is refused with the staff-serving conflict (**409**). The table ends **Occupied** and the floor shows a coherent picture. Record which outcome you saw.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-08 · An item hidden between ordering and saving

- **Feature** — Menu availability re-check
- **Preconditions** — an open order with `Cola` on it, unsent
- **Steps**
  1. As manager, **hide** `Cola` from the menu.
  2. As waiter, add another `Cola` to the order and save.
  3. Then save the order **without** adding anything new.
- **Expected** — Adding the now-hidden item is refused with a message about refreshing the menu — the create path re-checks availability rather than trusting that it was not offered. Saving the order with the **existing** `Cola` line still works: that line was legitimately ordered and keeps its snapshot.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-09 · A price change does not rewrite an existing line

- **Feature** — Snapshot integrity — **money-critical**
- **Preconditions** — an open order containing `Burger` at 12.50
- **Steps**
  1. As manager, change `Burger` to 20.00 on `/menu`.
  2. As waiter, reopen the order and read the `Burger` line and total.
  3. Add **another** `Burger` and save.
  4. Settle the order and read the receipt.
- **Expected** — The existing line stays at **12.50**; the new line is **20.00**. The total is the sum of both. The receipt shows both prices as recorded. A price change tonight must not rewrite what somebody already agreed to pay.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-10 · A table withdrawn mid-order

- **Feature** — Table status vs. live order
- **Preconditions** — an open order on `T1`
- **Steps**
  1. As manager, take `T1` out of service.
  2. As waiter, edit and send the order. As manager, settle it.
- **Expected** — The whole order completes normally. Withdrawing a table stops **new** orders being seated there; it does not abandon guests already at it.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-11 · Deleting nothing, ever

- **Feature** — History preservation
- **Preconditions** — a full day of trade including a cancellation
- **Steps**
  1. Search every screen for a delete or remove action on: an order, an order line already sent, a kitchen ticket, a payment, a stock movement, a completed booking.
- **Expected** — **None exists.** The only deletes in the whole product are: a customer with no history, and an inventory item with no history and no recipe using it. Everything else is archived, cancelled or deactivated.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-12 · The service-day boundary

- **Feature** — Reports and dashboard day boundary
- **Preconditions** — day start set to a value you can cross, e.g. one hour from now
- **Steps**
  1. Note today's dashboard figures and today's report.
  2. Wait for the boundary to pass (or move the day-start hour so the boundary is behind you).
  3. Re-read both.
- **Expected** — Today's counters reset at the configured hour in the **restaurant's** timezone, not at midnight and not in your browser's zone. Orders before the boundary belong to the previous service day and stop appearing in "today".
- **Known limitation** — the day boundary is computed from a local wall-clock hour, so **twice a year, on the daylight-saving changeover, a boundary falling in a skipped or repeated hour will be off by one hour**. Do not file this; note it.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-13 · Long values and unusual characters

- **Feature** — Rendering robustness
- **Preconditions** — manager access
- **Steps**
  1. Create a menu item with a 100-character name and a customer with a 120-character name.
  2. Use accented and non-Latin characters: `Café`, `東京`, `naïve`.
  3. Enter `<script>alert(1)</script>` as a customer note and as an order line note, and view it everywhere it appears — including a guest order note on the public page.
- **Expected** — Long names wrap or ellipsise; no table forces the page to scroll sideways. Non-Latin text renders correctly everywhere, receipt included. The script tag renders as **literal text** and never executes — check the guest page and the kitchen rail especially.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-14 · Light and dark theme across every screen

- **Feature** — Theming
- **Preconditions** — access to all roles
- **Steps**
  1. Set the OS to dark mode and walk every screen in this guide.
  2. Repeat in light mode.
- **Expected** — Every screen legible in both. No white-on-white, no black-on-black, no invisible badge or border. **The QR code stays black on white in both** — a scanner needs that contrast and polarity, and a code printed in dark-theme colours does not read.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-15 · Behaviour when the API is down

- **Feature** — Failure handling
- **Preconditions** — signed in as manager
- **Steps**
  1. Stop the API. Reload `/customers`, `/reservations`, `/floor`.
  2. Try an action that writes, e.g. saving a customer.
  3. Restart the API and press **Try again**.
  4. Open a guest QR page while the API is down.
- **Expected** — Each screen shows an error state with a **Try again** that works once the API is back — not an endless spinner and not a blank page. A failed write reports the failure and does not claim success. The guest page shows its own "link is not working" state with a retry, in language aimed at a guest rather than an engineer.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

#### TC-EDGE-16 · Keyboard and screen-reader basics

- **Feature** — Accessibility
- **Preconditions** — any manager screen with a dialog
- **Steps**
  1. Tab through a list screen. Open a dialog with the keyboard.
  2. Confirm focus is trapped inside it, `Esc` closes it, and focus returns to the trigger.
  3. Check that every focused control has a visible focus ring.
  4. Confirm status badges carry a shape or a dot, not colour alone.
  5. On the guest page, confirm the **+** and **−** steppers have spoken labels naming the item.
- **Expected** — All of the above hold. Dialogs trap focus and restore it. Nothing is conveyed by colour alone.
- **Actual** — ______________ · **Pass / Fail** ☐ P ☐ F · **Notes** ______________

---

## 16. Sign-Off Sheet

Tester ____________________ · Build / commit ____________________ · Date ____________________
Backend `dotnet test` ☐ green · Frontend `npm test` ☐ green · `npm run test:contract` ☐ green

| Section | Cases | Passed | Failed | Blocked | Sign-off |
|---|---|---|---|---|---|
| §4 Initial setup | TC-SETUP-01 … 23 | | | | |
| §5 Inventory and recipes | TC-INV-01 … 12, TC-REC-01 … 10 | | | | |
| §6 Waiter order workflow | TC-FLOW-01 … 16 | | | | |
| §7 Kitchen | TC-KOT-01 … 07 | | | | |
| §8 Billing and cancellation | TC-BILL-01 … 09 | | | | |
| §9 Receipts and reports | TC-RPT-01 … 07 | | | | |
| §10 Floor and dashboard | TC-VIEW-01 … 07 | | | | |
| §11 Customers | TC-CUST-01 … 10 | | | | |
| §12 Reservations | TC-RES-01 … 18 | | | | |
| §13 Guest QR ordering | TC-QR-01 … 22 | | | | |
| §14 Roles and isolation | TC-SEC-01 … 09 | | | | |
| §15 Concurrency and edge cases | TC-EDGE-01 … 16 | | | | |

### Must-pass cases

A release should not ship with any of these failing, whatever else passes:

| ☐ | Case | Why |
|---|---|---|
| ☐ | TC-FLOW-02 … 15 | The core service. If this breaks, nothing else matters. |
| ☐ | TC-SEC-02, TC-SEC-03, TC-SEC-04 | Restaurant isolation. A leak here is a breach, not a bug. |
| ☐ | TC-SEC-07, TC-SEC-08 | Credential handling: tokens and sessions. |
| ☐ | TC-QR-03 | A public link must not disclose which tables exist. |
| ☐ | TC-QR-16, TC-QR-17 | An anonymous caller must not set prices or reach another table. |
| ☐ | TC-QR-12 | A stranger with a code must not be able to start cooking. |
| ☐ | TC-QR-08 | If the printed code does not scan, the feature does not exist. |
| ☐ | TC-BILL-04 | An order must never be paid twice. |
| ☐ | TC-EDGE-09 | A price change must never rewrite a bill somebody agreed to. |
| ☐ | TC-RES-06 | Seating must never occupy a table. Two answers double-books a floor. |
| ☐ | TC-REC-08 | Stock must move exactly once, at kitchen submission. |
| ☐ | TC-EDGE-11 | Nothing is ever deleted. |

---

## 17. Known Limitations

These are already understood. Confirm the behaviour, note it, and do not raise it as a defect.

| Area | Limitation |
|---|---|
| Reservation times | Entered and displayed in the **device's** timezone, not the restaurant's. A manager working remotely will book an hour or more out. Reports and the service day, by contrast, do use the restaurant's timezone. (TC-RES-18) |
| Service-day boundary | Computed from a local wall-clock hour, so it is off by an hour twice a year when a daylight-saving change lands on it. (TC-EDGE-12) |
| Public routes | No rate limiting. A scripted caller with a valid token can pile lines onto a bill, bounded only by the per-request caps. (TC-QR-22) |
| QR code | The encoder is written in this repository. Unit-tested against the published specification and round-tripped, but **never verified against a physical scanner by any automated test**. TC-QR-08 is the only check that exists. |
| Empty-restaurant states | Several older manager screens still frame "no restaurant assigned" as a red error with a useless Retry, rather than the calm panel the newer screens use. (TC-SETUP-09) |
| Browser coverage | No React component has ever run in a browser under automated test. Every rendering, theming and interaction expectation in this guide is verified **only** by a human following it. |
| Pagination | None anywhere. Lists are bounded server-side (100 customers, 200 reservations, 100 orders). A restaurant that exceeds a bound silently sees a truncated list. |
| Cashier role | The role exists on a staff record and can sign in, but nothing is built for it. Overview only, by design. |
