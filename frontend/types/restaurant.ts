/** The manager assigned to a restaurant. */
export interface RestaurantManager {
  id: string;
  fullName: string;
  email: string;
}

/** Full restaurant detail. */
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  manager: RestaurantManager | null;
  /** False when suspended: no new order may be opened, staff or guest. */
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Condensed restaurant row for list views. */
export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  managerId: string | null;
  managerName: string | null;
  managerEmail: string | null;
  /** False when suspended: no new order may be opened, staff or guest. */
  isActive: boolean;
  createdAtUtc: string;
}

/** Payload for creating a restaurant. */
export interface CreateRestaurantPayload {
  name: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  city?: string;
  country?: string;
}

/** The fields a manager may change on their own restaurant. */
export interface UpdateMyRestaurantPayload {
  name: string;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

/**
 * The fields a Super Admin may change on any restaurant.
 *
 * Separate from `UpdateMyRestaurantPayload` because only this one carries the slug.
 * Leave `slug` undefined to keep the current value: the slug is what guest ordering
 * links are built from, so an edit that only fixes a name should not restate it.
 */
export interface UpdateRestaurantPayload {
  name: string;
  slug?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
}

/**
 * How a restaurant is configured to operate.
 *
 * Kept apart from the profile above. The profile is what a guest would recognise;
 * these are the values the system computes with, and getting one wrong makes a
 * figure wrong rather than a page look untidy.
 */
export interface RestaurantSettings {
  /** The IANA zone the restaurant operates in, such as "Asia/Kathmandu". */
  timeZoneId: string;
  /** A readable name for that zone, supplied by the server. */
  timeZoneDisplayName: string;
  /** What the zone is worth against UTC right now, daylight saving included. */
  currentUtcOffsetMinutes: number;
  /** The local hour a service day begins, 0 to 23. */
  dayStartHour: number;
  /**
   * When the running service day began, as the dashboard computes it. The one value
   * that proves the configuration is doing what was intended.
   */
  serviceDayStartedAtUtc: string;
}

/** Payload for changing how a restaurant operates. Both values are required. */
export interface UpdateRestaurantSettingsPayload {
  timeZoneId: string;
  dayStartHour: number;
}

/** One timezone the server will accept, offered so the list cannot disagree with it. */
export interface TimeZoneOption {
  id: string;
  displayName: string;
  currentUtcOffsetMinutes: number;
}

/** Bounds the API applies to the service day boundary. */
export const DAY_START_HOURS = { min: 0, max: 23 } as const;

/**
 * Payload for suspending or restoring a restaurant.
 *
 * Suspending stops new orders, staff-placed and guest alike. Sign-in and work already
 * running are untouched, so a night can be closed out and read back.
 */
export interface SetRestaurantActivePayload {
  isActive: boolean;
}
