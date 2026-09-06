import { apiFetch } from "@/lib/api/client";
import type { ReviewSummary } from "@/types/review";

/**
 * What tables thought of their visit.
 *
 * Manager only, and derived from the authenticated account rather than from anything
 * this call sends: no restaurant identifier crosses the wire.
 */
export function listReviews(limit = 50): Promise<ReviewSummary> {
  return apiFetch<ReviewSummary>(`/api/reviews?limit=${limit}`);
}
