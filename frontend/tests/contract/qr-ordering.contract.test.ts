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
  first,
  only,
} from "./support/expect";

/**
 * Ordering from the code on a table, over the wire.
 *
 * This is the only surface in the product that answers a caller with no account, so it
 * is the only one where the tests have to be about what a stranger can reach. The token
 * in the link is the entire credential, and everything below is a way of asking whether
 * it grants exactly one table and nothing else: not a second table, not another
 * restaurant, not the bill of a party a waiter is serving, and not a way to find out
 * which tokens exist by trying them.
 *
 * The other thing worth pinning is what a guest order is. It is an ordinary order on an
 * ordinary table, marked as having come from a scan, and it does not reach the kitchen
 * by itself. Stock leaves the shelf at kitchen submission and nowhere else, so somebody
 * holding a photograph of a code must not be able to put food on a stove.
 */

interface TablePayload {
  id: string;
  name: string;
  capacity: number;
  status: string;
  isActive: boolean;
  isOrderingEnabled: boolean;
  publicOrderingToken: string;
}

interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

interface PublicOrderPayload {
  orderNumber: number;
  lines: {
    itemName: string;
    quantity: number;
    note: string | null;
    lineTotal: number;
    isSentToKitchen: boolean;
  }[];
  itemCount: number;
  subtotal: number;
  awaitingKitchenCount: number;
  placedAtUtc: string;
}

interface PublicTablePayload {
  restaurantName: string;
  tableName: string;
  canOrder: boolean;
  unavailableReason: string | null;
  menu: { name: string; items: PublicMenuItem[] }[];
  currentOrder: PublicOrderPayload | null;
}

interface OrderSummaryPayload {
  id: string;
  orderNumber: number;
  tableName: string;
  createdByName: string;
  unsubmittedItemCount: number;
  kitchenTicketCount: number;
  subtotal: number;
}

let seeded: Seeded;
let other: Seeded;

beforeAll(async () => {
  await requireApi();

  seeded = await seedRestaurant("qr");
  other = await seedRestaurant("qr-other");
});

describe("ordering tokens", () => {
  it("gives every table a token, with guest ordering off", async () => {
    // A token from the moment the table exists, so a manager who decides months later
    // to put codes out has nothing to set up. Switched off, because holding a token is
    // not the same as inviting the public.
    const table = await addTable("Fresh");

    expectText(table.publicOrderingToken, "table.publicOrderingToken");
    expect(table.publicOrderingToken).toHaveLength(32);
    expect(table.isOrderingEnabled).toBe(false);
  });

  it("gives every table a different token", async () => {
    const tables = await seeded.manager.get<TablePayload[]>("/api/tables");
    const tokens = new Set(tables.map((table) => table.publicOrderingToken));

    expect(tokens.size).toBe(tables.length);
  });

  it("shows a token only to the manager who owns the table", async () => {
    const table = await addTable("Private");

    const foreign = await other.manager.attempt("GET", `/api/tables/${table.id}`);

    expect(foreign.status).toBe(404);

    const theirTables = await other.manager.get<TablePayload[]>("/api/tables");

    expect(
      theirTables.some((row) => row.publicOrderingToken === table.publicOrderingToken),
    ).toBe(false);
  });

  it("keeps the token away from staff and from anonymous callers", async () => {
    for (const [label, caller] of [
      ["waiter", seeded.waiter],
      ["chef", seeded.chef],
    ] as const) {
      const tables = await caller.attempt("GET", "/api/tables");

      expect(tables.status, `${label} reading the table list`).toBe(403);
    }

    expect((await guest.attempt("GET", "/api/tables")).status).toBe(401);
  });
});

