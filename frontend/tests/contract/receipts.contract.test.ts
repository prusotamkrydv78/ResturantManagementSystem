import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import {
  expectInstant,
  expectNumber,
  expectText,
  first,
  expectUnion,
} from "./support/expect";
import { seedRestaurant, seedUnassignedManager, type Seeded } from "./support/seed";
import { PAYMENT_METHODS } from "./support/unions";
import type { Order } from "@/types/order";
import type { Receipt } from "@/types/receipt";

/**
 * Receipts, and the orders that must never have one.
 *
 * The rule worth guarding hardest is the negative: a receipt states that a table
 * settled a bill, so producing one for an open or cancelled order would be the system
 * asserting something untrue about money. Everything else here is about the document
 * matching the records it was built from.
 */
describe("receipts", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Receipt");
  });

  it("refuses a receipt for an order that is still open", async () => {
    const order = await placeOrder(seeded.tableId);

    const refused = await seeded.manager.attempt(
      "GET",
      `/api/billing/orders/${order.id}/receipt`,
    );

    // Nothing has been paid, so there is nothing to give a receipt for.
    expect(refused.status).toBe(409);
  });

  it("refuses a receipt for a cancelled order", async () => {
    const order = await placeOrder(seeded.tableId);

    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Guests left before ordering arrived",
    });

    const refused = await seeded.manager.attempt(
      "GET",
      `/api/billing/orders/${order.id}/receipt`,
    );

    // A cancelled order will never be paid, so a receipt would be a lie rather than
    // merely premature.
    expect(refused.status).toBe(409);
  });

  it("produces a receipt for a settled order that matches the payment", async () => {
    const order = await placeOrder(seeded.secondTableId, 3);

    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Card",
    });

    const receipt = await seeded.manager.get<Receipt>(
      `/api/billing/orders/${order.id}/receipt`,
    );

    expectText(receipt.restaurantName, "receipt.restaurantName");
    expect(receipt.orderNumber).toBe(order.orderNumber);
    expect(receipt.tableName).toBe(seeded.secondTableName);
    expectText(receipt.placedByName, "receipt.placedByName");
    expectText(receipt.recordedByName, "receipt.recordedByName");
    expectUnion(receipt.paymentMethod, PAYMENT_METHODS, "receipt.paymentMethod");
    expect(receipt.paymentMethod).toBe("Card");

    // The amount on the paper is the amount in the payment record, and both are the
    // server total. Nothing here came from the client.
    expect(receipt.amountPaid).toBe(seeded.itemPrice * 3);
    expect(receipt.total).toBe(seeded.itemPrice * 3);
    expect(receipt.itemCount).toBe(3);

    expectInstant(receipt.openedAtUtc, "receipt.openedAtUtc");
    expectInstant(receipt.closedAtUtc, "receipt.closedAtUtc");
    expectInstant(receipt.paidAtUtc, "receipt.paidAtUtc");
  });

  it("lists the lines at the prices they were charged at", async () => {
    const order = await placeOrder(seeded.tableId, 2, "No onion");

    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Cash",
    });

    const receipt = await seeded.manager.get<Receipt>(
      `/api/billing/orders/${order.id}/receipt`,
    );

    const line = first(receipt.lines, "receipt lines");

    expectNumber(line.unitPrice, "line.unitPrice");
    expect(line.unitPrice).toBe(seeded.itemPrice);
    expect(line.quantity).toBe(2);
    expect(line.lineTotal).toBe(seeded.itemPrice * 2);
    expect(line.note).toBe("No onion");

    // The lines have to add up to what was charged, or the paper contradicts itself.
    const summed = receipt.lines.reduce((total, l) => total + l.lineTotal, 0);
    expect(summed).toBe(receipt.total);
  });

  it("does not change a menu price already on a receipt", async () => {
    const order = await placeOrder(seeded.secondTableId);
    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Cash",
    });

    const before = await seeded.manager.get<Receipt>(
      `/api/billing/orders/${order.id}/receipt`,
    );

    await seeded.manager.put(`/api/menu/items/${seeded.itemId}`, {
      name: "Chicken Burger",
      price: 99,
      categoryId: seeded.categoryId,
    });

    const after = await seeded.manager.get<Receipt>(
      `/api/billing/orders/${order.id}/receipt`,
    );

    // A receipt is a record of what was charged. Re-pricing the menu must not reach
    // back into it.
    expect(after.total).toBe(before.total);
    expect(first(after.lines, "receipt lines").unitPrice).toBe(seeded.itemPrice);
  });

  it("gives the same receipt every time it is asked", async () => {
    const order = await placeOrder(seeded.tableId);
    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Digital",
    });

    const path = `/api/billing/orders/${order.id}/receipt`;
    const [one, two] = await Promise.all([
      seeded.manager.get<Receipt>(path),
      seeded.manager.get<Receipt>(path),
    ]);

    // Nothing is created by asking, so there is no receipt number to increment and no
    // second document to reconcile.
    expect(two).toEqual(one);
  });

  it("hides a receipt from another restaurant behind a not-found", async () => {
    const other = await seedRestaurant("ReceiptOther");

    const theirs = await other.waiter.post<Order>("/api/waiter/orders", {
      tableId: other.tableId,
      items: [{ menuItemId: other.itemId, quantity: 1 }],
    });
    await other.manager.post(`/api/billing/orders/${theirs.id}/payment`, {
      method: "Cash",
    });

    const refused = await seeded.manager.attempt(
      "GET",
      `/api/billing/orders/${theirs.id}/receipt`,
    );

    expect(refused.status).toBe(404);
  });

  it("refuses every role that does not own the restaurant", async () => {
    const order = await placeOrder(seeded.secondTableId);
    await seeded.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Cash",
    });

    for (const caller of [seeded.waiter, seeded.chef, seeded.cashier]) {
      const refused = await caller.attempt(
        "GET",
        `/api/billing/orders/${order.id}/receipt`,
      );

      expect(refused.status).toBeGreaterThanOrEqual(400);
    }

    const orphan = await seedUnassignedManager();
    expect(
      (await orphan.attempt("GET", `/api/billing/orders/${order.id}/receipt`)).status,
    ).toBe(404);
  });

  it("answers a receipt for an order that does not exist with a not-found", async () => {
    const refused = await seeded.manager.attempt(
      "GET",
      "/api/billing/orders/00000000-0000-0000-0000-0000000000ff/receipt",
    );

    expect(refused.status).toBe(404);
  });

  async function placeOrder(
    tableId: string,
    quantity = 1,
    note?: string,
  ): Promise<Order> {
    return seeded.waiter.post<Order>("/api/waiter/orders", {
      tableId,
      items: [{ menuItemId: seeded.itemId, quantity, note }],
    });
  }
});
