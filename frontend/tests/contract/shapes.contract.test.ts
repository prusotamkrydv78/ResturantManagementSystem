import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import {
  expectFlag,
  expectInstant,
  expectKeys,
  expectNullable,
  expectNumber,
  expectText,
  expectUnion,
  first,
} from "./support/expect";
import { seedRestaurant, type Seeded } from "./support/seed";
import {
  ACTIVITY_KINDS,
  KITCHEN_TICKET_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PLATFORM_ROLES,
  STAFF_ROLES,
  TABLE_STATUSES,
} from "./support/unions";
import type { AuthResponse } from "@/types/auth";
import type { BillingOrder, BillingOrderSummary } from "@/types/billing";
import type { ManagerDashboard } from "@/types/dashboard";
import type { FloorOverview } from "@/types/floor";
import type { KitchenTicket } from "@/types/kitchen";
import type { Order, WaiterContext } from "@/types/order";
import { apiUrl } from "./support/env";

/**
 * Every response the frontend reads, checked field by field against what it believes.
 *
 * This is the layer that was missing. A screen reaches these through an unchecked
 * cast, so the compiler is satisfied by the type declaration alone while the wire
 * carries something else entirely. Each test below reads a response the way its screen
 * does and asserts the values are ones the screen can actually interpret.
 *
 * Enum fields get the most attention on purpose: every one of them is a branch, and a
 * branch fed the wrong kind of value fails silently rather than loudly.
 */
