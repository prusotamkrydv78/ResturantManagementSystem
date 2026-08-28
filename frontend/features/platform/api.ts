import { apiFetch } from "@/lib/api/client";
import type { PlatformOverview, PlatformReport, PlatformRestaurantSettings } from "@/types/platform";
import type { TimeZoneOption } from "@/types/restaurant";

/**
 * Platform administration calls.
 *
 * Unlike every other module, these are not scoped to one restaurant: the account behind
 * them owns none. The API gates the whole surface on the Super Admin role, so a manager
 * or a member of staff reaching these paths is refused rather than served a narrowed
 * version.
 */

/**
 * What every restaurant took over a range of days.
 *
 * Dates are plain yyyy-mm-dd. Each restaurant reads them in its own calendar, so the
 * total matches the sum of what each manager sees.
 */
export function getPlatformReport(options?: {
  from?: string;
  to?: string;
}): Promise<PlatformReport> {
  const query = new URLSearchParams();

  if (options?.from !== undefined && options.from !== "") {
    query.set("from", options.from);
  }

  if (options?.to !== undefined && options.to !== "") {
    query.set("to", options.to);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiFetch<PlatformReport>(`/api/platform/reports${suffix}`);
}

/** The shape of the estate, and how each restaurant is configured to operate. */
export function getPlatformOverview(): Promise<PlatformOverview> {
  return apiFetch<PlatformOverview>("/api/platform/overview");
}

/** Changes one restaurant timezone and the hour its service day begins. */
export function updateRestaurantSettings(
  restaurantId: string,
  payload: { timeZoneId: string; dayStartHour: number },
): Promise<PlatformRestaurantSettings> {
  return apiFetch<PlatformRestaurantSettings>(
    `/api/platform/restaurants/${restaurantId}/settings`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

/**
 * The timezones the server will accept.
 *
 * Served rather than listed here, so the options and the validation come from one zone
 * database and cannot disagree.
 *
 * Shares the restaurant route deliberately. There was a second, identical endpoint
 * under /api/platform for no reason other than which screen asked; the route is now
 * authorised for a Super Admin as well as a manager, so there is one list.
 */
export function listTimeZones(): Promise<TimeZoneOption[]> {
  return apiFetch<TimeZoneOption[]>("/api/restaurants/timezones");
}
