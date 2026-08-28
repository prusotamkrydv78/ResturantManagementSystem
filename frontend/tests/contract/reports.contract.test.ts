import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import { expectInstant, expectNumber, expectText, only } from "./support/expect";
import { seedRestaurant, seedUnassignedManager, type Seeded } from "./support/seed";
import { PAYMENT_METHODS } from "./support/unions";
import type { Order } from "@/types/order";
import type { ReportSummary } from "@/types/report";

/**
 * Reports, and the one thing they must never do.
 *
 * A cancelled order has a total, and adding it to the takings would be the easiest way
 * to make this feature lie. Several tests below exist only to hold that line.
 *
 * The rest is about the range meaning what a manager thinks it means: their days, in
 * their timezone, with the boundaries stated rather than implied.
 */
describe("reports", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Report");
  });

  it("defaults to today and says which day that was", async () => {
    const report = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    expect(report.dayCount).toBe(1);
    expect(report.fromLocalDate).toBe(report.toLocalDate);
    expectText(report.timeZoneId, "report.timeZoneId");
    // The boundaries are sent so what was counted is auditable rather than implied.
    expectInstant(report.rangeStartUtc, "report.rangeStartUtc");
    expectInstant(report.rangeEndUtc, "report.rangeEndUtc");
    expect(new Date(report.rangeEndUtc).getTime()).toBeGreaterThan(
      new Date(report.rangeStartUtc).getTime(),
    );
  });

  it("counts a settled order as collected", async () => {
    const before = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    const order = await placeOrder(seeded.tableId, 2);
    await settle(order.id, "Cash");

    const after = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    expect(after.completedCount).toBe(before.completedCount + 1);
    expect(after.paymentCount).toBe(before.paymentCount + 1);
    expect(after.paymentTotal).toBe(before.paymentTotal + seeded.itemPrice * 2);
  });

  it("never counts a cancelled order as revenue", async () => {
    const before = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    const order = await placeOrder(seeded.secondTableId, 4);
    await seeded.manager.post(`/api/billing/orders/${order.id}/cancellation`, {
      reason: "Guests walked out",
    });

    const after = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    // The count and the forgone value move; the takings do not. This is the line the
    // whole feature rests on.
    expect(after.cancelledCount).toBe(before.cancelledCount + 1);
    expect(after.cancelledValue).toBe(before.cancelledValue + seeded.itemPrice * 4);
    expect(after.paymentTotal).toBe(before.paymentTotal);
    expect(after.paymentCount).toBe(before.paymentCount);
    expect(after.completedCount).toBe(before.completedCount);
  });

  it("keeps the takings equal to the sum of the method breakdown", async () => {
    const report = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    const summed = report.byMethod.reduce((total, row) => total + row.total, 0);
    const counted = report.byMethod.reduce((total, row) => total + row.count, 0);

    // If these could differ, one of the two figures on the screen would be wrong and
    // there would be no way to tell which.
    expect(summed).toBe(report.paymentTotal);
    expect(counted).toBe(report.paymentCount);
  });

  it("lists every payment method even when nothing came in on it", async () => {
    const report = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    expect(report.byMethod).toHaveLength(PAYMENT_METHODS.length);

    for (const method of PAYMENT_METHODS) {
      const row = only(report.byMethod, (r) => r.method === method, `the ${method} row`);
      expectNumber(row.total, `${method} total`);
      expectNumber(row.count, `${method} count`);
    }
  });

  it("splits the takings by the method actually used", async () => {
    const fresh = await seedRestaurant("ReportMethods");

    const cash = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 1 }],
    });
    await fresh.manager.post(`/api/billing/orders/${cash.id}/payment`, {
      method: "Cash",
    });

    const card = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.secondTableId,
      items: [{ menuItemId: fresh.itemId, quantity: 2 }],
    });
    await fresh.manager.post(`/api/billing/orders/${card.id}/payment`, {
      method: "Card",
    });

    const report = await fresh.manager.get<ReportSummary>("/api/reports/summary");

    expect(only(report.byMethod, (r) => r.method === "Cash", "cash").total).toBe(
      fresh.itemPrice,
    );
    expect(only(report.byMethod, (r) => r.method === "Card", "card").total).toBe(
      fresh.itemPrice * 2,
    );
    expect(only(report.byMethod, (r) => r.method === "Digital", "digital").total).toBe(0);
    expect(report.paymentTotal).toBe(fresh.itemPrice * 3);
  });

  it("computes the average bill from the payments, and zero when there are none", async () => {
    const empty = await seedRestaurant("ReportAverage");

    const none = await empty.manager.get<ReportSummary>("/api/reports/summary");
    // Not a division by zero, and not null: a screen would have to special-case both.
    expect(none.averageOrderValue).toBe(0);

    const order = await empty.waiter.post<Order>("/api/waiter/orders", {
      tableId: empty.tableId,
      items: [{ menuItemId: empty.itemId, quantity: 2 }],
    });
    await empty.manager.post(`/api/billing/orders/${order.id}/payment`, {
      method: "Cash",
    });

    const one = await empty.manager.get<ReportSummary>("/api/reports/summary");
    expect(one.averageOrderValue).toBe(empty.itemPrice * 2);
  });

  it("lists the orders behind the figures", async () => {
    const fresh = await seedRestaurant("ReportRows");

    const paid = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.tableId,
      items: [{ menuItemId: fresh.itemId, quantity: 1 }],
    });
    await fresh.manager.post(`/api/billing/orders/${paid.id}/payment`, {
      method: "Digital",
    });

    const voided = await fresh.waiter.post<Order>("/api/waiter/orders", {
      tableId: fresh.secondTableId,
      items: [{ menuItemId: fresh.itemId, quantity: 1 }],
    });
    await fresh.manager.post(`/api/billing/orders/${voided.id}/cancellation`, {
      reason: "Kitchen ran out",
    });

    const report = await fresh.manager.get<ReportSummary>("/api/reports/summary");

    const completedRow = only(report.completed, (r) => r.id === paid.id, "the paid row");
    expect(completedRow.method).toBe("Digital");
    expect(completedRow.reason).toBeNull();
    expect(completedRow.amount).toBe(fresh.itemPrice);

    const cancelledRow = only(
      report.cancelled,
      (r) => r.id === voided.id,
      "the cancelled row",
    );
    // A cancelled row carries its reason and no method, which is how a screen tells
    // the two apart without consulting the list it came from.
    expect(cancelledRow.method).toBeNull();
    expect(cancelledRow.reason).toBe("Kitchen ran out");

    // And the lists never overlap.
    expect(report.completed.some((r) => r.id === voided.id)).toBe(false);
    expect(report.cancelled.some((r) => r.id === paid.id)).toBe(false);
  });

  it("reads a single date as that one day", async () => {
    const today = (await seeded.manager.get<ReportSummary>("/api/reports/summary"))
      .fromLocalDate;

    const report = await seeded.manager.get<ReportSummary>(
      `/api/reports/summary?from=${today}`,
    );

    expect(report.dayCount).toBe(1);
    expect(report.fromLocalDate).toBe(today);
    expect(report.toLocalDate).toBe(today);
  });

  it("covers a range inclusive of both ends", async () => {
    const report = await seeded.manager.get<ReportSummary>(
      "/api/reports/summary?from=2026-08-01&to=2026-08-07",
    );

    expect(report.fromLocalDate).toBe("2026-08-01");
    expect(report.toLocalDate).toBe("2026-08-07");
    // Seven days, not six: a manager asking for the 1st to the 7th means both.
    expect(report.dayCount).toBe(7);
  });

  it("finds nothing in a range before the restaurant existed", async () => {
    const report = await seeded.manager.get<ReportSummary>(
      "/api/reports/summary?from=2020-01-01&to=2020-01-07",
    );

    expect(report.completedCount).toBe(0);
    expect(report.cancelledCount).toBe(0);
    expect(report.paymentTotal).toBe(0);
    expect(report.cancelledValue).toBe(0);
    expect(report.completed).toHaveLength(0);
    expect(report.cancelled).toHaveLength(0);
    // The shape does not change just because the range is empty.
    expect(report.byMethod).toHaveLength(PAYMENT_METHODS.length);
  });

  it("reads the range in the restaurant timezone rather than the server one", async () => {
    const zoned = await seedRestaurant("ReportZone");

    await zoned.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "UTC",
      dayStartHour: 0,
    });
    const utc = await zoned.manager.get<ReportSummary>(
      "/api/reports/summary?from=2026-08-10&to=2026-08-10",
    );

    await zoned.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "Asia/Kathmandu",
      dayStartHour: 0,
    });
    const kathmandu = await zoned.manager.get<ReportSummary>(
      "/api/reports/summary?from=2026-08-10&to=2026-08-10",
    );

    // The same requested date resolves to a different instant, because the restaurant
    // day is not the server day.
    const difference =
      new Date(utc.rangeStartUtc).getTime() -
      new Date(kathmandu.rangeStartUtc).getTime();

    expect(difference).toBe(345 * 60 * 1000);
    expect(kathmandu.timeZoneId).toBe("Asia/Kathmandu");
  });

  it("honours the day start hour in the range boundary", async () => {
    const zoned = await seedRestaurant("ReportDayStart");

    await zoned.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "UTC",
      dayStartHour: 0,
    });
    const midnight = await zoned.manager.get<ReportSummary>(
      "/api/reports/summary?from=2026-08-10&to=2026-08-10",
    );

    await zoned.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "UTC",
      dayStartHour: 5,
    });
    const fiveAm = await zoned.manager.get<ReportSummary>(
      "/api/reports/summary?from=2026-08-10&to=2026-08-10",
    );

    const shift =
      new Date(fiveAm.rangeStartUtc).getTime() -
      new Date(midnight.rangeStartUtc).getTime();

    // A restaurant whose day starts at five counts from five, so late takings land on
    // the evening that earned them.
    expect(shift).toBe(5 * 3600_000);
  });

  it("refuses a range that runs backwards", async () => {
    const refused = await seeded.manager.attempt(
      "GET",
      "/api/reports/summary?from=2026-08-10&to=2026-08-01",
    );

    // Refused rather than silently swapped: a manager who typed the dates the wrong
    // way round should be told.
    expect(refused.status).toBe(400);
  });

  it("refuses a range longer than it will cover", async () => {
    const refused = await seeded.manager.attempt(
      "GET",
      "/api/reports/summary?from=2020-01-01&to=2026-01-01",
    );

    // There is no pagination, so an unbounded range would be an unbounded query. Named
    // limit rather than silent truncation, which would read as covering everything.
    expect(refused.status).toBe(400);
  });

  it("refuses a date that is not a date", async () => {
    const refused = await seeded.manager.attempt(
      "GET",
      "/api/reports/summary?from=not-a-date",
    );

    expect(refused.status).toBe(400);
  });

  it("keeps one restaurant figures out of another", async () => {
    const other = await seedRestaurant("ReportIsolation");

    const theirs = await other.waiter.post<Order>("/api/waiter/orders", {
      tableId: other.tableId,
      items: [{ menuItemId: other.itemId, quantity: 5 }],
    });
    await other.manager.post(`/api/billing/orders/${theirs.id}/payment`, {
      method: "Cash",
    });

    const mine = await seeded.manager.get<ReportSummary>("/api/reports/summary");

    expect(mine.completed.some((row) => row.id === theirs.id)).toBe(false);
  });

  it("refuses every role that does not own a restaurant", async () => {
    for (const caller of [seeded.waiter, seeded.chef, seeded.cashier]) {
      expect(
        (await caller.attempt("GET", "/api/reports/summary")).status,
      ).toBeGreaterThanOrEqual(400);
    }

    const orphan = await seedUnassignedManager();
    expect((await orphan.attempt("GET", "/api/reports/summary")).status).toBe(404);
  });

  async function placeOrder(tableId: string, quantity = 1): Promise<Order> {
    return seeded.waiter.post<Order>("/api/waiter/orders", {
      tableId,
      items: [{ menuItemId: seeded.itemId, quantity }],
    });
  }

  async function settle(orderId: string, method: string): Promise<void> {
    await seeded.manager.post(`/api/billing/orders/${orderId}/payment`, { method });
  }
});
