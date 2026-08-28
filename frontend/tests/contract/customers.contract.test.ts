import { beforeAll, describe, expect, it } from "vitest";
import { guest, requireApi } from "./support/client";
import {
  seedRestaurant,
  seedUnassignedManager,
  type Seeded,
} from "./support/seed";
import {
  expectFlag,
  expectInstant,
  expectKeys,
  expectNullable,
  expectNumber,
  expectText,
  only,
} from "./support/expect";

/**
 * The customer book, over the wire.
 *
 * Two things are worth testing here and neither is visible to a compiler. The first is
 * the shape: every key the customer screens read has to arrive, including the ones that
 * are legitimately null, because the frontend narrows those with `!== null` and a
 * missing key sails straight through that check.
 *
 * The second is isolation, which is the whole reason a customer belongs to a restaurant
 * rather than to the platform. A phone number is unique inside one restaurant and says
 * nothing about another, and a customer id from somewhere else has to be as unfindable
 * as one that was never issued.
 */

interface CustomerPayload {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  orderCount: number;
  reservationCount: number;
  lastVisitAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface CustomerDetailPayload {
  customer: CustomerPayload;
  orders: unknown[];
  reservations: unknown[];
}

const CUSTOMER_KEYS = [
  "id",
  "name",
  "phone",
  "email",
  "notes",
  "isActive",
  "orderCount",
  "reservationCount",
  "lastVisitAtUtc",
  "createdAtUtc",
  "updatedAtUtc",
] as const;

let seeded: Seeded;
let other: Seeded;

beforeAll(async () => {
  await requireApi();

  // Two restaurants, because half of what matters here is what one cannot see of the
  // other. Sequential rather than parallel: the seed creates through the real
  // endpoints, and two runs interleaving would make a failure hard to read.
  seeded = await seedRestaurant("customers");
  other = await seedRestaurant("customers-other");
});

describe("customer shape", () => {
  it("returns every key the screens read, including the null ones", async () => {
    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Priya Raman",
      phone: "+44 7700 900111",
    });

    expectKeys(created, CUSTOMER_KEYS, "a created customer");

    expectText(created.id, "customer.id");
    expectText(created.name, "customer.name");
    expectNullable(created.phone, "customer.phone", expectText);
    // Given no email and no notes, so these must arrive as null rather than be absent.
    expectNullable(created.email, "customer.email", expectText);
    expectNullable(created.notes, "customer.notes", expectText);
    expectFlag(created.isActive, "customer.isActive");
    expectNumber(created.orderCount, "customer.orderCount");
    expectNumber(created.reservationCount, "customer.reservationCount");
    expectNullable(created.lastVisitAtUtc, "customer.lastVisitAtUtc", expectInstant);
    expectInstant(created.createdAtUtc, "customer.createdAtUtc");

    expect(created.email).toBeNull();
    expect(created.isActive).toBe(true);
    expect(created.orderCount).toBe(0);
    expect(created.reservationCount).toBe(0);
    expect(created.lastVisitAtUtc).toBeNull();
  });

  it("returns a customer with both histories present, even when empty", async () => {
    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Detail Subject",
    });

    const detail = await seeded.manager.get<CustomerDetailPayload>(
      `/api/customers/${created.id}`,
    );

    expectKeys(detail, ["customer", "orders", "reservations"], "customer detail");
    expect(Array.isArray(detail.orders)).toBe(true);
    expect(Array.isArray(detail.reservations)).toBe(true);
    expect(detail.customer.id).toBe(created.id);
  });

  it("finds a customer by name and by phone", async () => {
    const phone = `+44 7700 9${Date.now().toString().slice(-5)}`;

    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Searchable Person",
      phone,
    });

    const byName = await seeded.manager.get<CustomerPayload[]>(
      "/api/customers?search=Searchable",
    );

    const byPhone = await seeded.manager.get<CustomerPayload[]>(
      `/api/customers?search=${encodeURIComponent(phone.slice(-5))}`,
    );

    only(byName, (customer) => customer.id === created.id, "the customer by name");
    only(byPhone, (customer) => customer.id === created.id, "the customer by phone");
  });
});

