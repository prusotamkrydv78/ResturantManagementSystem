import { apiFetch } from "@/lib/api/client";
import type { PlatformOverview, PlatformReport } from "@/types/platform";

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

/** The shape of the estate: how many restaurants, who runs them, how big they are. */
export function getPlatformOverview(): Promise<PlatformOverview> {
  return apiFetch<PlatformOverview>("/api/platform/overview");
}

