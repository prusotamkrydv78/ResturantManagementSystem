# Frontend tests

Two layers, kept apart because they need different things to run.

## `npm test` — unit

Pure frontend logic, no backend, no network. Runs anywhere.

Currently the role-to-navigation mapping: that each role is offered the links it can
use and none it cannot, and that nothing listed as planned is ever a working link.

## `npm run test:contract` — contract

Talks to a **running API over real HTTP** and checks that every response the frontend
reads carries values the frontend can actually interpret.

This layer exists because of a specific failure. Enums were serialised as integers for
four phases while the TypeScript types declared string unions, so every comparison
against `"Ready"`, `"Completed"` or `"OrderCancelled"` silently answered false. Nothing
caught it: responses reach the app through an unchecked cast, so the compiler was
satisfied, and `npm run build` had nothing to complain about. Contract tests assert on
**values**, not types, which is the only thing that would have caught it.

### Running them

```bash
# 1. Start the API
cd backend
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/RestaurantManagement.Api

# 2. Point the tests at it and give them the super admin
cd frontend
RMS_SUPERADMIN_EMAIL=...  \
RMS_SUPERADMIN_PASSWORD=... \
npm run test:contract
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `RMS_SUPERADMIN_EMAIL` | yes | The bootstrapped super admin |
| `RMS_SUPERADMIN_PASSWORD` | yes | Its password |
| `RMS_API_URL` | no | Defaults to `http://localhost:5080` |

The credentials are the same values configured under `Bootstrap:SuperAdmin` for the
API, and are deliberately not defaulted anywhere in the repository: a working
credential in source control is a leak however local the account.

If the API is not answering, the suite fails immediately with an instruction rather
than skipping. A suite that quietly passes when it tested nothing is worse than one
that fails.

### What they touch

Each test file seeds **its own throwaway restaurant** through the real administration
endpoints — a manager, a waiter, a chef, a cashier, two tables and one orderable item.
Nothing reads or writes records that already exist, so running these against a
development database will not disturb what is in it. The seeded restaurants are left
behind; they are named `Contract <label> <suffix>` if you ever want to clear them out.

Seeding through the real endpoints is deliberate: the seed is itself a test of the
administration surface, so a broken create endpoint fails there instead of being
stepped over by a direct database write.

### Files

| File | Protects |
| --- | --- |
| `lifecycle.contract.test.ts` | One order from seating to settled, across all three roles |
| `cancellation.contract.test.ts` | The other ending, and that nothing is deleted by it |
| `authorization.contract.test.ts` | Which role reaches which surface, and restaurant isolation |
| `shapes.contract.test.ts` | Every response field the screens read, value by value |
| `hardening.contract.test.ts` | The states around the happy path: empty, deactivated, conflicting |
| `settings.contract.test.ts` | The restaurant timezone and where the service day starts |
| `receipts.contract.test.ts` | What a settled order produces, and what an open one must not |
| `reports.contract.test.ts` | The takings, read in the restaurant own calendar |
| `inventory.contract.test.ts` | Stock, recipes, and the ledger behind a balance |
| `customers.contract.test.ts` | The customer book, and that a phone number means one restaurant |
| `reservations.contract.test.ts` | Bookings, clashes, and that seating never occupies a table |
| `qr-ordering.contract.test.ts` | What a stranger holding a table code can and cannot reach |
