import { apiFetch } from "@/lib/api/client";
import type { ManagerDashboard } from "@/types/dashboard";

/**
 * The manager operational overview.
 *
 * One call for the whole screen, and no parameters at all. Where the operational day
 * begins used to be sent from here as the browser offset, which meant the same
 * restaurant showed different takings to two managers in different places. It is now
 * the restaurant own setting, so the figures belong to the restaurant rather than to
 * whoever is looking at them.
 */
export function getManagerDashboard(): Promise<ManagerDashboard> {
  return apiFetch<ManagerDashboard>("/api/manager/dashboard");
}
