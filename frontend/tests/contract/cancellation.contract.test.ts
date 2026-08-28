import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import { expectInstant, expectText, expectUnion, first, only } from "./support/expect";
import { seedRestaurant, type Seeded } from "./support/seed";
import { ORDER_STATUSES } from "./support/unions";
import type { BillingOrder } from "@/types/billing";
import type { FloorOverview } from "@/types/floor";
import type { KitchenTicket } from "@/types/kitchen";
import type { Order } from "@/types/order";

/**
 * The other ending, and what the screens are told about it.
 *
 * The cancellation panel reads three fields that only exist together, and the history
 * list keys its whole row off them. If any arrives missing or in the wrong shape the
 * screen shows a cancelled order with no explanation, which is exactly the gap the
 * state was added to close.
 */
describe("calling an order off", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Cancel");
  });

  it("requires a reason", async () => {
    const order = await placeOrder(seeded.tableId);

    const empty = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "" },
    );

    const tooShort = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "no" },
    );

    // Refused at the contract, before any service sees it.
    expect(empty.status).toBe(400);
    expect(tooShort.status).toBe(400);

    // And the order is untouched.
    const bill = await seeded.manager.get<BillingOrder>(
      `/api/billing/orders/${order.id}`,
    );
    expect(bill.status).toBe("Open");
    expect(bill.cancellation).toBeNull();
  });

  it("records the reason, who and when, and closes the order", async () => {
    const order = await placeOrder(seeded.tableId);

    const cancelled = await seeded.manager.post<BillingOrder>(
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "Guests left before the food arrived" },
    );

    expectUnion(cancelled.status, ORDER_STATUSES, "cancelled.status");
    expect(cancelled.status).toBe("Cancelled");
    expect(cancelled.cancellation).not.toBeNull();
    expectText(cancelled.cancellation!.reason, "cancellation.reason");
    expectText(cancelled.cancellation!.cancelledByName, "cancellation.cancelledByName");
    expectInstant(cancelled.cancellation!.cancelledAtUtc, "cancellation.cancelledAtUtc");
    expect(cancelled.cancellation!.reason).toBe("Guests left before the food arrived");

    // One ending, not both.
    expect(cancelled.completedAtUtc).toBeNull();
    expect(cancelled.payment).toBeNull();
    expect(cancelled.canComplete).toBe(false);
    expect(cancelled.canCancel).toBe(false);
  });

  it("keeps the lines and their prices", async () => {
    const order = await placeOrder(seeded.tableId, 3);

    const cancelled = await seeded.manager.post<BillingOrder>(
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "Order entered on the wrong table" },
    );

    // Nothing is deleted. The order keeps its number and what it would have come to.
    expect(cancelled.orderNumber).toBe(order.orderNumber);
    expect(cancelled.items).toHaveLength(1);
    expect(first(cancelled.items, "cancelled order lines").unitPrice).toBe(
      seeded.itemPrice,
    );
    expect(cancelled.subtotal).toBe(seeded.itemPrice * 3);
  });

  it("releases the table", async () => {
    const order = await placeOrder(seeded.secondTableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Guests changed their mind",
    });

    const floor = await seeded.manager.get<FloorOverview>("/api/manager/floor");
    const table = only(
      floor.tables,
      (t) => t.id === seeded.secondTableId,
      "the second table",
    );

    expect(table.status).toBe("Available");
    expect(table.openOrders).toHaveLength(0);
  });

  it("can be called off even while the kitchen is cooking, and leaves the ticket alone", async () => {
    const order = await placeOrder(seeded.tableId);

    const submitted = await seeded.waiter.post<{ ticket: KitchenTicket }>(
      `/api/waiter/orders/${order.id}/kitchen-tickets`,
    );

    await seeded.chef.put(`/api/kitchen/tickets/${submitted.ticket.id}/start`);

    const cancelled = await seeded.manager.post<BillingOrder>(
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "Guests walked out mid-service" },
    );

    // Waiting for food nobody will pay for would strand the order open forever.
    expect(cancelled.status).toBe("Cancelled");
    expect(cancelled.startedKitchenTicketCount).toBe(1);

    // The ticket records work the kitchen really did, so it must not move.
    const ticket = await seeded.chef.get<KitchenTicket>(
      `/api/kitchen/tickets/${submitted.ticket.id}`,
    );
    expect(ticket.status).toBe("Preparing");
    expectInstant(ticket.startedAtUtc, "ticket.startedAtUtc");
  });

  it("refuses a second cancellation", async () => {
    const order = await placeOrder(seeded.tableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "First reason given",
    });

    const again = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "Second reason given" },
    );

    expect(again.status).toBe(409);

    const bill = await seeded.manager.get<BillingOrder>(
      `/api/billing/orders/${order.id}`,
    );
    // The original record survives.
    expect(bill.cancellation!.reason).toBe("First reason given");
  });

  it("refuses to cancel a paid order", async () => {
    const order = await placeOrder(seeded.secondTableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Cash",
    });

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${order.id}/cancellation`,
      { reason: "Changed my mind" },
    );

    // There is no refund, so this would record money taken for nothing.
    expect(refused.status).toBe(409);
  });

  it("refuses to settle a cancelled order", async () => {
    const order = await placeOrder(seeded.tableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Table walked out",
    });

    const refused = await seeded.manager.attempt(
      "POST",
      `/api/billing/orders/${order.id}/payment`,
      { method: "Cash" },
    );

    expect(refused.status).toBe(409);
  });

  it("takes it out of the waiter list and out of the billing queue", async () => {
    const order = await placeOrder(seeded.tableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Duplicate order",
    });

    const open = await seeded.waiter.get<{ id: string }[]>("/api/waiter/orders");
    const queue = await seeded.manager.get<{ id: string }[]>("/api/billing/orders");

    expect(open.find((candidate) => candidate.id === order.id)).toBeUndefined();
    expect(queue.find((candidate) => candidate.id === order.id)).toBeUndefined();
  });

  it("appears in history filtered to cancellations, and never among payments", async () => {
    const order = await placeOrder(seeded.tableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Kitchen ran out of the dish",
    });

    const cancelledOnly = await seeded.manager.get<
      { id: string; status: string; cancellation: { reason: string } | null }[]
    >("/api/billing/history?status=Cancelled&limit=50");

    const entry = only(
      cancelledOnly,
      (candidate) => candidate.id === order.id,
      "the cancelled order in history",
    );

    expect(entry.cancellation?.reason).toBe("Kitchen ran out of the dish");
    expect(cancelledOnly.every((row) => row.status === "Cancelled")).toBe(true);

    const completedOnly = await seeded.manager.get<{ id: string }[]>(
      "/api/billing/history?status=Completed&limit=50",
    );

    expect(completedOnly.find((candidate) => candidate.id === order.id)).toBeUndefined();
  });

  it("counts today cancellations on the dashboard without counting them as takings", async () => {
    const before = await seeded.manager.get<{
      today: { cancelledCount: number; paymentTotal: number };
    }>("/api/manager/dashboard");

    const order = await placeOrder(seeded.tableId, 2);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Wrong table",
    });

    const after = await seeded.manager.get<{
      today: { cancelledCount: number; paymentTotal: number; cancelledValue: number };
    }>("/api/manager/dashboard");

    expect(after.today.cancelledCount).toBe(before.today.cancelledCount + 1);
    // A cancelled order still has a total, and it is not revenue.
    expect(after.today.paymentTotal).toBe(before.today.paymentTotal);
    expect(after.today.cancelledValue).toBeGreaterThanOrEqual(seeded.itemPrice * 2);
  });

  async function placeOrder(tableId: string, quantity = 1): Promise<Order> {
    return seeded.waiter.post<Order>("/api/waiter/orders", {
      tableId,
      items: [{ menuItemId: seeded.itemId, quantity }],
    });
  }
});
