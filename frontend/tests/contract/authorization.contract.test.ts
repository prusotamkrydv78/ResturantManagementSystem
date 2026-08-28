import { beforeAll, describe, expect, it } from "vitest";
import { requireApi, type Caller } from "./support/client";
import { seedRestaurant, type Seeded } from "./support/seed";
import type { Order } from "@/types/order";
import type { KitchenTicket } from "@/types/kitchen";

/**
 * Who the API lets through which door, over real HTTP.
 *
 * The service layer is already covered by the backend suite. What this adds is the
 * part only a real request exercises: that the policy attributes, the claims in the
 * issued token, and the route templates all line up. A policy that names a claim the
 * token generator does not emit compiles perfectly and refuses everybody.
 *
 * Refusal is asserted by status, and the distinction matters. 403 means the door is
 * not yours; 404 means it does not exist for you, which is what a cross-restaurant
 * identifier must look like.
 */
describe("role boundaries over HTTP", () => {
  let seeded: Seeded;
  let other: Seeded;

  beforeAll(async () => {
    await requireApi();
    [seeded, other] = await Promise.all([
      seedRestaurant("AuthA"),
      seedRestaurant("AuthB"),
    ]);
  });

  /** Every operational surface, with the one role that owns it. */
  const surfaces = [
    { path: "/api/waiter/floor", owner: "waiter" },
    { path: "/api/waiter/tables", owner: "waiter" },
    { path: "/api/waiter/menu", owner: "waiter" },
    { path: "/api/waiter/orders", owner: "waiter" },
    { path: "/api/waiter/context", owner: "waiter" },
    { path: "/api/kitchen/tickets", owner: "chef" },
    { path: "/api/manager/floor", owner: "manager" },
    { path: "/api/manager/dashboard", owner: "manager" },
    { path: "/api/billing/orders", owner: "manager" },
    { path: "/api/billing/history", owner: "manager" },
    { path: "/api/tables", owner: "manager" },
    { path: "/api/menu/items", owner: "manager" },
    { path: "/api/staff", owner: "manager" },
  ] as const;

  it.each(surfaces)("$path answers its own role", async ({ path, owner }) => {
    const response = await callerFor(owner).attempt("GET", path);

    expect(response.status, `${owner} should reach ${path}`).toBe(200);
  });

  it.each(surfaces)("$path refuses every other role", async ({ path, owner }) => {
    const others = (["waiter", "chef", "manager", "cashier"] as const).filter(
      (role) => role !== owner,
    );

    for (const role of others) {
      const response = await callerFor(role).attempt("GET", path);

      expect(
        response.status,
        `${role} should not reach ${path}, got ${response.status}`,
      ).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
  });

  it("refuses every operational surface without a token", async () => {
    for (const { path } of surfaces) {
      const response = await fetch(`${process.env.RMS_API_URL ?? "http://localhost:5080"}${path}`);

      expect(response.status, `${path} should require a token`).toBe(401);
    }
  });

  it("keeps a cashier out of every operational surface", async () => {
    // The role exists on the staff record and nothing is built for it. It must not
    // inherit another role surface by default.
    for (const { path } of surfaces) {
      const response = await seeded.cashier.attempt("GET", path);

      expect(response.status, `a cashier should not reach ${path}`).toBeGreaterThanOrEqual(
        400,
      );
    }
  });

  it("hides another restaurant order behind the same not-found", async () => {
    const theirs = await other.waiter.post<Order>("/api/waiter/orders", {
      tableId: other.tableId,
      items: [{ menuItemId: other.itemId, quantity: 1 }],
    });

    const foreign = await seeded.waiter.attempt(
      "GET",
      `/api/waiter/orders/${theirs.id}`,
    );
    const invented = await seeded.waiter.attempt(
      "GET",
      "/api/waiter/orders/00000000-0000-0000-0000-000000000001",
    );

    // Identical, or probing identifiers becomes a way to map another restaurant.
    expect(foreign.status).toBe(404);
    expect(invented.status).toBe(404);
  });

  it("refuses to settle another restaurant order", async () => {
    const theirs = await other.waiter.post<Order>("/api/waiter/orders", {
      tableId: other.secondTableId,
      items: [{ menuItemId: other.itemId, quantity: 1 }],
    });

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${theirs.id}/payment`,
      { method: "Cash" },
    );

    expect(refused.status).toBe(404);
  });

  it("refuses to start another restaurant kitchen ticket", async () => {
    const theirs = await other.waiter.post<Order>("/api/waiter/orders", {
      tableId: other.tableId,
      items: [{ menuItemId: other.itemId, quantity: 1 }],
    });

    const ticket = await other.waiter.post<{ ticket: KitchenTicket }>(
      `/api/waiter/orders/${theirs.id}/kitchen-tickets`,
    );

    const refused = await seeded.chef.attempt(
      "PUT",
      `/api/kitchen/tickets/${ticket.ticket.id}/start`,
    );

    expect(refused.status).toBe(404);
  });

  it("refuses to seat guests on another restaurant table", async () => {
    const refused = await seeded.waiter.attempt("POST", "/api/waiter/orders", {
      tableId: other.tableId,
      items: [{ menuItemId: seeded.itemId, quantity: 1 }],
    });

    // Reported as unavailable, the same as a table out of service, with no hint that
    // it belongs to somebody else.
    expect(refused.status).toBe(409);
  });

  it("refuses to order another restaurant menu item", async () => {
    const refused = await seeded.waiter.attempt("POST", "/api/waiter/orders", {
      tableId: seeded.tableId,
      items: [{ menuItemId: other.itemId, quantity: 1 }],
    });

    expect(refused.status).toBe(409);
  });

  it("shows a manager only their own floor", async () => {
    const floor = await seeded.manager.get<{ tables: { name: string }[] }>(
      "/api/manager/floor",
    );

    expect(floor.tables).toHaveLength(2);
    // Both restaurants seed identically named tables, so the count is the proof.
    expect(floor.tables.every((table) => table.name.startsWith("Table "))).toBe(true);
  });

  function callerFor(role: "waiter" | "chef" | "manager" | "cashier"): Caller {
    return {
      waiter: seeded.waiter,
      chef: seeded.chef,
      manager: seeded.manager,
      cashier: seeded.cashier,
    }[role];
  }
});
