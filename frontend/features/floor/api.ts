import { apiFetch } from "@/lib/api/client";
import type { FloorOverview } from "@/types/floor";

/**
 * The live floor.
 *
 * Two routes for the same shape, because a waiter and a manager reach the product
 * through different roles and each is authorised separately. Neither sends a
 * restaurant id, and neither can change anything: occupancy belongs to the order
 * lifecycle.
 */

/** The floor, for a waiter. */
export function getWaiterFloor(): Promise<FloorOverview> {
  return apiFetch<FloorOverview>("/api/waiter/floor");
}

/** The floor, for the manager of the restaurant. */
export function getManagerFloor(): Promise<FloorOverview> {
  return apiFetch<FloorOverview>("/api/manager/floor");
}
