import type { ManagerFilter } from "@/types/manager";

/**
 * Query keys for the platform console.
 *
 * Hierarchical, so a change can invalidate a whole family at once: renaming a
 * restaurant invalidates ["restaurants"], which reaches the list, the detail and the
 * staff of every restaurant without naming each. The platform figures sit under their
 * own root because they are computed from orders, not from the rows a restaurant or
 * manager edit touches.
 *
 * Every key the admin queries use is built here and nowhere else, so an invalidation
 * and the query it means to reach can never disagree about spelling.
 */
export const adminKeys = {
  restaurants: ["restaurants"] as const,
  restaurantList: () => ["restaurants", "list"] as const,
  restaurant: (id: string) => ["restaurants", "detail", id] as const,
  restaurantStaff: (id: string) => ["restaurants", "staff", id] as const,

  managers: ["managers"] as const,
  managerList: (filter: { search?: string; status?: ManagerFilter } = {}) =>
    ["managers", "list", filter] as const,
  manager: (id: string) => ["managers", "detail", id] as const,

  platform: ["platform"] as const,
  pulse: () => ["platform", "pulse"] as const,
  report: (range: { from?: string; to?: string }) => ["platform", "report", range] as const,
  platformRestaurant: (id: string) => ["platform", "restaurant", id] as const,
  activity: () => ["platform", "activity"] as const,
  activityPage: (limit: number) => ["platform", "activity", limit] as const,
  settings: () => ["platform", "settings"] as const,
  system: () => ["platform", "system"] as const,
};

/** How often a live figure refreshes while its screen is open. */
export const LIVE_INTERVAL = 30_000;
