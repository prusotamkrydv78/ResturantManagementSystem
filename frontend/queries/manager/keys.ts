import type { OrderStatus } from "@/types/order";

/**
 * Query keys for the restaurant console.
 *
 * Everything sits under one root, so signing out or a reconnect can mark the whole
 * restaurant stale at once, and each area has its own branch so a change reaches
 * exactly the screens it affects: settling a bill touches billing, the floor and
 * today's figures, and nothing on the menu.
 *
 * Built here and nowhere else, so an invalidation and the query it means to reach
 * can never disagree about spelling. Same rule as the platform console's keys.
 */
export const managerKeys = {
  all: ["restaurant"] as const,

  /** Today's figures on the overview. */
  dashboard: () => ["restaurant", "dashboard"] as const,
  /** The restaurant's own record. */
  profile: () => ["restaurant", "profile"] as const,

  /** Service: what is happening right now. */
  service: ["restaurant", "service"] as const,
  floor: (role: "manager" | "waiter") => ["restaurant", "service", "floor", role] as const,
  kitchen: () => ["restaurant", "service", "kitchen"] as const,
  pass: () => ["restaurant", "service", "pass"] as const,

  /** Money. */
  billing: ["restaurant", "billing"] as const,
  billingList: () => ["restaurant", "billing", "list"] as const,
  bill: (id: string) => ["restaurant", "billing", "order", id] as const,
  history: (status: Exclude<OrderStatus, "Open"> | "All") => ["restaurant", "billing", "history", status] as const,
  reports: ["restaurant", "reports"] as const,
  report: (range: { from: string; to: string }) => ["restaurant", "reports", range] as const,

  /** Bookings and guests. */
  reservations: (options: { onDate: string; includeClosed: boolean }) =>
    ["restaurant", "reservations", options] as const,
  reviews: () => ["restaurant", "reviews"] as const,

  /** The menu. */
  menu: ["restaurant", "menu"] as const,
  categories: () => ["restaurant", "menu", "categories"] as const,
  items: (filter: { search: string; categoryId: string }) => ["restaurant", "menu", "items", filter] as const,
  item: (id: string) => ["restaurant", "menu", "item", id] as const,

  /** Setup. */
  tables: () => ["restaurant", "setup", "tables"] as const,
  staff: (search: string) => ["restaurant", "setup", "staff", search] as const,
  inventory: (includeArchived: boolean) => ["restaurant", "setup", "inventory", includeArchived] as const,
  customers: (filter: { search: string; includeInactive: boolean }) =>
    ["restaurant", "setup", "customers", filter] as const,
  site: () => ["restaurant", "setup", "site"] as const,
};

/**
 * The safety net under the server's signals.
 *
 * Live screens update by signal (see live.ts); this slow poll only covers a signal
 * that went missing, and keeps "12 min ago" labels honest.
 */
export const LIVE_INTERVAL = 60_000;
