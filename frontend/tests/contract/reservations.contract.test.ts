import { beforeAll, describe, expect, it } from "vitest";
import { guest, requireApi } from "./support/client";
import { seedRestaurant, type Seeded } from "./support/seed";
import {
  expectFlag,
  expectInstant,
  expectKeys,
  expectNullable,
  expectNumber,
  expectText,
  expectUnion,
  only,
} from "./support/expect";
import { RESERVATION_STATUSES, TABLE_STATUSES } from "./support/unions";

/**
 * The reservation board, over the wire.
 *
 * The status is the field most worth checking: every action on the board is gated on a
 * flag the server sends, and those flags are derived from the status. An enum arriving
 * as a number would leave every `can…` correct and every badge blank, which is exactly
 * the failure this suite exists to catch.
 *
 * The other thing tested here is the one rule the whole module is built around: seating
 * a party records that they arrived and does not make a table occupied. An order does
 * that. Two systems both claiming to know whether a table is free is how a floor gets
 * double-booked, so the test asserts the table is untouched rather than trusting the
 * code not to touch it.
 */

interface ReservationPayload {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  reservedForUtc: string;
  durationMinutes: number;
  endsAtUtc: string;
  guestCount: number;
  tableId: string | null;
  tableName: string | null;
  tableCapacity: number | null;
  status: string;
  notes: string | null;
  cancellationReason: string | null;
  canConfirm: boolean;
  canSeat: boolean;
  canComplete: boolean;
  canCancel: boolean;
  isEditable: boolean;
  createdAtUtc: string;
}

interface BoardPayload {
  reservations: ReservationPayload[];
  todayCount: number;
  upcomingCount: number;
  seatedCount: number;
  todayGuestCount: number;
}

interface TablePayload {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  isOrderingEnabled: boolean;
  publicOrderingToken: string;
}

const RESERVATION_KEYS = [
  "id",
  "customerId",
  "customerName",
  "customerPhone",
  "reservedForUtc",
  "durationMinutes",
  "endsAtUtc",
  "guestCount",
  "tableId",
  "tableName",
  "tableCapacity",
  "status",
  "notes",
  "cancellationReason",
  "canConfirm",
  "canSeat",
  "canComplete",
  "canCancel",
  "isEditable",
  "createdAtUtc",
] as const;

let seeded: Seeded;
let other: Seeded;
let customerId: string;
let otherCustomerId: string;

beforeAll(async () => {
  await requireApi();

  seeded = await seedRestaurant("reservations");
  other = await seedRestaurant("reservations-other");

  customerId = (
    await seeded.manager.post<{ id: string }>("/api/customers", {
      name: "Booking Customer",
      phone: "+44 7700 900222",
    })
  ).id;

  otherCustomerId = (
    await other.manager.post<{ id: string }>("/api/customers", {
      name: "Elsewhere Customer",
    })
  ).id;
});

describe("reservation shape", () => {
  it("returns every key the board reads, with the status as a name", async () => {
    const created = await book({ hours: 26, guests: 4, tableId: seeded.tableId });

    expectKeys(created, RESERVATION_KEYS, "a created reservation");

    expectText(created.id, "reservation.id");
    expectText(created.customerName, "reservation.customerName");
    expectNullable(created.customerPhone, "reservation.customerPhone", expectText);
    expectInstant(created.reservedForUtc, "reservation.reservedForUtc");
    expectInstant(created.endsAtUtc, "reservation.endsAtUtc");
    expectNumber(created.durationMinutes, "reservation.durationMinutes");
    expectNumber(created.guestCount, "reservation.guestCount");
    expectNullable(created.tableId, "reservation.tableId", expectText);
    expectNullable(created.tableName, "reservation.tableName", expectText);
    expectNullable(created.tableCapacity, "reservation.tableCapacity", expectNumber);
    expectUnion(created.status, RESERVATION_STATUSES, "reservation.status");
    expectNullable(created.notes, "reservation.notes", expectText);
    expectNullable(
      created.cancellationReason,
      "reservation.cancellationReason",
      expectText,
    );

    for (const flag of [
      "canConfirm",
      "canSeat",
      "canComplete",
      "canCancel",
      "isEditable",
    ] as const) {
      expectFlag(created[flag], `reservation.${flag}`);
    }

    expect(created.status).toBe("Pending");
    expect(created.durationMinutes).toBe(90);

    // The hold runs from the booked time for the sitting, which is what makes
    // "overlapping" mean anything at all.
    expect(new Date(created.endsAtUtc).getTime()).toBe(
      new Date(created.reservedForUtc).getTime() + 90 * 60_000,
    );
  });

  it("returns a board with counts alongside the bookings", async () => {
    const board = await seeded.manager.get<BoardPayload>("/api/reservations");

    expectKeys(
      board,
      ["reservations", "todayCount", "upcomingCount", "seatedCount", "todayGuestCount"],
      "the reservation board",
    );

    expectNumber(board.todayCount, "board.todayCount");
    expectNumber(board.upcomingCount, "board.upcomingCount");
    expectNumber(board.seatedCount, "board.seatedCount");
    expectNumber(board.todayGuestCount, "board.todayGuestCount");
    expect(Array.isArray(board.reservations)).toBe(true);
  });

  it("takes a booking with no table decided", async () => {
    const created = await book({ hours: 27, guests: 2 });

    expect(created.tableId).toBeNull();
    expect(created.tableName).toBeNull();

    // Nowhere to seat them, so the board must not offer it. The write path checks the
    // same thing rather than trusting the button was hidden.
    expect(created.canSeat).toBe(false);
  });
});

