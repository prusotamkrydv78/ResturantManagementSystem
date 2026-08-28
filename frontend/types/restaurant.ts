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
 * Payload for suspending or restoring a restaurant.
 *
 * Suspending stops new orders, staff-placed and guest alike. Sign-in and work already
 * running are untouched, so a night can be closed out and read back.
 */
export interface SetRestaurantActivePayload {
  isActive: boolean;
}
