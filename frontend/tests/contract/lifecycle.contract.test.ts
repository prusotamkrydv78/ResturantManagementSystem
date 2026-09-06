import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import { expectInstant, expectNumber, expectUnion, first, only } from "./support/expect";
import { seedRestaurant, type Seeded } from "./support/seed";
import { KITCHEN_TICKET_STATUSES, ORDER_STATUSES, TABLE_STATUSES } from "./support/unions";
import type { FloorOverview } from "@/types/floor";
import type { KitchenTicket } from "@/types/kitchen";
import type { Order, OrderSummary } from "@/types/order";
import type { BillingOrder, RecordPaymentResult } from "@/types/billing";

/**
 * The whole product, once, in order, across three roles.
 *
 * This is the test that answers the question the phase actually asks: can each role
 * do its real job using the frontend types against the real API. Every step reads its
 * response the way a screen does, so a value the frontend cannot interpret fails at
 * the step that produced it rather than as a blank panel later.
 *
 * One shared restaurant for the file, because the point is a single order travelling
 * the full distance rather than isolated calls.
 */
describe("a table from seating to settled", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Lifecycle");
  });

  it("starts with the table free on the waiter floor", async () => {
    const floor = await seeded.waiter.get<FloorOverview>("/api/waiter/floor");

    expectInstant(floor.generatedAtUtc, "floor.generatedAtUtc");
    expect(floor.tables).toHaveLength(2);

    const table = only(floor.tables, (t) => t.id === seeded.tableId, "the seeded table");

    expectUnion(table.status, TABLE_STATUSES, "table.status");
    expect(table.status).toBe("Available");
    expect(table.isActive).toBe(true);
    expect(table.openOrders).toHaveLength(0);
    expect(table.seatedSinceUtc).toBeNull();
    expect(floor.availableCount).toBe(2);
    expect(floor.occupiedCount).toBe(0);
  });

  it("lets the waiter see the orderable menu", async () => {
    const menu = await seeded.waiter.get<
      { id: string; name: string; items: { id: string; price: number }[] }[]
    >("/api/waiter/menu");

    const item = only(
      menu.flatMap((category) => category.items),
      (candidate) => candidate.id === seeded.itemId,
      "the seeded item",
    );

    // Prices must arrive as numbers, not strings: the cart multiplies them.
    expectNumber(item.price, "menu item price");
    expect(item.price).toBe(seeded.itemPrice);
  });

  let orderId: string;
  let rowVersion: string;

  it("lets the waiter seat guests and place an order", async () => {
    const order = await seeded.waiter.post<Order>("/api/waiter/orders", {
      tableId: seeded.tableId,
      items: [{ menuItemId: seeded.itemId, quantity: 2 }],
    });

    expectUnion(order.status, ORDER_STATUSES, "order.status");
    expect(order.status).toBe("Open");
    expect(order.tableName).toBe(seeded.tableName);
    // The server priced this from its own menu; the request carried no amount.
    expect(order.subtotal).toBe(seeded.itemPrice * 2);
    expect(order.items).toHaveLength(1);
    const line = first(order.items, "order lines");
    expect(line.unitPrice).toBe(seeded.itemPrice);
    expect(line.isSubmittedToKitchen).toBe(false);
    expect(line.isEditable).toBe(true);
    expect(order.isEditable).toBe(true);
    expect(order.canSubmitToKitchen).toBe(true);
    expect(order.unsubmittedItemCount).toBe(2);
    expect(order.kitchenTickets).toHaveLength(0);

    orderId = order.id;
    rowVersion = order.rowVersion;
  });

  it("occupies the table as soon as the order exists", async () => {
    const floor = await seeded.waiter.get<FloorOverview>("/api/waiter/floor");
    const table = only(floor.tables, (t) => t.id === seeded.tableId, "the seeded table");

    expect(table.status).toBe("Occupied");
    expect(table.openOrders).toHaveLength(1);
    expect(table.openValue).toBe(seeded.itemPrice * 2);
    expectInstant(table.seatedSinceUtc, "table.seatedSinceUtc");
    expect(floor.occupiedCount).toBe(1);
    expect(floor.availableCount).toBe(1);
  });

  it("shows the order in the waiter open list", async () => {
    const orders = await seeded.waiter.get<OrderSummary[]>("/api/waiter/orders");
    const summary = only(orders, (o) => o.id === orderId, "the new order");

    expectUnion(summary.status, ORDER_STATUSES, "summary.status");
    expect(summary.unsubmittedItemCount).toBe(2);
    expect(summary.kitchenTicketCount).toBe(0);
  });

  it("lets the waiter add another item before anything is sent", async () => {
    const updated = await seeded.waiter.put<Order>(`/api/waiter/orders/${orderId}`, {
      lines: [
        { id: first((await currentOrder()).items, "order lines").id, quantity: 2 },
      ],
      newItems: [{ menuItemId: seeded.itemId, quantity: 1, note: "No onion" }],
      rowVersion,
    });

    // A separate line, because the note differs.
    expect(updated.items).toHaveLength(2);
    expect(updated.subtotal).toBe(seeded.itemPrice * 3);
    expect(updated.unsubmittedItemCount).toBe(3);

    rowVersion = updated.rowVersion;
  });

  let ticketId: string;
  let ticketNumber: number;

  it("lets the waiter send everything to the kitchen", async () => {
    const result = await seeded.waiter.post<{ ticket: KitchenTicket; order: Order }>(
      `/api/waiter/orders/${orderId}/kitchen-tickets`,
    );

    expectUnion(result.ticket.status, KITCHEN_TICKET_STATUSES, "ticket.status");
    expect(result.ticket.status).toBe("Pending");
    expectNumber(result.ticket.ticketNumber, "ticket.ticketNumber");
    expect(result.ticket.items).toHaveLength(2);
    expect(result.ticket.itemCount).toBe(3);

    // The order stays open. Sending food is not a step in its lifecycle.
    expect(result.order.status).toBe("Open");
    expect(result.order.unsubmittedItemCount).toBe(0);
    expect(result.order.canSubmitToKitchen).toBe(false);
    expect(result.order.items.every((item) => item.isSubmittedToKitchen)).toBe(true);
    expect(result.order.items.every((item) => !item.isEditable)).toBe(true);

    ticketId = result.ticket.id;
    ticketNumber = result.ticket.ticketNumber;
    rowVersion = result.order.rowVersion;
  });

  it("refuses to change a line that has gone to the kitchen", async () => {
    const order = await currentOrder();

    const refused = await seeded.waiter.attempt(
      "PUT",
      `/api/waiter/orders/${orderId}`,
      {
        lines: [{ id: first(order.items, "order lines").id, quantity: 9 }],
        rowVersion: order.rowVersion,
      },
    );

    expect(refused.status).toBe(409);
  });

  it("puts the ticket on the chef rail", async () => {
    const queue = await seeded.chef.get<KitchenTicket[]>("/api/kitchen/tickets");
    const ticket = only(queue, (t) => t.id === ticketId, "the ticket on the rail");

    expectUnion(ticket.status, KITCHEN_TICKET_STATUSES, "ticket.status");
    expect(ticket.status).toBe("Pending");
    expect(ticket.tableName).toBe(seeded.tableName);
    expect(ticket.startedAtUtc).toBeNull();
    expect(ticket.readyAtUtc).toBeNull();
    // The kitchen is never shown money.
    expect(JSON.stringify(ticket)).not.toContain("price");
    expect(JSON.stringify(ticket)).not.toContain("unitPrice");
  });

  it("refuses to mark a waiting ticket ready", async () => {
    const refused = await seeded.chef.attempt(
      "PUT",
      `/api/kitchen/tickets/${ticketId}/ready`,
    );

    expect(refused.status).toBe(409);
  });

  it("lets the chef start cooking", async () => {
    const ticket = await seeded.chef.put<KitchenTicket>(
      `/api/kitchen/tickets/${ticketId}/start`,
    );

    expect(ticket.status).toBe("Preparing");
    expectInstant(ticket.startedAtUtc, "ticket.startedAtUtc");
    expect(ticket.readyAtUtc).toBeNull();
  });

  it("refuses a second start", async () => {
    const refused = await seeded.chef.attempt(
      "PUT",
      `/api/kitchen/tickets/${ticketId}/start`,
    );

    expect(refused.status).toBe(409);
  });

  it("will not let the manager settle while the kitchen is cooking", async () => {
    const bill = await seeded.manager.get<BillingOrder>(
      `/api/billing/orders/${orderId}`,
    );

    expect(bill.canSettle).toBe(false);
    expect(bill.unfinishedKitchenTicketCount).toBe(1);

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${orderId}/payment`,
      { method: "Cash" },
    );

    expect(refused.status).toBe(409);
  });

  it("lets the chef send the food to the pass", async () => {
    const ticket = await seeded.chef.put<KitchenTicket>(
      `/api/kitchen/tickets/${ticketId}/ready`,
    );

    expect(ticket.status).toBe("Ready");
    expectInstant(ticket.startedAtUtc, "ticket.startedAtUtc");
    expectInstant(ticket.readyAtUtc, "ticket.readyAtUtc");
  });

  it("drops the finished ticket off the rail", async () => {
    const queue = await seeded.chef.get<KitchenTicket[]>("/api/kitchen/tickets");

    expect(queue.find((candidate) => candidate.id === ticketId)).toBeUndefined();
  });

  it("leaves the table occupied while the food is at the pass", async () => {
    const floor = await seeded.manager.get<FloorOverview>("/api/manager/floor");
    const table = only(floor.tables, (t) => t.id === seeded.tableId, "the seeded table");

    // Food ready does not mean the guests have gone.
    expect(table.status).toBe("Occupied");
    expect(table.readyTicketCount).toBe(1);
    expect(table.canSettle).toBe(true);
  });

  it("shows the bill to the manager with the stored prices", async () => {
    const bill = await seeded.manager.get<BillingOrder>(
      `/api/billing/orders/${orderId}`,
    );

    expectUnion(bill.status, ORDER_STATUSES, "bill.status");
    expect(bill.canSettle).toBe(true);
    expect(bill.unfinishedKitchenTicketCount).toBe(0);
    expect(bill.subtotal).toBe(seeded.itemPrice * 3);
    expect(bill.payments).toHaveLength(0);
    expect(bill.cancellation).toBeNull();
    expect(bill.items).toHaveLength(2);
    expect(first(bill.items, "bill lines").kitchenTicketNumber).toBe(ticketNumber);
    expect(first(bill.kitchenTickets, "bill tickets").status).toBe("Ready");
  });

  it("lets the manager take payment and close the order", async () => {
    const result = await seeded.manager.post<RecordPaymentResult>(
      `/api/billing/orders/${orderId}/payment`,
      { method: "Card" },
    );

    expect(result.payment.method).toBe("Card");
    // Taken from the stored total, not from anything the client sent.
    expect(result.payment.amount).toBe(seeded.itemPrice * 3);
    expectInstant(result.payment.recordedAtUtc, "payment.recordedAtUtc");
    expect(result.order.status).toBe("Completed");
    expectInstant(result.order.completedAtUtc, "order.completedAtUtc");
    expect(result.order.canSettle).toBe(false);
    expect(result.order.canCancel).toBe(false);
  });

  it("releases the table", async () => {
    const floor = await seeded.manager.get<FloorOverview>("/api/manager/floor");
    const table = only(floor.tables, (t) => t.id === seeded.tableId, "the seeded table");

    expect(table.status).toBe("Available");
    expect(table.openOrders).toHaveLength(0);
    // Availability moved; being in service never did.
    expect(table.isActive).toBe(true);
    expect(floor.availableCount).toBe(2);
  });

  it("takes the order out of the waiter open list", async () => {
    const orders = await seeded.waiter.get<OrderSummary[]>("/api/waiter/orders");

    expect(orders.find((candidate) => candidate.id === orderId)).toBeUndefined();
  });

  it("refuses any further edit to the closed order", async () => {
    const refused = await seeded.waiter.attempt("PUT", `/api/waiter/orders/${orderId}`, {
      lines: [],
      rowVersion,
    });

    expect(refused.status).toBeGreaterThanOrEqual(400);
  });

  it("puts it in the manager history as paid", async () => {
    const history = await seeded.manager.get<
      { id: string; status: string; payment: { method: string; amount: number } | null }[]
    >("/api/billing/history?limit=50");

    const entry = only(history, (e) => e.id === orderId, "the settled order in history");

    expectUnion(entry.status, ORDER_STATUSES, "history entry status");
    expect(entry.status).toBe("Completed");
    expect(entry.payment?.method).toBe("Card");
    expect(entry.payment?.amount).toBe(seeded.itemPrice * 3);
  });

  async function currentOrder(): Promise<Order> {
    return seeded.waiter.get<Order>(`/api/waiter/orders/${orderId}`);
  }
});
