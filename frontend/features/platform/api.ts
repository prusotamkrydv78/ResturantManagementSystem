import { apiFetch } from "@/lib/api/client";
import type {
  PlatformActivity,
  PlatformPulse,
  PlatformReport,
  PlatformRestaurantDetail,
  PlatformSettings,
  PlatformSystem,
} from "@/types/platform";

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

/** What the estate is doing right now: today against yesterday, and what is running. */
export function getPlatformPulse(): Promise<PlatformPulse> {
  return apiFetch<PlatformPulse>("/api/platform/pulse");
}

/**
 * One restaurant, whole: settings, people, trading and floor.
 *
 * The only read of a single restaurant a platform administrator has. Every other
 * module scopes itself to the caller own restaurant, which this account does not have.
 */
export function getPlatformRestaurant(id: string): Promise<PlatformRestaurantDetail> {
  return apiFetch<PlatformRestaurantDetail>(`/api/platform/restaurants/${id}`);
}

/** The most recent things platform administrators have done, newest first. */
export function listPlatformActivity(limit = 50): Promise<PlatformActivity[]> {
  return apiFetch<PlatformActivity[]>(`/api/platform/activity?limit=${limit}`);
}

/** The platform-wide defaults a new restaurant inherits. */
export function getPlatformSettings(): Promise<PlatformSettings> {
  return apiFetch<PlatformSettings>("/api/platform/settings");
}

/** Changes the platform-wide defaults. */
export function updatePlatformSettings(payload: {
  defaultVatRate: number;
  defaultServiceChargeRate: number;
}): Promise<PlatformSettings> {
  return apiFetch<PlatformSettings>("/api/platform/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Whether the deployment itself is healthy. */
export function getPlatformSystem(): Promise<PlatformSystem> {
  return apiFetch<PlatformSystem>("/api/platform/system");
}
