import { apiFetch } from "@/lib/api/client";
import type {
  CreateManagerPayload,
  Manager,
  ManagerFilter,
  UpdateManagerPayload,
} from "@/types/manager";

/**
 * Manager administration calls. Super Admin only; the API rejects anyone else, so
 * these are never reachable in a useful way from another role.
 */

/** List managers, optionally narrowed by search text and assignment state. */
export function listManagers(
  options: { search?: string; status?: ManagerFilter } = {},
): Promise<Manager[]> {
  const params = new URLSearchParams();

  if (options.search !== undefined && options.search.trim() !== "") {
    params.set("search", options.search.trim());
  }

  if (options.status !== undefined) {
    params.set("status", options.status);
  }

  const query = params.toString();

  return apiFetch<Manager[]>(`/api/managers${query === "" ? "" : `?${query}`}`);
}

/** Load one manager with their current assignment. */
export function getManager(id: string): Promise<Manager> {
  return apiFetch<Manager>(`/api/managers/${id}`);
}

/** Create a manager, optionally assigning a restaurant at the same time. */
export function createManager(payload: CreateManagerPayload): Promise<Manager> {
  return apiFetch<Manager>("/api/managers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update a manager name and email. */
export function updateManager(
  id: string,
  payload: UpdateManagerPayload,
): Promise<Manager> {
  return apiFetch<Manager>(`/api/managers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Assign or reassign a manager to a restaurant. Moving a manager off their current
 * restaurant is handled by the server in one call, so there is no window where they
 * belong to neither.
 */
export function assignManagerToRestaurant(
  managerId: string,
  restaurantId: string,
): Promise<Manager> {
  return apiFetch<Manager>(`/api/managers/${managerId}/assignment`, {
    method: "PUT",
    body: JSON.stringify({ restaurantId }),
  });
}

/** Remove the assignment. The account stays active. */
export function unassignManager(managerId: string): Promise<Manager> {
  return apiFetch<Manager>(`/api/managers/${managerId}/assignment`, {
    method: "DELETE",
  });
}