describe("reservation clashes", () => {
  it("refuses a second booking overlapping the same table", async () => {
    const table = seeded.secondTableId;

    await book({ hours: 40, guests: 2, tableId: table });

    // Half an hour later, inside the ninety-minute sitting.
    const clash = await attemptBook({ hours: 40.5, guests: 2, tableId: table });

    expect(clash.status).toBe(409);
  });

  it("allows a booking that starts exactly when the last one ends", async () => {
    // Half open on both sides: a table freed at eight is available at eight. Anything
    // else loses a sitting every evening for no reason.
    const table = await addTable("Turn");

    await book({ hours: 50, guests: 2, tableId: table, duration: 60 });

    const next = await attemptBook({ hours: 51, guests: 2, tableId: table });

    expect(next.status).toBe(201);
  });

  it("frees the table when a clashing booking is cancelled", async () => {
    const table = await addTable("Free");

    const first = await book({ hours: 60, guests: 2, tableId: table });

    const blocked = await attemptBook({ hours: 60.5, guests: 2, tableId: table });
    expect(blocked.status).toBe(409);

    await seeded.manager.post(`/api/reservations/${first.id}/cancel`, {
      reason: "Guest called off",
    });

    const nowFree = await attemptBook({ hours: 60.5, guests: 2, tableId: table });
    expect(nowFree.status).toBe(201);
  });

  it("does not let one restaurant booking block another restaurant table", async () => {
    // The clash query is scoped to the restaurant, so a busy evening somewhere else is
    // invisible here. Testing it because a missing filter in that query would be a
    // cross-restaurant leak that looks like a scheduling bug.
    const theirTable = await other.manager.post<TablePayload>("/api/tables", {
      name: `Their Table ${Date.now().toString(36)}`,
      capacity: 2,
    });

    await other.manager.post("/api/reservations", {
      customerId: otherCustomerId,
      reservedForUtc: hoursFromNow(70),
      guestCount: 2,
      tableId: theirTable.id,
    });

    // Same instant, our own table: nothing to do with theirs.
    const ours = await attemptBook({
      hours: 70,
      guests: 2,
      tableId: await addTable("Same time"),
    });

    expect(ours.status).toBe(201);
  });
});

