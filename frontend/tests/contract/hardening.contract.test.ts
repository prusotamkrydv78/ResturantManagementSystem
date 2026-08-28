import { beforeAll, describe, expect, it } from "vitest";
import { Caller, requireApi, signIn } from "./support/client";
import { expectFlag, expectNumber, expectText, only } from "./support/expect";
import {
  seedBareRestaurant,
  seedRestaurant,
  seedUnassignedManager,
  signInSuperAdmin,
  type BareSeeded,
  type Seeded,
} from "./support/seed";
import { seededPassword } from "./support/env";
import type { FloorOverview } from "@/types/floor";
import type { ManagerDashboard } from "@/types/dashboard";
import type { KitchenTicket } from "@/types/kitchen";
import type { Order } from "@/types/order";

/**
 * The states a screen reaches when things are empty, refused, or already done.
 *
 * The rest of the suite walks the happy path, where a restaurant is already trading.
 * These are the states around it: the first day with nothing set up, an account with
 * no restaurant behind it, a duplicate, a conflict, a stale save. Each one is a real
 * screen a real person reaches, and each has to arrive as something the interface can
 * explain rather than a 500 or a silence.
 */
describe("the states around the happy path", () => {
  let seeded: Seeded;
  let bare: BareSeeded;
  let admin: Caller;

  beforeAll(async () => {
    await requireApi();
    [seeded, bare, admin] = await Promise.all([
      seedRestaurant("Harden"),
      seedBareRestaurant("Harden"),
      signInSuperAdmin(),
    ]);
  });

  /* ------------------------------------------------------------ first day */

  describe("a restaurant on its first day", () => {
    it("tells a waiter there is nothing to seat and nothing to order", async () => {
      const context = await bare.waiter.get<{
        restaurantName: string;
        activeTableCount: number;
        availableItemCount: number;
      }>("/api/waiter/context");

      // Both zero, and the name still present, so the screen can say which
      // restaurant is not ready rather than rendering a blank.
      expectText(context.restaurantName, "context.restaurantName");
      expect(context.activeTableCount).toBe(0);
      expect(context.availableItemCount).toBe(0);
    });

    it("returns empty collections rather than null", async () => {
      const tables = await bare.waiter.get<unknown[]>("/api/waiter/tables");
      const menu = await bare.waiter.get<unknown[]>("/api/waiter/menu");
      const orders = await bare.waiter.get<unknown[]>("/api/waiter/orders");

      // A null here would crash every `.map` on the screen.
      expect(Array.isArray(tables)).toBe(true);
      expect(Array.isArray(menu)).toBe(true);
      expect(Array.isArray(orders)).toBe(true);
      expect(tables).toHaveLength(0);
      expect(menu).toHaveLength(0);
      expect(orders).toHaveLength(0);
    });

    it("returns a floor with no tables and coherent zero counts", async () => {
      const floor = await bare.waiter.get<FloorOverview>("/api/waiter/floor");

      expect(floor.tables).toHaveLength(0);
      expect(floor.totalCount).toBe(0);
      expect(floor.availableCount).toBe(0);
      expect(floor.occupiedCount).toBe(0);
      expect(floor.openValue).toBe(0);
      // The summary line divides by nothing, so these must be numbers not nulls.
      expectNumber(floor.seatsInService, "floor.seatsInService");
      expectNumber(floor.readyToSettleCount, "floor.readyToSettleCount");
    });

    it("tells the manager dashboard the restaurant cannot trade, and says why", async () => {
      const dashboard = await bare.manager.get<ManagerDashboard>(
        "/api/manager/dashboard",
      );

      expectFlag(dashboard.readiness.canTakeOrders, "readiness.canTakeOrders");
      expect(dashboard.readiness.canTakeOrders).toBe(false);
      // The banner names whichever is missing, so both facts have to arrive.
      expect(dashboard.floor.inServiceCount).toBe(0);
      expect(dashboard.readiness.availableMenuItemCount).toBe(0);

      // And every panel still has to render.
      expect(dashboard.today.byMethod).toHaveLength(3);
      expect(dashboard.activity).toHaveLength(0);
      expect(dashboard.orders.oldestOpenAtUtc).toBeNull();
    });

    it("returns an empty billing queue and an empty history", async () => {
      const queue = await bare.manager.get<unknown[]>("/api/billing/orders");
      const history = await bare.manager.get<unknown[]>("/api/billing/history");

      expect(queue).toHaveLength(0);
      expect(history).toHaveLength(0);
    });

    it("refuses an order when there is no table to seat it at", async () => {
      const refused = await bare.waiter.attempt("POST", "/api/waiter/orders", {
        tableId: "00000000-0000-0000-0000-000000000001",
        items: [{ menuItemId: "00000000-0000-0000-0000-000000000002", quantity: 1 }],
      });

      expect(refused.status).toBe(409);
      expectProblemDetail(refused.body);
    });
  });

  /* -------------------------------------------------- nothing behind the account */

  describe("a manager who owns no restaurant", () => {
    let orphan: Caller;

    beforeAll(async () => {
      orphan = await seedUnassignedManager();
    });

    /** Every manager surface, which all have to survive having nothing behind them. */
    const surfaces = [
      "/api/restaurants/mine",
      "/api/tables",
      "/api/menu/categories",
      "/api/menu/items",
      "/api/staff",
      "/api/manager/dashboard",
      "/api/manager/floor",
      "/api/billing/orders",
      "/api/billing/history",
    ];

    it.each(surfaces)("%s answers without a server error", async (path) => {
      const response = await orphan.attempt("GET", path);

      // The account is real and correctly authorised, so this must be a clean
      // not-found the screen can turn into "no restaurant assigned yet", never a 500.
      expect(response.status, `${path} returned ${response.status}`).toBe(404);
      expectProblemDetail(response.body);
    });

    it("cannot settle or cancel anything", async () => {
      const order = await placeOrder(seeded, seeded.tableId);

      const settle = await orphan.attempt(
        "POST",
        `/api/billing/orders/${order.id}/payment`,
        { method: "Cash" },
      );
      const cancel = await orphan.attempt(
        "POST",
        `/api/billing/orders/${order.id}/cancellation`,
        { reason: "Not my restaurant at all" },
      );

      expect(settle.status).toBe(404);
      expect(cancel.status).toBe(404);
    });
  });

  /* ------------------------------------------------------------ the platform admin */

  describe("a super admin", () => {
    const operational = [
      "/api/restaurants/mine",
      "/api/tables",
      "/api/menu/items",
      "/api/staff",
      "/api/manager/dashboard",
      "/api/manager/floor",
      "/api/billing/orders",
      "/api/waiter/floor",
      "/api/waiter/orders",
      "/api/kitchen/tickets",
    ];

    it.each(operational)("is refused from %s", async (path) => {
      const response = await admin.attempt("GET", path);

      // Running the platform is not the same job as running a floor, and the most
      // privileged account is the one that most needs the boundary.
      expect(response.status, `${path} returned ${response.status}`).toBe(403);
    });

    it("can still reach the platform surfaces it owns", async () => {
      expect((await admin.attempt("GET", "/api/restaurants")).status).toBe(200);
      expect((await admin.attempt("GET", "/api/managers")).status).toBe(200);
    });
  });

  /* ---------------------------------------------------------------- duplicates */

  describe("duplicates and conflicts", () => {
    it("refuses a second restaurant with the same slug", async () => {
      const response = await admin.attempt("POST", "/api/restaurants", {
        name: "Duplicate Slug Attempt",
        slug: bare.restaurantSlug,
      });

      expect(response.status).toBe(409);
      expectProblemDetail(response.body);
    });

    it("refuses a second account with the same email", async () => {
      const response = await admin.attempt("POST", "/api/managers", {
        fullName: "Duplicate Email Attempt",
        email: bare.managerEmail,
        password: seededPassword,
      });

      expect(response.status).toBe(409);
      expectProblemDetail(response.body);
    });

    it("refuses a second manager on a restaurant that already has one", async () => {
      const orphan = await seedUnassignedManager();
      const me = await orphan.get<{ id: string }>("/api/auth/me");

      const response = await admin.attempt("PUT", `/api/managers/${me.id}/assignment`, {
        restaurantId: bare.restaurantId,
      });

      expect(response.status).toBe(409);
      expectProblemDetail(response.body);
    });

    it("refuses a second table with the same name", async () => {
      const response = await seeded.manager.attempt("POST", "/api/tables", {
        name: seeded.tableName,
        capacity: 2,
      });

      expect(response.status).toBe(409);
      expectProblemDetail(response.body);
    });

    it("refuses a second category with the same name", async () => {
      const response = await seeded.manager.attempt("POST", "/api/menu/categories", {
        name: "Mains",
        displayOrder: 2,
      });

      expect(response.status).toBe(409);
      expectProblemDetail(response.body);
    });
  });

  /* ------------------------------------------------------------ hidden menu items */

  describe("hiding things on the menu", () => {
    it("removes a hidden item from what a waiter can order", async () => {
      const hidden = await seedRestaurant("Hidden");

      await hidden.manager.put(`/api/menu/items/${hidden.itemId}/status`, {
        isActive: false,
      });

      const menu = await hidden.waiter.get<{ items: { id: string }[] }[]>(
        "/api/waiter/menu",
      );

      const offered = menu.flatMap((category) => category.items);
      expect(offered.find((item) => item.id === hidden.itemId)).toBeUndefined();

      // And the server refuses it even if a stale screen still offers it.
      const refused = await hidden.waiter.attempt("POST", "/api/waiter/orders", {
        tableId: hidden.tableId,
        items: [{ menuItemId: hidden.itemId, quantity: 1 }],
      });

      expect(refused.status).toBe(409);
    });

    it("takes a whole category out of the waiter menu when it is hidden", async () => {
      const hidden = await seedRestaurant("HiddenCategory");

      await hidden.manager.put(`/api/menu/categories/${hidden.categoryId}/status`, {
        isActive: false,
      });

      const menu = await hidden.waiter.get<{ id: string }[]>("/api/waiter/menu");

      // An empty category is not offered at all, and an item inside a hidden one is
      // unorderable however active the item itself is.
      expect(menu.find((category) => category.id === hidden.categoryId)).toBeUndefined();

      const refused = await hidden.waiter.attempt("POST", "/api/waiter/orders", {
        tableId: hidden.tableId,
        items: [{ menuItemId: hidden.itemId, quantity: 1 }],
      });

      expect(refused.status).toBe(409);
    });

    it("stops a waiter seating guests at a table taken out of service", async () => {
      const closed = await seedRestaurant("ClosedTable");

      await closed.manager.put(`/api/tables/${closed.tableId}/status`, {
        isActive: false,
      });

      const offered = await closed.waiter.get<{ id: string }[]>("/api/waiter/tables");
      expect(offered.find((table) => table.id === closed.tableId)).toBeUndefined();

      // Still on the floor, so a waiter is told it is closed rather than left
      // wondering why it vanished.
      const floor = await closed.waiter.get<FloorOverview>("/api/waiter/floor");
      const table = only(floor.tables, (t) => t.id === closed.tableId, "the closed table");
      expect(table.isActive).toBe(false);

      const refused = await closed.waiter.attempt("POST", "/api/waiter/orders", {
        tableId: closed.tableId,
        items: [{ menuItemId: closed.itemId, quantity: 1 }],
      });

      expect(refused.status).toBe(409);
    });
  });

  /* ------------------------------------------------------- occupancy is not settable */

  describe("occupancy", () => {
    it("cannot be set by hand through any table payload", async () => {
      const table = await seeded.manager.get<{ name: string; capacity: number }>(
        `/api/tables/${seeded.secondTableId}`,
      );

      // Sent alongside a legitimate edit. If the server honoured it, the floor and
      // the orders would immediately disagree about which tables are free.
      await seeded.manager.put(`/api/tables/${seeded.secondTableId}`, {
        name: table.name,
        capacity: table.capacity,
        status: "Occupied",
        isActive: true,
      });

      const after = await seeded.manager.get<{ status: string }>(
        `/api/tables/${seeded.secondTableId}`,
      );

      expect(after.status).toBe("Available");
    });

    it("is not changed by taking a table out of service", async () => {
      const closed = await seedRestaurant("ServiceVsOccupancy");

      await placeOrder(closed, closed.tableId);
      await closed.manager.put(`/api/tables/${closed.tableId}/status`, {
        isActive: false,
      });

      const table = await closed.manager.get<{ status: string; isActive: boolean }>(
        `/api/tables/${closed.tableId}`,
      );

      // Two separate facts. A table can be closed to new guests while the party
      // already sitting at it finishes.
      expect(table.isActive).toBe(false);
      expect(table.status).toBe("Occupied");
    });
  });

  /* --------------------------------------------------------------- stale and racing */

  describe("stale and concurrent saves", () => {
    it("refuses an order edit built on a stale row version", async () => {
      const order = await placeOrder(seeded, seeded.secondTableId);
      const stale = order.rowVersion;
      const lineId = order.items[0]!.id;

      const first = await seeded.waiter.attempt("PUT", `/api/waiter/orders/${order.id}`, {
        lines: [{ id: lineId, quantity: 3 }],
        rowVersion: stale,
      });
      expect(first.status).toBe(200);

      const second = await seeded.waiter.attempt("PUT", `/api/waiter/orders/${order.id}`, {
        lines: [{ id: lineId, quantity: 9 }],
        rowVersion: stale,
      });

      expect(second.status).toBe(409);
      expectProblemDetail(second.body);

      const current = await seeded.waiter.get<Order>(`/api/waiter/orders/${order.id}`);
      // The first save survives untouched.
      expect(current.items[0]!.quantity).toBe(3);
    });

    it("lets only one of two simultaneous ticket starts through", async () => {
      const order = await placeOrder(seeded, seeded.tableId);
      const submitted = await seeded.waiter.post<{ ticket: KitchenTicket }>(
        `/api/waiter/orders/${order.id}/kitchen-tickets`,
      );

      const [a, b] = await Promise.all([
        seeded.chef.attempt("PUT", `/api/kitchen/tickets/${submitted.ticket.id}/start`),
        seeded.chef.attempt("PUT", `/api/kitchen/tickets/${submitted.ticket.id}/start`),
      ]);

      const statuses = [a.status, b.status].sort();

      // Two chefs reaching for the same ticket is the ordinary case in a kitchen.
      expect(statuses).toEqual([200, 409]);

      const ticket = await seeded.chef.get<KitchenTicket>(
        `/api/kitchen/tickets/${submitted.ticket.id}`,
      );
      expect(ticket.status).toBe("Preparing");
    });

    it("lets only one of two simultaneous settlements through", async () => {
      const order = await placeOrder(seeded, seeded.secondTableId);

      const [a, b] = await Promise.all([
        seeded.manager.attempt("POST", `/api/billing/orders/${order.id}/payment`, {
          method: "Cash",
        }),
        seeded.manager.attempt("POST", `/api/billing/orders/${order.id}/payment`, {
          method: "Card",
        }),
      ]);

      const statuses = [a.status, b.status].sort();

      expect(statuses[0]).toBe(201);
      expect(statuses[1]).toBeGreaterThanOrEqual(400);
    });
  });

  /* ------------------------------------------------------------------- not found */

  describe("identifiers that do not resolve", () => {
    const missing = "00000000-0000-0000-0000-0000000000ff";

    it.each([
      ["waiter order", () => seeded.waiter.attempt("GET", `/api/waiter/orders/${missing}`)],
      ["kitchen ticket", () => seeded.chef.attempt("GET", `/api/kitchen/tickets/${missing}`)],
      ["bill", () => seeded.manager.attempt("GET", `/api/billing/orders/${missing}`)],
      ["table", () => seeded.manager.attempt("GET", `/api/tables/${missing}`)],
      ["menu item", () => seeded.manager.attempt("GET", `/api/menu/items/${missing}`)],
      ["staff member", () => seeded.manager.attempt("GET", `/api/staff/${missing}`)],
    ])("%s answers 404 with something readable", async (_name, call) => {
      const response = await call();

      expect(response.status).toBe(404);
      expectProblemDetail(response.body);
    });

    it("rejects a malformed identifier rather than treating it as missing", async () => {
      const response = await seeded.waiter.attempt("GET", "/api/waiter/orders/not-a-guid");

      // The route constraint refuses it, so a typo never reaches a service.
      expect(response.status).toBe(404);
    });
  });

  /* --------------------------------------------------------------------- sessions */

  describe("sessions", () => {
    it("refuses a token that has been tampered with", async () => {
      const tampered = new Caller("tampered", "not.a.real.token");

      expect((await tampered.attempt("GET", "/api/waiter/floor")).status).toBe(401);
    });

    it("stops a deactivated waiter mid-shift, without waiting for the token to expire", async () => {
      const shift = await seedRestaurant("Deactivated");

      // A working session, established before anything changes.
      expect((await shift.waiter.attempt("GET", "/api/waiter/floor")).status).toBe(200);

      const staff = await shift.manager.get<{ id: string; role: string }[]>("/api/staff");
      const waiter = only(staff, (s) => s.role === "Waiter", "the seeded waiter");

      await shift.manager.put(`/api/staff/${waiter.id}/status`, { isActive: false });

      // The same token, still inside its lifetime. The service checks the account as
      // well as the token, so it stops working immediately.
      const after = await shift.waiter.attempt("GET", "/api/waiter/floor");
      expect(after.status).toBe(403);
    });

    it("refuses a deactivated account a fresh sign-in as well", async () => {
      const shift = await seedRestaurant("DeactivatedLogin");

      const staff = await shift.manager.get<{ id: string; email: string; role: string }[]>(
        "/api/staff",
      );
      const chef = only(staff, (s) => s.role === "Chef", "the seeded chef");

      await shift.manager.put(`/api/staff/${chef.id}/status`, { isActive: false });

      await expect(
        signIn("deactivated chef", chef.email, seededPassword),
      ).rejects.toThrow();
    });
  });

  /* ---------------------------------------------------------------------- helpers */

  async function placeOrder(target: Seeded, tableId: string): Promise<Order> {
    return target.waiter.post<Order>("/api/waiter/orders", {
      tableId,
      items: [{ menuItemId: target.itemId, quantity: 1 }],
    });
  }

  /**
   * Every refusal has to carry something a person can read.
   *
   * The interface puts this straight on screen, so an empty problem body would leave
   * the user staring at a failed action with no explanation.
   */
  function expectProblemDetail(body: unknown): void {
    expect(body, "a refusal should have a body").not.toBeNull();

    const problem = body as { detail?: string; title?: string; errors?: unknown };
    const message = problem.detail ?? problem.title;

    expect(
      typeof message === "string" && message.length > 0,
      `refusal carried no readable message: ${JSON.stringify(body)?.slice(0, 200)}`,
    ).toBe(true);
  }
});
