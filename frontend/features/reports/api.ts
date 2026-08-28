import { apiFetch } from "@/lib/api/client";
import type { ReportSummary } from "@/types/report";

/**
 * What the restaurant did over a range of days.
 *
 * The dates are the restaurant own days, so they are sent as plain dates and read in
 * its timezone by the server rather than being converted here. Sends no restaurant id.
 */
export function getReportSummary(
  from?: string,
  to?: string,
): Promise<ReportSummary> {
  const query = new URLSearchParams();

  if (from !== undefined && from !== "") {
    query.set("from", from);
  }

  if (to !== undefined && to !== "") {
    query.set("to", to);
  }

  const suffix = query.size === 0 ? "" : `?${query.toString()}`;

  return apiFetch<ReportSummary>(`/api/reports/summary${suffix}`);
}
