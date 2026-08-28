import { describe, expect, it } from "vitest";
import { navigationFor, roleLabel } from "@/components/layout/nav-config";
import type { PlatformRole } from "@/types/auth";
import type { StaffRole } from "@/types/staff";

/**
 * What each role is offered in the sidebar.
 *
 * Visibility is presentation only and the API authorises independently, so these are
 * not security tests. They protect something else: that a role is never shown a link
 * it cannot use, and never loses the one it needs. A chef sent to the waiter order
 * screens would hit a wall of refusals, and a waiter with no Floor link would have no
 * way into their own shift.
 *
 * They also pin the thing that actually broke once: staff branch on their operational
 * role, not their platform role, and an unrecognised role has nothing built for it.
 */
describe("navigation by role", () => {
  /** Every href a role is offered, flattened across groups. */
  function hrefsFor(role: PlatformRole | undefined, staffRole?: StaffRole | null) {
    return navigationFor(role, staffRole)
      .flatMap((group) => group.items)
      .filter((item) => item.status === "available")
      .map((item) => item.href);
  }

  /** Anything listed but not built, which must never be a working link. */
  function plannedFor(role: PlatformRole | undefined, staffRole?: StaffRole | null) {
    return navigationFor(role, staffRole)
      .flatMap((group) => group.items)
      .filter((item) => item.status === "planned");
  }

  it("gives a waiter the floor, orders and a way to start one", () => {
    const hrefs = hrefsFor("Staff", "Waiter");

    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/floor");
    expect(hrefs).toContain("/orders");
    expect(hrefs).toContain("/orders/new");
  });

  it("keeps manager and admin areas away from a waiter", () => {
    const hrefs = hrefsFor("Staff", "Waiter");

    for (const forbidden of [
      "/menu",
      "/tables",
      "/staff",
      "/billing",
      "/billing/history",
      "/my-restaurant",
      "/settings",
      "/reports",
      "/inventory",
      "/reservations",
      "/customers",
      "/kitchen",
      "/admin/restaurants",
      "/admin/managers",
    ]) {
      expect(hrefs).not.toContain(forbidden);
    }
  });

  it("gives a chef the kitchen and nothing else", () => {
    const hrefs = hrefsFor("Staff", "Chef");

    expect(hrefs).toEqual(["/dashboard", "/kitchen"]);
  });

  it("keeps the waiter order screens away from a chef", () => {
    const hrefs = hrefsFor("Staff", "Chef");

    expect(hrefs).not.toContain("/orders");
    expect(hrefs).not.toContain("/orders/new");
    expect(hrefs).not.toContain("/floor");
  });

  it("gives a manager the live areas and the setup areas", () => {
    const hrefs = hrefsFor("RestaurantManager");

    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/floor");
    expect(hrefs).toContain("/billing");
    expect(hrefs).toContain("/menu");
    expect(hrefs).toContain("/tables");
    expect(hrefs).toContain("/staff");
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/inventory");
    expect(hrefs).toContain("/reservations");
    expect(hrefs).toContain("/customers");
  });

  it("keeps platform administration away from a manager", () => {
    const hrefs = hrefsFor("RestaurantManager");

    expect(hrefs).not.toContain("/admin/restaurants");
    expect(hrefs).not.toContain("/admin/managers");
  });

  it("keeps the kitchen rail away from a manager", () => {
    // A manager who needs to see the rail can stand next to it. Configuring a
    // restaurant and cooking in it are different jobs.
    expect(hrefsFor("RestaurantManager")).not.toContain("/kitchen");
  });

  it("gives a super admin the platform areas and no restaurant floor", () => {
    const hrefs = hrefsFor("SuperAdmin");

    expect(hrefs).toContain("/admin/restaurants");
    expect(hrefs).toContain("/admin/managers");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).not.toContain("/floor");
    expect(hrefs).not.toContain("/billing");
    expect(hrefs).not.toContain("/kitchen");
    expect(hrefs).not.toContain("/reservations");
    expect(hrefs).not.toContain("/customers");
  });

  it("sends a super admin to the platform reports, not a manager own", () => {
    // The two answer different questions: a manager wants the rows behind their own
    // figures, an administrator wants to know which restaurants are trading at all.
    // Pointing both at one route would have to narrow itself by role at run time.
    const hrefs = hrefsFor("SuperAdmin");

    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/settings");
  });

  it("keeps the platform areas away from a restaurant manager", () => {
    const hrefs = hrefsFor("RestaurantManager");

    expect(hrefs).not.toContain("/admin/reports");
    expect(hrefs).not.toContain("/admin/settings");
  });

  it("gives a staff role this build does not know only the overview", () => {
    // Cashier was removed, but a record written by an older build can still carry
    // a role that is no longer in the union. The cast is the point of the test:
    // it reproduces what arrives from the API, which TypeScript cannot police.
    const unknown = "Cashier" as unknown as StaffRole;

    expect(hrefsFor("Staff", unknown)).toEqual(["/dashboard"]);
    expect(plannedFor("Staff", unknown)).toHaveLength(0);
  });

  it("gives staff with no operational role only the overview", () => {
    expect(hrefsFor("Staff", null)).toEqual(["/dashboard"]);
    expect(hrefsFor("Staff", undefined)).toEqual(["/dashboard"]);
  });

  it("gives an unprivileged account only the overview", () => {
    expect(hrefsFor("User")).toEqual(["/dashboard"]);
    expect(hrefsFor(undefined)).toEqual(["/dashboard"]);
  });

  it("never offers a planned item as a working link", () => {
    const roles: (PlatformRole | undefined)[] = [
      "SuperAdmin",
      "RestaurantManager",
      "Staff",
      "User",
      undefined,
    ];

    for (const role of roles) {
      for (const item of plannedFor(role)) {
        // A planned row is a signpost, not a door.
        expect(item.href).toBeUndefined();
      }
    }
  });

  it("labels staff by what they do on the floor", () => {
    expect(roleLabel("Staff", "Waiter")).toBe("Waiter");
    expect(roleLabel("Staff", "Chef")).toBe("Chef");
    expect(roleLabel("Staff", null)).toBe("Restaurant staff");
    expect(roleLabel("RestaurantManager")).toBe("Restaurant manager");
    expect(roleLabel("SuperAdmin")).toBe("Platform admin");
    expect(roleLabel("User")).toBe("Member");
  });
});