describe("reservation lifecycle", () => {
  it("walks pending, confirmed, seated, finished", async () => {
    const table = await addTable("Life");
    const created = await book({ hours: 80, guests: 2, tableId: table });

    expect(created.canConfirm).toBe(true);

    const confirmed = await seeded.manager.post<ReservationPayload>(
      `/api/reservations/${created.id}/confirm`,
    );

    expect(confirmed.status).toBe("Confirmed");
    expect(confirmed.canConfirm).toBe(false);
    expect(confirmed.canSeat).toBe(true);

    const seatedBooking = await seeded.manager.post<ReservationPayload>(
      `/api/reservations/${created.id}/seat`,
      {},
    );

    expect(seatedBooking.status).toBe("Seated");
    expect(seatedBooking.canComplete).toBe(true);

    // Still editable, and deliberately so: a party booked for four that arrives as
    // three is worth correcting while they are sitting there. Only a closed booking
    // locks, because that is a record of what happened.
    expect(seatedBooking.isEditable).toBe(true);

    const finished = await seeded.manager.post<ReservationPayload>(
      `/api/reservations/${created.id}/complete`,
    );

    expect(finished.status).toBe("Completed");
    expect(finished.canCancel).toBe(false);
    expect(finished.canComplete).toBe(false);
  });

  it("leaves the table exactly as it was when a party is seated", async () => {
    // The rule the whole module is built around. A booking says a table is intended for
    // somebody; an order says it is in use. Seating must not be a second opinion.
    const tableId = await addTable("Untouched");

    const before = await tableById(tableId);
    expectUnion(before.status, TABLE_STATUSES, "table.status before seating");
    expect(before.status).toBe("Available");

    const created = await book({ hours: 90, guests: 2, tableId });
    await seeded.manager.post(`/api/reservations/${created.id}/confirm`);
    await seeded.manager.post(`/api/reservations/${created.id}/seat`, {});

    const after = await tableById(tableId);

    expect(after.status).toBe("Available");

    // And the waiter opening an order is still what occupies it.
    await seeded.waiter.post("/api/waiter/orders", {
      tableId,
      items: [{ menuItemId: seeded.itemId, quantity: 1 }],
    });

    const occupied = await tableById(tableId);

    expect(occupied.status).toBe("Occupied");
  });

  it("refuses to seat a booking with no table decided", async () => {
    const created = await book({ hours: 95, guests: 2 });

    await seeded.manager.post(`/api/reservations/${created.id}/confirm`);

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/reservations/${created.id}/seat`,
      {},
    );

    expect(refused.status).toBe(409);
  });

  it("seats a party onto the table they were actually shown to", async () => {
    const booked = await addTable("Booked");
    const actual = await addTable("Actual");

    const created = await book({ hours: 100, guests: 2, tableId: booked });

    const seatedBooking = await seeded.manager.post<ReservationPayload>(
      `/api/reservations/${created.id}/seat`,
      { tableId: actual },
    );

    expect(seatedBooking.status).toBe("Seated");
    expect(seatedBooking.tableId).toBe(actual);
  });

  it("refuses the same step twice", async () => {
    const created = await book({ hours: 110, guests: 2 });

    await seeded.manager.post(`/api/reservations/${created.id}/confirm`);

    const again = await seeded.manager.attempt(
      "POST",
      `/api/reservations/${created.id}/confirm`,
    );

    expect(again.status).toBe(409);
  });

  it("keeps a cancelled booking, with its reason, rather than deleting it", async () => {
    const created = await book({ hours: 120, guests: 3 });

    const cancelled = await seeded.manager.post<ReservationPayload>(
      `/api/reservations/${created.id}/cancel`,
      { reason: "Double booked themselves" },
    );

    expect(cancelled.status).toBe("Cancelled");
    expect(cancelled.cancellationReason).toBe("Double booked themselves");
    expect(cancelled.isEditable).toBe(false);

    // Still readable, and still on the board when asked for.
    const board = await seeded.manager.get<BoardPayload>(
      "/api/reservations?includeClosed=true",
    );

    only(board.reservations, (row) => row.id === created.id, "the cancelled booking");
  });

  it("refuses to edit a booking that has closed", async () => {
    const created = await book({ hours: 130, guests: 2 });

    await seeded.manager.post(`/api/reservations/${created.id}/cancel`, {});

    const edit = await seeded.manager.attempt(
      "PUT",
      `/api/reservations/${created.id}`,
      { reservedForUtc: hoursFromNow(131), guestCount: 4 },
    );

    expect(edit.status).toBe(409);
  });
});

describe("reservation isolation", () => {
  it("refuses a customer from another restaurant, as though they did not exist", async () => {
    const foreign = await seeded.manager.attempt("POST", "/api/reservations", {
      customerId: otherCustomerId,
      reservedForUtc: hoursFromNow(140),
      guestCount: 2,
    });

    const invented = await seeded.manager.attempt("POST", "/api/reservations", {
      customerId: "00000000-0000-0000-0000-000000000000",
      reservedForUtc: hoursFromNow(140),
      guestCount: 2,
    });

    expect(foreign.status).toBe(404);
    expect(invented.status).toBe(404);
    expect(detailOf(foreign.body)).toBe(detailOf(invented.body));
  });

  it("refuses a table from another restaurant", async () => {
    const refused = await seeded.manager.attempt("POST", "/api/reservations", {
      customerId,
      reservedForUtc: hoursFromNow(150),
      guestCount: 2,
      tableId: other.tableId,
    });

    expect(refused.status).toBe(409);
  });

  it("refuses a table that is out of service", async () => {
    const withdrawn = await addTable("Withdrawn");

    await seeded.manager.put(`/api/tables/${withdrawn}/status`, { isActive: false });

    const refused = await seeded.manager.attempt("POST", "/api/reservations", {
      customerId,
      reservedForUtc: hoursFromNow(160),
      guestCount: 2,
      tableId: withdrawn,
    });

    expect(refused.status).toBe(409);
  });

  it("hides another restaurant booking exactly as it hides a made-up one", async () => {
    const theirs = await other.manager.post<ReservationPayload>("/api/reservations", {
      customerId: otherCustomerId,
      reservedForUtc: hoursFromNow(170),
      guestCount: 2,
    });

    const foreign = await seeded.manager.attempt(
      "GET",
      `/api/reservations/${theirs.id}`,
    );

    const invented = await seeded.manager.attempt(
      "GET",
      "/api/reservations/00000000-0000-0000-0000-000000000000",
    );

    expect(foreign.status).toBe(404);
    expect(invented.status).toBe(404);
    expect(detailOf(foreign.body)).toBe(detailOf(invented.body));

    const board = await seeded.manager.get<BoardPayload>(
      "/api/reservations?includeClosed=true",
    );

    expect(board.reservations.some((row) => row.id === theirs.id)).toBe(false);
  });

  it("refuses to move another restaurant booking along", async () => {
    const theirs = await other.manager.post<ReservationPayload>("/api/reservations", {
      customerId: otherCustomerId,
      reservedForUtc: hoursFromNow(180),
      guestCount: 2,
    });

    for (const step of ["confirm", "seat", "complete", "cancel"] as const) {
      const attempt = await seeded.manager.attempt(
        "POST",
        `/api/reservations/${theirs.id}/${step}`,
        {},
      );

      expect(attempt.status, `${step} on somebody else booking`).toBe(404);
    }

    const untouched = await other.manager.get<ReservationPayload>(
      `/api/reservations/${theirs.id}`,
    );

    expect(untouched.status).toBe("Pending");
  });

  it("keeps the board away from staff and from anonymous callers", async () => {
    for (const [label, caller] of [
      ["waiter", seeded.waiter],
      ["chef", seeded.chef],
    ] as const) {
      const board = await caller.attempt("GET", "/api/reservations");

      expect(board.status, `${label} reading the board`).toBe(403);
    }

    const anonymous = await guest.attempt("GET", "/api/reservations");

    expect(anonymous.status).toBe(401);
  });
});

describe("reservation validation", () => {
  it("refuses a party of nobody and a party of hundreds", async () => {
    for (const guests of [0, 500]) {
      const refused = await seeded.manager.attempt("POST", "/api/reservations", {
        customerId,
        reservedForUtc: hoursFromNow(190),
        guestCount: guests,
      });

      expect(refused.status, `a party of ${guests}`).toBe(400);
    }
  });

  it("refuses a sitting shorter than a quarter of an hour", async () => {
    const refused = await seeded.manager.attempt("POST", "/api/reservations", {
      customerId,
      reservedForUtc: hoursFromNow(200),
      guestCount: 2,
      durationMinutes: 5,
    });

    expect(refused.status).toBe(400);
  });
});

/* ------------------------------------------------------------------- Helpers */

async function book(options: {
  hours: number;
  guests: number;
  tableId?: string;
  duration?: number;
}): Promise<ReservationPayload> {
  return seeded.manager.post<ReservationPayload>("/api/reservations", {
    customerId,
    reservedForUtc: hoursFromNow(options.hours),
    guestCount: options.guests,
    tableId: options.tableId ?? null,
    durationMinutes: options.duration ?? null,
  });
}

async function attemptBook(options: {
  hours: number;
  guests: number;
  tableId?: string;
  duration?: number;
}): Promise<{ status: number; body: unknown }> {
  return seeded.manager.attempt("POST", "/api/reservations", {
    customerId,
    reservedForUtc: hoursFromNow(options.hours),
    guestCount: options.guests,
    tableId: options.tableId ?? null,
    durationMinutes: options.duration ?? null,
  });
}

/**
 * A fresh table, so a clash test cannot be tripped up by a booking another test left
 * on a shared one.
 */
async function addTable(label: string): Promise<string> {
  // A table name is capped at 32 characters, so the label is kept short and the suffix
  // is what makes it unique across runs against the same database.
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

  const created = await seeded.manager.post<TablePayload>("/api/tables", {
    name: `${label} ${suffix}`.slice(0, 32),
    capacity: 4,
  });

  return created.id;
}

async function tableById(id: string): Promise<TablePayload> {
  return seeded.manager.get<TablePayload>(`/api/tables/${id}`);
}

function detailOf(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return String(body);
  }

  return (body as { detail?: string }).detail ?? "";
}

/** An instant a given number of hours from now. Fractions are allowed. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}