describe("customer isolation", () => {
  it("refuses a duplicate phone number inside one restaurant", async () => {
    const phone = `+44 7700 8${Date.now().toString().slice(-5)}`;

    await seeded.manager.post("/api/customers", { name: "First Holder", phone });

    const clash = await seeded.manager.attempt("POST", "/api/customers", {
      name: "Second Holder",
      phone,
    });

    expect(clash.status).toBe(409);
  });

  it("lets two restaurants hold the same phone number", async () => {
    // The number identifies a person to one restaurant. It is not a platform identity,
    // and treating it as one would leak the fact that somebody eats somewhere else.
    const phone = `+44 7700 7${Date.now().toString().slice(-5)}`;

    await seeded.manager.post("/api/customers", { name: "Shared Number", phone });

    const elsewhere = await other.manager.attempt("POST", "/api/customers", {
      name: "Shared Number",
      phone,
    });

    expect(elsewhere.status).toBe(201);
  });

  it("lets several customers have no phone number at all", async () => {
    // Blank must not collide with blank. A walk-in who gave only a name is still worth
    // recording, and the second one must not be refused as a duplicate of the first.
    await seeded.manager.post("/api/customers", { name: "Anonymous One" });

    const second = await seeded.manager.attempt("POST", "/api/customers", {
      name: "Anonymous Two",
    });

    expect(second.status).toBe(201);
  });

  it("hides another restaurant customer exactly as it hides a made-up one", async () => {
    const theirs = await other.manager.post<CustomerPayload>("/api/customers", {
      name: "Not Yours",
    });

    const foreign = await seeded.manager.attempt("GET", `/api/customers/${theirs.id}`);
    const invented = await seeded.manager.attempt(
      "GET",
      "/api/customers/00000000-0000-0000-0000-000000000000",
    );

    expect(foreign.status).toBe(404);
    expect(invented.status).toBe(404);

    // The same status is not enough on its own: a different message would still tell a
    // caller that the id exists somewhere.
    expect(detailOf(foreign.body)).toBe(detailOf(invented.body));
  });

  it("keeps another restaurant customers out of the list", async () => {
    const theirs = await other.manager.post<CustomerPayload>("/api/customers", {
      name: "Invisible Elsewhere",
    });

    const mine = await seeded.manager.get<CustomerPayload[]>("/api/customers");

    expect(mine.some((customer) => customer.id === theirs.id)).toBe(false);
  });

  it("refuses to edit or archive another restaurant customer", async () => {
    const theirs = await other.manager.post<CustomerPayload>("/api/customers", {
      name: "Untouchable",
    });

    const edit = await seeded.manager.attempt("PUT", `/api/customers/${theirs.id}`, {
      name: "Renamed By A Stranger",
    });

    const archive = await seeded.manager.attempt(
      "PUT",
      `/api/customers/${theirs.id}/status`,
      { isActive: false },
    );

    expect(edit.status).toBe(404);
    expect(archive.status).toBe(404);

    // And nothing happened to it.
    const unchanged = await other.manager.get<CustomerDetailPayload>(
      `/api/customers/${theirs.id}`,
    );

    expect(unchanged.customer.name).toBe("Untouchable");
    expect(unchanged.customer.isActive).toBe(true);
  });

  it("tells a manager with no restaurant that there is nothing here", async () => {
    const unassigned = await seedUnassignedManager();

    const list = await unassigned.attempt("GET", "/api/customers");

    // A real account, correctly authorised, with nothing behind it. Not a 403: the
    // role is right, and the screens read this as an empty state rather than a
    // failure.
    expect(list.status).toBe(404);
  });
});

describe("customer archiving and deletion", () => {
  it("archives and restores without losing the record", async () => {
    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Comes And Goes",
    });

    const archived = await seeded.manager.put<CustomerPayload>(
      `/api/customers/${created.id}/status`,
      { isActive: false },
    );

    expect(archived.isActive).toBe(false);

    // Gone from the default list, still there when asked for.
    const defaultList = await seeded.manager.get<CustomerPayload[]>("/api/customers");
    const withArchived = await seeded.manager.get<CustomerPayload[]>(
      "/api/customers?includeInactive=true",
    );

    expect(defaultList.some((customer) => customer.id === created.id)).toBe(false);
    only(withArchived, (customer) => customer.id === created.id, "the archived customer");

    const restored = await seeded.manager.put<CustomerPayload>(
      `/api/customers/${created.id}/status`,
      { isActive: true },
    );

    expect(restored.isActive).toBe(true);
  });

  it("deletes a customer who has no history", async () => {
    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Recorded By Mistake",
    });

    const deleted = await seeded.manager.attempt(
      "DELETE",
      `/api/customers/${created.id}`,
    );

    expect(deleted.status).toBe(204);

    const gone = await seeded.manager.attempt("GET", `/api/customers/${created.id}`);

    expect(gone.status).toBe(404);
  });

  it("refuses to delete a customer with a booking against them", async () => {
    // The rule that matters: history has to survive somebody leaving, because a
    // booking pointing at a row nobody can look up loses the answer to who it was for.
    const created = await seeded.manager.post<CustomerPayload>("/api/customers", {
      name: "Has A Booking",
    });

    await seeded.manager.post("/api/reservations", {
      customerId: created.id,
      reservedForUtc: hoursFromNow(30),
      guestCount: 2,
    });

    const refused = await seeded.manager.attempt(
      "DELETE",
      `/api/customers/${created.id}`,
    );

    expect(refused.status).toBe(409);

    // Still there, and now countable.
    const detail = await seeded.manager.get<CustomerDetailPayload>(
      `/api/customers/${created.id}`,
    );

    expect(detail.customer.reservationCount).toBe(1);
    expect(detail.reservations).toHaveLength(1);
  });

  it("refuses a customer name that is nothing but space", async () => {
    const refused = await seeded.manager.attempt("POST", "/api/customers", {
      name: "   ",
    });

    expect(refused.status).toBe(400);
  });
});

describe("customer authorisation", () => {
  it("keeps the customer book away from staff", async () => {
    for (const [label, caller] of [
      ["waiter", seeded.waiter],
      ["chef", seeded.chef],    ] as const) {
      const list = await caller.attempt("GET", "/api/customers");
      const create = await caller.attempt("POST", "/api/customers", {
        name: "Should Not Exist",
      });

      expect(list.status, `${label} listing customers`).toBe(403);
      expect(create.status, `${label} creating a customer`).toBe(403);
    }
  });

  it("refuses an unauthenticated caller outright", async () => {
    // Not 404, and not an empty list: a caller with no session is turned away before
    // any question of which restaurant is even asked.
    const list = await guest.attempt("GET", "/api/customers");

    expect(list.status).toBe(401);
  });
});

/** The problem detail, for comparing one refusal against another. */
function detailOf(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return String(body);
  }

  const problem = body as { detail?: string };

  return problem.detail ?? "";
}

/** An instant a given number of hours from now, for bookings that are still to come. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}