describe("response shapes the frontend depends on", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Shapes");
  });

  describe("authentication", () => {
    it("returns a session the auth context can store", async () => {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: seeded.waiterEmail, password: seeded.password }),
      });

      expect(response.status).toBe(200);

      const session = (await response.json()) as AuthResponse;

      // Held in memory and put in the Authorization header on every later call.
      expectText(session.accessToken, "session.accessToken");
      expectInstant(session.accessTokenExpiresAtUtc, "session.accessTokenExpiresAtUtc");
      expectUnion(session.user.platformRole, PLATFORM_ROLES, "session.user.platformRole");
      expectUnion(session.user.staffRole, STAFF_ROLES, "session.user.staffRole");

      // The refresh cookie is what survives a reload, and it must not be readable
      // by script.
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie.toLowerCase()).toContain("httponly");
    });

    it("describes the signed-in user with roles the frontend knows", async () => {
      const me = await seeded.waiter.get<AuthResponse["user"]>("/api/auth/me");

      expectText(me.id, "user.id");
      expectText(me.fullName, "user.fullName");
      expectUnion(me.platformRole, PLATFORM_ROLES, "user.platformRole");
      expect(me.platformRole).toBe("Staff");
      // The whole staff experience branches on this one field.
      expectUnion(me.staffRole, STAFF_ROLES, "user.staffRole");
      expect(me.staffRole).toBe("Waiter");
    });

    it("labels a chef and a manager the same way", async () => {
      const chef = await seeded.chef.get<AuthResponse["user"]>("/api/auth/me");
      const manager = await seeded.manager.get<AuthResponse["user"]>("/api/auth/me");

      expect(chef.staffRole).toBe("Chef");
      expect(manager.platformRole).toBe("RestaurantManager");
      // A manager has no floor role, and the frontend narrows on exactly that.
      expect(manager.staffRole).toBeNull();
    });
  });

  describe("the waiter workspace", () => {
    it("returns a context with real counts", async () => {
      const context = await seeded.waiter.get<WaiterContext>("/api/waiter/context");

      expectText(context.restaurantName, "context.restaurantName");
      expectNumber(context.activeTableCount, "context.activeTableCount");
      expectNumber(context.availableItemCount, "context.availableItemCount");
      expect(context.activeTableCount).toBe(2);
      expect(context.availableItemCount).toBe(1);
    });

    it("returns only tables that can take an order", async () => {
      const tables = await seeded.waiter.get<
        { id: string; name: string; capacity: number }[]
      >("/api/waiter/tables");

      expect(tables).toHaveLength(2);

      for (const table of tables) {
        expectText(table.id, "table.id");
        expectText(table.name, "table.name");
        expectNumber(table.capacity, "table.capacity");
      }
    });

    it("returns a menu with numeric prices", async () => {
      const menu = await seeded.waiter.get<
        { id: string; name: string; items: { id: string; price: number }[] }[]
      >("/api/waiter/menu");

      expect(menu.length).toBeGreaterThan(0);

      for (const category of menu) {
        expectText(category.name, "category.name");

        for (const item of category.items) {
          // A price arriving as a string would concatenate rather than add in the
          // running total the waiter sees.
          expectNumber(item.price, `item ${item.id} price`);
        }
      }
    });

    it("returns an order with every field the edit screen reads", async () => {
      const order = await seeded.waiter.post<Order>("/api/waiter/orders", {
        tableId: seeded.tableId,
        items: [{ menuItemId: seeded.itemId, quantity: 1, note: "No ice" }],
      });

      expectKeys(
        order,
        [
          "id",
          "orderNumber",
          "status",
          "tableId",
          "tableName",
          "subtotal",
          "itemCount",
          "createdByName",
          "createdAtUtc",
          "updatedAtUtc",
          "isEditable",
          "rowVersion",
          "unsubmittedItemCount",
          "canSubmitToKitchen",
          "items",
          "kitchenTickets",
        ],
        "order",
      );

      expectUnion(order.status, ORDER_STATUSES, "order.status");
      expectNumber(order.orderNumber, "order.orderNumber");
      expectNumber(order.subtotal, "order.subtotal");
      expectFlag(order.isEditable, "order.isEditable");
      expectFlag(order.canSubmitToKitchen, "order.canSubmitToKitchen");
      // Sent back verbatim on save, so it has to be a string the client can hold.
      expectText(order.rowVersion, "order.rowVersion");
      expectInstant(order.createdAtUtc, "order.createdAtUtc");

      const line = first(order.items, "order lines");
      expectKeys(
        line,
        [
          "id",
          "menuItemId",
          "itemName",
          "unitPrice",
          "quantity",
          "note",
          "lineTotal",
          "isSubmittedToKitchen",
          "kitchenTicketNumber",
          "isEditable",
        ],
        "order line",
      );
      expectFlag(line.isSubmittedToKitchen, "line.isSubmittedToKitchen");
      expectFlag(line.isEditable, "line.isEditable");
      // Null while unsent. The screen narrows on this rather than on a zero.
      expect(line.kitchenTicketNumber).toBeNull();
      expect(line.note).toBe("No ice");
    });

    it("returns a floor the card grid can render", async () => {
      const floor = await seeded.waiter.get<FloorOverview>("/api/waiter/floor");

      expectKeys(
        floor,
        [
          "generatedAtUtc",
          "totalCount",
          "inServiceCount",
          "occupiedCount",
          "availableCount",
          "outOfServiceCount",
          "seatsInService",
          "seatsOccupied",
          "openValue",
          "readyToSettleCount",
          "tables",
        ],
        "floor",
      );

      for (const table of floor.tables) {
        expectUnion(table.status, TABLE_STATUSES, `table ${table.name} status`);
        expectFlag(table.isActive, "table.isActive");
        expectNumber(table.openValue, "table.openValue");
        expectFlag(table.canSettle, "table.canSettle");
        expectNullable(table.seatedSinceUtc, "table.seatedSinceUtc", expectInstant);

        for (const order of table.openOrders) {
          expectNumber(order.orderNumber, "floor order number");
          expectFlag(order.canComplete, "floor order canComplete");
          expectText(order.placedByName, "floor order placedByName");
        }
      }
    });
  });

  describe("the kitchen rail", () => {
    it("returns tickets the rail can render, with no money on them", async () => {
      const order = await seeded.waiter.post<Order>("/api/waiter/orders", {
        tableId: seeded.secondTableId,
        items: [{ menuItemId: seeded.itemId, quantity: 2, note: "Extra spicy" }],
      });

      await seeded.waiter.post(`/api/waiter/orders/${order.id}/kitchen-tickets`);

      const queue = await seeded.chef.get<KitchenTicket[]>("/api/kitchen/tickets");

      expect(queue.length).toBeGreaterThan(0);

      const ticket = first(queue, "the kitchen queue");

      expectKeys(
        ticket,
        [
          "id",
          "ticketNumber",
          "status",
          "orderNumber",
          "tableName",
          "itemCount",
          "createdAtUtc",
          "startedAtUtc",
          "readyAtUtc",
          "items",
        ],
        "kitchen ticket",
      );

      expectUnion(ticket.status, KITCHEN_TICKET_STATUSES, "ticket.status");
      expectNumber(ticket.ticketNumber, "ticket.ticketNumber");
      expectNumber(ticket.orderNumber, "ticket.orderNumber");
      expectText(ticket.tableName, "ticket.tableName");
      expectInstant(ticket.createdAtUtc, "ticket.createdAtUtc");
      expectNullable(ticket.startedAtUtc, "ticket.startedAtUtc", expectInstant);
      expectNullable(ticket.readyAtUtc, "ticket.readyAtUtc", expectInstant);

      for (const line of ticket.items) {
        expectText(line.itemName, "ticket line itemName");
        expectNumber(line.quantity, "ticket line quantity");
        expectNullable(line.note, "ticket line note", expectText);
      }

      // The kitchen cooks; it does not sell. A price here would be noise at best.
      const serialised = JSON.stringify(ticket);
      expect(serialised).not.toMatch(/"unitPrice"|"price"|"lineTotal"|"subtotal"/);
    });

    it("accepts a status filter and returns only that status", async () => {
      const pending = await seeded.chef.get<KitchenTicket[]>(
        "/api/kitchen/tickets?status=Pending",
      );

      for (const ticket of pending) {
        expect(ticket.status).toBe("Pending");
      }
    });
  });

  describe("the manager workspace", () => {
    it("returns a billing queue the card grid can render", async () => {
      const queue = await seeded.manager.get<BillingOrderSummary[]>(
        "/api/billing/orders?includeCompleted=true",
      );

      expect(queue.length).toBeGreaterThan(0);

      for (const order of queue) {
        expectUnion(order.status, ORDER_STATUSES, "billing order status");
        expectNumber(order.subtotal, "billing order subtotal");
        expectFlag(order.canSettle, "billing order canSettle");
        expectNumber(order.unfinishedKitchenTicketCount, "unfinished ticket count");
        expectNullable(order.completedAtUtc, "completedAtUtc", expectInstant);

        for (const payment of order.payments) {
          expectUnion(payment.method, PAYMENT_METHODS, "payment.method");
          expectNumber(payment.amount, "payment.amount");
        }
      }
    });

    it("returns a bill with the stored prices and the kitchen state", async () => {
      const queue = await seeded.manager.get<BillingOrderSummary[]>(
        "/api/billing/orders",
      );

      const bill = await seeded.manager.get<BillingOrder>(
        `/api/billing/orders/${first(queue, "the billing queue").id}`,
      );

      expectKeys(
        bill,
        [
          "id",
          "orderNumber",
          "status",
          "tableName",
          "tableCapacity",
          "subtotal",
          "itemCount",
          "placedByName",
          "createdAtUtc",
          "completedAtUtc",
          "unfinishedKitchenTicketCount",
          "unsubmittedItemCount",
          "startedKitchenTicketCount",
          "canComplete",
          "canCancel",
          "payment",
          "cancellation",
          "items",
          "kitchenTickets",
        ],
        "bill",
      );

      expectFlag(bill.canSettle, "bill.canSettle");
      expectFlag(bill.canCancel, "bill.canCancel");
      expectNumber(bill.tableCapacity, "bill.tableCapacity");

      for (const line of bill.items) {
        expectNumber(line.unitPrice, "bill line unitPrice");
        expectNumber(line.lineTotal, "bill line lineTotal");
        expectFlag(line.isSubmittedToKitchen, "bill line isSubmittedToKitchen");
        expectNullable(line.kitchenTicketNumber, "bill line ticket number", expectNumber);
      }

      for (const ticket of bill.kitchenTickets) {
        expectUnion(ticket.status, KITCHEN_TICKET_STATUSES, "bill ticket status");
      }
    });

    it("returns a dashboard every panel can read", async () => {
      const dashboard = await seeded.manager.get<ManagerDashboard>(
        "/api/manager/dashboard",
      );

      expectInstant(dashboard.generatedAtUtc, "dashboard.generatedAtUtc");

      expectNumber(dashboard.orders.openCount, "orders.openCount");
      expectNumber(dashboard.orders.readyToSettleCount, "orders.readyToSettleCount");
      expectNumber(dashboard.orders.openValue, "orders.openValue");
      expectNullable(dashboard.orders.oldestOpenAtUtc, "oldestOpenAtUtc", expectInstant);

      expectNumber(dashboard.floor.occupiedCount, "floor.occupiedCount");
      expectNumber(dashboard.floor.seatsInService, "floor.seatsInService");

      expectNumber(dashboard.kitchen.pendingCount, "kitchen.pendingCount");
      expectNumber(dashboard.kitchen.preparingCount, "kitchen.preparingCount");

      expectInstant(dashboard.today.startedAtUtc, "today.startedAtUtc");
      expectNumber(dashboard.today.paymentTotal, "today.paymentTotal");

      // Every method, always, so a zero reads as a zero rather than a missing row.
      expect(dashboard.today.byMethod).toHaveLength(PAYMENT_METHODS.length);
      for (const row of dashboard.today.byMethod) {
        expectUnion(row.method, PAYMENT_METHODS, "byMethod.method");
        expectNumber(row.total, "byMethod.total");
        expectNumber(row.count, "byMethod.count");
      }

      expectFlag(dashboard.readiness.canTakeOrders, "readiness.canTakeOrders");
      expect(dashboard.readiness.canTakeOrders).toBe(true);

      for (const entry of dashboard.activity) {
        expectUnion(entry.kind, ACTIVITY_KINDS, "activity.kind");
        expectInstant(entry.atUtc, "activity.atUtc");
        expectText(entry.tableName, "activity.tableName");
        expectNumber(entry.orderNumber, "activity.orderNumber");
        expectNullable(entry.method, "activity.method", (value, field) =>
          expectUnion(value, PAYMENT_METHODS, field),
        );
      }
    });

    it("returns a history list with an outcome on every row", async () => {
      const history = await seeded.manager.get<
        {
          id: string;
          status: string;
          closedAtUtc: string;
          payment: unknown;
          cancellation: unknown;
        }[]
      >("/api/billing/history?limit=10");

      for (const entry of history) {
        expectUnion(entry.status, ORDER_STATUSES, "history status");
        // Open orders are not history.
        expect(entry.status).not.toBe("Open");
        expectInstant(entry.closedAtUtc, "history closedAtUtc");
        // Exactly one of the two explains how it ended.
        expect(entry.payment === null).not.toBe(entry.cancellation === null);
      }
    });
  });
});
