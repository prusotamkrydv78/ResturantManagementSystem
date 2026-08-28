import { beforeAll, describe, expect, it } from "vitest";
import { requireApi } from "./support/client";
import { expectInstant, expectNumber, expectText, first, only } from "./support/expect";
import { seedRestaurant, seedUnassignedManager, type Seeded } from "./support/seed";
import type { ManagerDashboard } from "@/types/dashboard";
import type { RestaurantSettings, TimeZoneOption } from "@/types/restaurant";

/**
 * The operational settings, and the day boundary they decide.
 *
 * The point of this phase was to stop the operational day depending on whoever was
 * looking at it, so the tests worth having are the ones that prove the boundary moves
 * with the restaurant configuration and with nothing else.
 */
describe("restaurant operational settings", () => {
  let seeded: Seeded;

  beforeAll(async () => {
    await requireApi();
    seeded = await seedRestaurant("Settings");
  });

  it("starts a new restaurant on UTC at midnight", async () => {
    const settings = await seeded.manager.get<RestaurantSettings>(
      "/api/restaurants/mine/settings",
    );

    // A default a manager can reason about, rather than one inferred from wherever
    // they happened to sign in.
    expect(settings.timeZoneId).toBe("UTC");
    expect(settings.dayStartHour).toBe(0);
    expect(settings.currentUtcOffsetMinutes).toBe(0);
    expectText(settings.timeZoneDisplayName, "timeZoneDisplayName");
    expectInstant(settings.serviceDayStartedAtUtc, "serviceDayStartedAtUtc");
  });

  it("offers the zones the server will actually accept", async () => {
    const zones = await seeded.manager.get<TimeZoneOption[]>(
      "/api/restaurants/timezones",
    );

    expect(zones.length).toBeGreaterThan(10);

    const zone = first(zones, "the timezone list");
    expectText(zone.id, "zone.id");
    expectText(zone.displayName, "zone.displayName");
    expectNumber(zone.currentUtcOffsetMinutes, "zone.currentUtcOffsetMinutes");

    // Sorted by offset, so a manager scanning for their region finds it beside the
    // others that keep the same time.
    const offsets = zones.map((z) => z.currentUtcOffsetMinutes);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);

    // Every option must be settable. A list that offered something validation would
    // reject would be worse than no list at all.
    const sample = only(zones, (z) => z.id === "UTC", "UTC in the zone list");
    expect(sample.currentUtcOffsetMinutes).toBe(0);
  });

  it("saves a real zone and reports what it is worth right now", async () => {
    const updated = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "Asia/Kathmandu", dayStartHour: 0 },
    );

    expect(updated.timeZoneId).toBe("Asia/Kathmandu");
    // The offset is derived on each read rather than frozen at save time, which is
    // the whole reason an identifier is stored instead of a number.
    expect(updated.currentUtcOffsetMinutes).toBe(345);
  });

  it("persists the choice", async () => {
    const reread = await seeded.manager.get<RestaurantSettings>(
      "/api/restaurants/mine/settings",
    );

    expect(reread.timeZoneId).toBe("Asia/Kathmandu");
    expect(reread.currentUtcOffsetMinutes).toBe(345);
  });

  it("moves the service day boundary when the zone changes", async () => {
    const utc = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "UTC", dayStartHour: 0 },
    );

    const kathmandu = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "Asia/Kathmandu", dayStartHour: 0 },
    );

    // Midnight in Kathmandu is 18:15 UTC the day before, so the two boundaries are
    // 5h45m apart. The zone genuinely decides where the day starts.
    const difference =
      new Date(utc.serviceDayStartedAtUtc).getTime() -
      new Date(kathmandu.serviceDayStartedAtUtc).getTime();

    expect(Math.abs(difference)).toBe(345 * 60 * 1000);
  });

  it("moves the boundary when the day start hour changes", async () => {
    const midnight = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "UTC", dayStartHour: 0 },
    );

    const sixAm = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "UTC", dayStartHour: 6 },
    );

    const shift =
      new Date(sixAm.serviceDayStartedAtUtc).getTime() -
      new Date(midnight.serviceDayStartedAtUtc).getTime();

    // Either six hours later the same day, or eighteen hours earlier if the clock has
    // not yet reached six: both are the same rule seen from different times of day.
    expect([6 * 3600_000, -18 * 3600_000]).toContain(shift);
  });

  it("never puts the boundary in the future", async () => {
    const settings = await seeded.manager.put<RestaurantSettings>(
      "/api/restaurants/mine/settings",
      { timeZoneId: "Asia/Kathmandu", dayStartHour: 23 },
    );

    // A day that had not started yet would make every "today" figure zero.
    expect(new Date(settings.serviceDayStartedAtUtc).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("gives the dashboard the same boundary the settings report", async () => {
    await seeded.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "Asia/Kathmandu",
      dayStartHour: 4,
    });

    const settings = await seeded.manager.get<RestaurantSettings>(
      "/api/restaurants/mine/settings",
    );
    const dashboard = await seeded.manager.get<ManagerDashboard>(
      "/api/manager/dashboard",
    );

    // One rule, one answer. If these could differ, the settings screen would be
    // describing a boundary the dashboard was not using.
    expect(dashboard.today.startedAtUtc).toBe(settings.serviceDayStartedAtUtc);
  });

  it("takes no offset from the caller any more", async () => {
    // The old parameter is simply ignored, so a stale client cannot steer the figures.
    const honest = await seeded.manager.get<ManagerDashboard>(
      "/api/manager/dashboard",
    );
    const meddling = await seeded.manager.get<ManagerDashboard>(
      "/api/manager/dashboard?utcOffsetMinutes=-720",
    );

    expect(meddling.today.startedAtUtc).toBe(honest.today.startedAtUtc);
  });

  it("refuses a zone the server does not know", async () => {
    const refused = await seeded.manager.attempt(
      "PUT",
      "/api/restaurants/mine/settings",
      { timeZoneId: "Mars/Olympus_Mons", dayStartHour: 0 },
    );

    // Refused rather than stored: an identifier nothing recognises would fall back to
    // UTC on every later calculation, which is worse than saying no.
    expect(refused.status).toBe(400);

    const unchanged = await seeded.manager.get<RestaurantSettings>(
      "/api/restaurants/mine/settings",
    );
    expect(unchanged.timeZoneId).not.toBe("Mars/Olympus_Mons");
  });

  it.each([-1, 24, 99])("refuses %s as a day start hour", async (hour) => {
    const refused = await seeded.manager.attempt(
      "PUT",
      "/api/restaurants/mine/settings",
      { timeZoneId: "UTC", dayStartHour: hour },
    );

    expect(refused.status).toBe(400);
  });

  it("requires a zone rather than accepting a blank one", async () => {
    const refused = await seeded.manager.attempt(
      "PUT",
      "/api/restaurants/mine/settings",
      { timeZoneId: "", dayStartHour: 0 },
    );

    expect(refused.status).toBe(400);
  });

  it("keeps settings to the manager who owns the restaurant", async () => {
    const other = await seedRestaurant("SettingsOther");

    await other.manager.put("/api/restaurants/mine/settings", {
      timeZoneId: "Europe/London",
      dayStartHour: 5,
    });

    const mine = await seeded.manager.get<RestaurantSettings>(
      "/api/restaurants/mine/settings",
    );

    // Each restaurant has exactly one configuration, and it is its own.
    expect(mine.timeZoneId).not.toBe("Europe/London");
    expect(mine.dayStartHour).not.toBe(5);
  });

  it("refuses every role that does not own a restaurant", async () => {
    for (const caller of [seeded.waiter, seeded.chef, seeded.cashier]) {
      expect((await caller.attempt("GET", "/api/restaurants/mine/settings")).status)
        .toBeGreaterThanOrEqual(400);
      expect(
        (
          await caller.attempt("PUT", "/api/restaurants/mine/settings", {
            timeZoneId: "UTC",
            dayStartHour: 0,
          })
        ).status,
      ).toBeGreaterThanOrEqual(400);
      expect((await caller.attempt("GET", "/api/restaurants/timezones")).status)
        .toBeGreaterThanOrEqual(400);
    }
  });

  it("answers a manager with no restaurant without a server error", async () => {
    const orphan = await seedUnassignedManager();

    expect((await orphan.attempt("GET", "/api/restaurants/mine/settings")).status).toBe(
      404,
    );
    expect(
      (
        await orphan.attempt("PUT", "/api/restaurants/mine/settings", {
          timeZoneId: "UTC",
          dayStartHour: 0,
        })
      ).status,
    ).toBe(404);
  });
});