describe("resolving a scanned link", () => {
  it("refuses a switched-off table the same way it refuses nonsense", async () => {
    // Every way of failing looks identical from outside. A different answer per case
    // would let anybody map a restaurant tables by trying links.
    const table = await addTable("Switched Off");

    const off = await guest.attempt(
      "GET",
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    const nonsense = await guest.attempt("GET", "/api/public/tables/not-a-real-token");

    const wellFormedButUnknown = await guest.attempt(
      "GET",
      `/api/public/tables/${"a".repeat(32)}`,
    );

    expect(off.status).toBe(404);
    expect(nonsense.status).toBe(404);
    expect(wellFormedButUnknown.status).toBe(404);

    expect(detailOf(off.body)).toBe(detailOf(nonsense.body));
    expect(detailOf(off.body)).toBe(detailOf(wellFormedButUnknown.body));
  });

  it("refuses a token of the wrong shape without asking the database", async () => {
    for (const token of [
      "A".repeat(32),
      "0".repeat(32),
      `${"a".repeat(31)}!`,
      "a".repeat(31),
      "a".repeat(33),
    ]) {
      const attempt = await guest.attempt(
        "GET",
        `/api/public/tables/${encodeURIComponent(token)}`,
      );

      expect(attempt.status, `token ${token.slice(0, 6)}…`).toBe(404);
    }
  });

  it("refuses a table that has been withdrawn from service", async () => {
    const table = await addTable("Withdrawn");

    await enableOrdering(table.id);
    await seeded.manager.put(`/api/tables/${table.id}/status`, { isActive: false });

    const attempt = await guest.attempt(
      "GET",
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    expect(attempt.status).toBe(404);
  });

  it("returns the table, the restaurant and the menu once switched on", async () => {
    const table = await addTable("Open For Guests");
    const enabled = await enableOrdering(table.id);

    expect(enabled.isOrderingEnabled).toBe(true);

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    expectKeys(
      scanned,
      [
        "restaurantName",
        "tableName",
        "canOrder",
        "unavailableReason",
        "menu",
        "currentOrder",
      ],
      "a scanned table",
    );

    expectText(scanned.restaurantName, "public.restaurantName");
    expectText(scanned.tableName, "public.tableName");
    expectFlag(scanned.canOrder, "public.canOrder");
    expectNullable(scanned.unavailableReason, "public.unavailableReason", expectText);

    expect(scanned.restaurantName).toBe(seeded.restaurantName);
    expect(scanned.tableName).toBe(table.name);
    expect(scanned.canOrder).toBe(true);
    expect(scanned.unavailableReason).toBeNull();
    expect(scanned.currentOrder).toBeNull();

    const section = first(scanned.menu, "the public menu");
    const item = first(section.items, "the items in a menu section");

    expectText(item.id, "public menu item.id");
    expectText(item.name, "public menu item.name");
    expectNumber(item.price, "public menu item.price");
    expectNullable(item.description, "public menu item.description", expectText);

    expect(item.price).toBe(seeded.itemPrice);
  });

  it("shows nothing of the restaurant beyond its name and the menu", async () => {
    // A public page has no business carrying identifiers. Everything a guest does goes
    // through the token, so there is nothing here for a scraper to pivot on.
    const table = await addTable("No Ids");
    await enableOrdering(table.id);

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    const serialised = JSON.stringify(scanned);

    expect(serialised).not.toContain(seeded.restaurantId);
    expect(serialised).not.toContain(table.id);
    expect(serialised).not.toContain(table.publicOrderingToken);
    expect(serialised).not.toContain(seeded.categoryId);
  });

  it("resolves each token to its own table and no other", async () => {
    // Tokens are unique across the platform, so a link can only ever land on the table
    // it was issued for. Checked because a lookup that filtered on anything else could
    // quietly make two tables share a link.
    const ours = await addTable("Ours");
    await enableOrdering(ours.id);

    const theirs = await other.manager.post<TablePayload>("/api/tables", {
      name: `Theirs ${Date.now().toString(36)}`,
      capacity: 2,
    });

    await other.manager.put(`/api/tables/${theirs.id}/ordering`, {
      isOrderingEnabled: true,
    });

    const scannedOurs = await guest.get<PublicTablePayload>(
      `/api/public/tables/${ours.publicOrderingToken}`,
    );

    const scannedTheirs = await guest.get<PublicTablePayload>(
      `/api/public/tables/${theirs.publicOrderingToken}`,
    );

    expect(scannedOurs.restaurantName).toBe(seeded.restaurantName);
    expect(scannedTheirs.restaurantName).toBe(other.restaurantName);
    expect(scannedOurs.tableName).toBe(ours.name);
    expect(scannedTheirs.tableName).toBe(theirs.name);
  });

  it("stops the old link working when a new code is issued", async () => {
    const table = await addTable("Reprinted");
    await enableOrdering(table.id);

    const old = table.publicOrderingToken;

    expect((await guest.attempt("GET", `/api/public/tables/${old}`)).status).toBe(200);

    const reissued = await seeded.manager.post<TablePayload>(
      `/api/tables/${table.id}/ordering/token`,
    );

    expect(reissued.publicOrderingToken).not.toBe(old);
    expect(reissued.isOrderingEnabled).toBe(true);

    expect((await guest.attempt("GET", `/api/public/tables/${old}`)).status).toBe(404);
    expect(await statusOfScan(reissued.publicOrderingToken)).toBe(200);
  });

  it("leaves the token alone when ordering is switched off and on again", async () => {
    // Switching off for the evening must not mean reprinting the cards on every table.
    const table = await addTable("Off And On");
    await enableOrdering(table.id);

    const switchedOff = await seeded.manager.put<TablePayload>(
      `/api/tables/${table.id}/ordering`,
      { isOrderingEnabled: false },
    );

    expect(switchedOff.publicOrderingToken).toBe(table.publicOrderingToken);
    expect(await statusOfScan(table.publicOrderingToken)).toBe(404);

    const switchedOn = await enableOrdering(table.id);

    expect(switchedOn.publicOrderingToken).toBe(table.publicOrderingToken);
    expect(await statusOfScan(table.publicOrderingToken)).toBe(200);
  });

  it("refuses to switch ordering on for another restaurant table", async () => {
    const theirs = await other.manager.post<TablePayload>("/api/tables", {
      name: `Not Ours ${Date.now().toString(36)}`,
      capacity: 2,
    });

    const switchOn = await seeded.manager.attempt(
      "PUT",
      `/api/tables/${theirs.id}/ordering`,
      { isOrderingEnabled: true },
    );

    const reissue = await seeded.manager.attempt(
      "POST",
      `/api/tables/${theirs.id}/ordering/token`,
    );

    expect(switchOn.status).toBe(404);
    expect(reissue.status).toBe(404);

    const untouched = await other.manager.get<TablePayload>(`/api/tables/${theirs.id}`);

    expect(untouched.isOrderingEnabled).toBe(false);
    expect(untouched.publicOrderingToken).toBe(theirs.publicOrderingToken);
  });
});

describe("placing a guest order", () => {
  it("opens an ordinary order, priced by the server, and occupies the table", async () => {
    const table = await addTable("First Order");
    await enableOrdering(table.id);

    const placed = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 2, note: "No ice" }] },
    );

    expectKeys(
      placed,
      [
        "orderNumber",
        "lines",
        "itemCount",
        "subtotal",
        "awaitingKitchenCount",
        "placedAtUtc",
      ],
      "a guest order",
    );

    expectNumber(placed.orderNumber, "publicOrder.orderNumber");
    expectNumber(placed.subtotal, "publicOrder.subtotal");
    expectNumber(placed.itemCount, "publicOrder.itemCount");
    expectNumber(placed.awaitingKitchenCount, "publicOrder.awaitingKitchenCount");
    expectInstant(placed.placedAtUtc, "publicOrder.placedAtUtc");

    expect(placed.itemCount).toBe(2);
    expect(placed.subtotal).toBe(seeded.itemPrice * 2);

    const line = first(placed.lines, "the lines of a guest order");

    expect(line.itemName).toBe(seeded.itemName);
    expect(line.quantity).toBe(2);
    expect(line.note).toBe("No ice");
    expect(line.isSentToKitchen).toBe(false);

    // Occupied the way a waiter order occupies a table, because it is the same ordering
    // system rather than a second one.
    const occupied = await seeded.manager.get<TablePayload>(`/api/tables/${table.id}`);

    expect(occupied.status).toBe("Occupied");
  });

  it("ignores any price sent with the order", async () => {
    // The server prices from its own menu. A guest who edits the request gets the menu
    // price regardless, which is the same rule the waiter path follows.
    const table = await addTable("Cannot Haggle");
    await enableOrdering(table.id);

    const placed = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      {
        items: [
          { menuItemId: seeded.itemId, quantity: 1, price: 0.01, unitPrice: 0.01 },
        ],
        subtotal: 0.01,
      },
    );

    expect(placed.subtotal).toBe(seeded.itemPrice);
  });

  it("shows the guest their own order when they scan again", async () => {
    const table = await addTable("Scan Again");
    await enableOrdering(table.id);

    await guest.post(`/api/public/tables/${table.publicOrderingToken}/orders`, {
      items: [{ menuItemId: seeded.itemId, quantity: 1 }],
    });

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    expect(scanned.currentOrder).not.toBeNull();
    expect(scanned.currentOrder?.itemCount).toBe(1);
    expect(scanned.canOrder).toBe(true);
  });

  it("adds a second round to the same bill rather than opening another", async () => {
    const table = await addTable("Second Round");
    await enableOrdering(table.id);

    const firstRound = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    const secondRound = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 2 }] },
    );

    expect(secondRound.orderNumber).toBe(firstRound.orderNumber);
    expect(secondRound.itemCount).toBe(3);
    expect(secondRound.subtotal).toBe(seeded.itemPrice * 3);

    // One order on the table, not two. A party leaving with two bills would be the
    // clearest sign this had become a separate ordering system.
    const open = await seeded.waiter.get<OrderSummaryPayload[]>("/api/waiter/orders");
    const onThisTable = open.filter((order) => order.tableName === table.name);

    expect(onThisTable).toHaveLength(1);
  });

  it("refuses more of one thing than the per-line cap, however it is split", async () => {
    const table = await addTable("Cap");
    await enableOrdering(table.id);

    const refused = await guest.attempt(
      "POST",
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      {
        items: [
          { menuItemId: seeded.itemId, quantity: 60 },
          { menuItemId: seeded.itemId, quantity: 60 },
        ],
      },
    );

    expect(refused.status).toBe(409);
  });

  it("refuses an empty order", async () => {
    const table = await addTable("Empty");
    await enableOrdering(table.id);

    const refused = await guest.attempt(
      "POST",
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [] },
    );

    expect(refused.status).toBe(400);
  });

  it("refuses an item from another restaurant menu", async () => {
    const table = await addTable("Foreign Item");
    await enableOrdering(table.id);

    const refused = await guest.attempt(
      "POST",
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: other.itemId, quantity: 1 }] },
    );

    expect(refused.status).toBe(409);
  });

  it("refuses to order through a link that does not resolve", async () => {
    const refused = await guest.attempt(
      "POST",
      `/api/public/tables/${"b".repeat(32)}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    expect(refused.status).toBe(404);
  });
});

describe("guest orders and the rest of the product", () => {
  it("reaches the waiter workspace as a guest order waiting to be sent", async () => {
    // Nothing on the public routes talks to the kitchen. Stock leaves the shelf at
    // submission, and somebody holding a photograph of a code must not be able to put
    // food on a stove.
    const table = await addTable("Waiting To Be Sent");
    await enableOrdering(table.id);

    const placed = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 3 }] },
    );

    expect(placed.awaitingKitchenCount).toBe(3);

    const open = await seeded.waiter.get<OrderSummaryPayload[]>("/api/waiter/orders");
    const mine = only(
      open,
      (order) => order.orderNumber === placed.orderNumber,
      "the guest order in the waiter workspace",
    );

    expect(mine.kitchenTicketCount).toBe(0);
    expect(mine.unsubmittedItemCount).toBe(3);

    // Attributed to nobody, because nobody placed it. Naming a member of staff would be
    // a lie that turns up later in somebody report.
    expectText(mine.createdByName, "order.createdByName");
    expect(mine.createdByName).toBe("Guest at the table");
  });

  it("goes to the kitchen through the existing submission, not on its own", async () => {
    const table = await addTable("Sent By Staff");
    await enableOrdering(table.id);

    const placed = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    const mine = await waiterOrderNumbered(placed.orderNumber);

    await seeded.waiter.post(`/api/waiter/orders/${mine.id}/kitchen-tickets`);

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    expect(scanned.currentOrder?.awaitingKitchenCount).toBe(0);

    const line = first(
      scanned.currentOrder?.lines ?? [],
      "the lines after submission",
    );

    expect(line.isSentToKitchen).toBe(true);
  });

  it("hands the table back to staff while a waiter is serving it", async () => {
    // Self-service and table service on the same bill at the same time would mean two
    // people editing one order, so the person physically there wins.
    const table = await addTable("Staff Serving");
    await enableOrdering(table.id);

    await seeded.waiter.post("/api/waiter/orders", {
      tableId: table.id,
      items: [{ menuItemId: seeded.itemId, quantity: 1 }],
    });

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    expect(scanned.canOrder).toBe(false);
    expectText(scanned.unavailableReason ?? "", "public.unavailableReason");

    // And the staff order is not shown through a public link: that bill is not the
    // guest own to read.
    expect(scanned.currentOrder).toBeNull();

    const refused = await guest.attempt(
      "POST",
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    expect(refused.status).toBe(409);
  });

  it("lets the next party order once the previous bill is settled", async () => {
    const table = await addTable("Next Party");
    await enableOrdering(table.id);

    const placed = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    const mine = await waiterOrderNumbered(placed.orderNumber);

    // Through the kitchen and then paid, which is the only route to a closed order.
    await seeded.waiter.post(`/api/waiter/orders/${mine.id}/kitchen-tickets`);

    const tickets = await seeded.chef.get<{ id: string; orderNumber: number }[]>(
      "/api/kitchen/tickets",
    );

    const ticket = only(
      tickets,
      (row) => row.orderNumber === placed.orderNumber,
      "the kitchen ticket for the guest order",
    );

    await seeded.chef.put(`/api/kitchen/tickets/${ticket.id}/start`);
    await seeded.chef.put(`/api/kitchen/tickets/${ticket.id}/ready`);

    await seeded.manager.post(`/api/billing/orders/${mine.id}/payment`, {
      method: "Cash",
    });

    const scanned = await guest.get<PublicTablePayload>(
      `/api/public/tables/${table.publicOrderingToken}`,
    );

    // A fresh table for the next party: the previous bill is gone and ordering is open
    // again.
    expect(scanned.currentOrder).toBeNull();
    expect(scanned.canOrder).toBe(true);

    const nextParty = await guest.post<PublicOrderPayload>(
      `/api/public/tables/${table.publicOrderingToken}/orders`,
      { items: [{ menuItemId: seeded.itemId, quantity: 1 }] },
    );

    expect(nextParty.orderNumber).not.toBe(placed.orderNumber);
  });
});

/* ------------------------------------------------------------------- Helpers */

/** A fresh table, so no test inherits the state another left on a shared one. */
async function addTable(label: string): Promise<TablePayload> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

  // A table name is capped at 32 characters, so the label is trimmed rather than
  // allowed to fail validation for a reason that has nothing to do with the test.
  return seeded.manager.post<TablePayload>("/api/tables", {
    name: `${label} ${suffix}`.slice(0, 32),
    capacity: 4,
  });
}

async function enableOrdering(tableId: string): Promise<TablePayload> {
  return seeded.manager.put<TablePayload>(`/api/tables/${tableId}/ordering`, {
    isOrderingEnabled: true,
  });
}

async function statusOfScan(token: string): Promise<number> {
  return (await guest.attempt("GET", `/api/public/tables/${token}`)).status;
}

/** The guest order as the waiter workspace sees it, which is where its id lives. */
async function waiterOrderNumbered(orderNumber: number): Promise<OrderSummaryPayload> {
  const open = await seeded.waiter.get<OrderSummaryPayload[]>("/api/waiter/orders");

  return only(
    open,
    (order) => order.orderNumber === orderNumber,
    `the guest order numbered ${orderNumber}`,
  );
}

function detailOf(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return String(body);
  }

  return (body as { detail?: string }).detail ?? "";
}
