import type { PaymentMethod } from "@/types/billing";

/**
 * What a platform administrator sees across every restaurant.
 *
 * The one part of this product that is not scoped to a single restaurant, because the
 * account it serves owns none.
 *
 * One thing to know before reading any figure here: each restaurant range is read in
 * that restaurant own timezone and service day, so the platform total is the sum of
 * exactly what each manager sees on their own report. Two rows can therefore cover
 * slightly different absolute windows, which is why every row carries the window it was
 * measured over.
 */

/** What came in by one tender, across the platform. */
export interface PlatformMethodTotal {
  method: PaymentMethod;
  count: number;
  total: number;
}

/** What one restaurant did over the range. */
export interface PlatformRestaurantRow {
  id: string;
  name: string;
  slug: string;
  /** Who runs it, or null while nobody has been assigned. */
  managerName: string | null;
  timeZoneId: string;
  dayStartHour: number;
  /** The instant this restaurant range opened, in its own calendar. */
  rangeStartUtc: string;
  /** The instant it closes, exclusive. */
  rangeEndUtc: string;
  completedCount: number;
  cancelledCount: number;
  paymentTotal: number;
  /** What its cancelled orders would have come to. Never revenue. */
  cancelledValue: number;
  averageOrderValue: number;
}

/** What the whole platform did over a range of days. */
export interface PlatformReport {
  fromLocalDate: string;
  toLocalDate: string;
  dayCount: number;
  restaurantCount: number;
  withManagerCount: number;
  /** Restaurants still waiting for a manager. These cannot trade at all. */
  withoutManagerCount: number;
  /** How many took at least one payment in the range. */
  tradingCount: number;
  completedCount: number;
  cancelledCount: number;
  paymentTotal: number;
  paymentCount: number;
  cancelledValue: number;
  averageOrderValue: number;
  byMethod: PlatformMethodTotal[];
  /** One row per restaurant, busiest first. */
  restaurants: PlatformRestaurantRow[];
}

/** One restaurant operational configuration, as the platform lists it. */
export interface PlatformRestaurantSettings {
  id: string;
  name: string;
  slug: string;
  managerName: string | null;
  managerEmail: string | null;
  timeZoneId: string;
  timeZoneDisplayName: string;
  currentUtcOffsetMinutes: number;
  dayStartHour: number;
  /** When its running service day began. The figure that proves the setting works. */
  serviceDayStartedAtUtc: string;
  tableCount: number;
  staffCount: number;
}

/**
 * The platform as a whole.
 *
 * There is deliberately no platform-wide configuration in this response, because the
 * product has none: no global currency, no global tax, no feature flags. What an
 * administrator can usefully do is see the shape of the estate and correct a restaurant
 * that was set up in the wrong timezone.
 */
export interface PlatformOverview {
  restaurantCount: number;
  withoutManagerCount: number;
  managerCount: number;
  /** Managers who own no restaurant. A real state, not a fault. */
  unassignedManagerCount: number;
  staffCount: number;
  tableCount: number;
  /** How many different zones the estate spans. */
  distinctTimeZoneCount: number;
  /** The server clock, so an odd figure can be told apart from a wrong machine. */
  serverUtcNow: string;
  restaurants: PlatformRestaurantSettings[];
}
