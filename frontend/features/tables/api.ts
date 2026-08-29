import { apiFetch } from "@/lib/api/client";
import type {
  CreateTablePayload,
  RestaurantTable,
  UpdateTablePayload,
} from "@/types/table";

/**
 * Table calls for a restaurant manager.
 *
 * None of these send a restaurant id. The API derives the restaurant from the
 * access token, so a manager can only ever reach their own tables.
 */

/** List the tables of the signed-in manager restaurant. */
export function listTables(): Promise<RestaurantTable[]> {
  return apiFetch<RestaurantTable[]>("/api/tables");
}

/** Load one table. */
export function getTable(id: string): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>(`/api/tables/${id}`);
}

/** Add a table to the manager restaurant. */
export function createTable(payload: CreateTablePayload): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>("/api/tables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update a table name and capacity. */
export function updateTable(
  id: string,
  payload: UpdateTablePayload,
): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>(`/api/tables/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Put a table in or out of service. An inactive table keeps its record; nothing
 * is deleted.
 */
export function setTableActive(
  id: string,
  isActive: boolean,
): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>(`/api/tables/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Switch guest ordering on or off for one table.
 *
 * Separate from in-service status: a restaurant can have a code on the terrace and
 * none in the private room without withdrawing the private room. The token is left
 * alone, so switching off for the evening does not mean reprinting anything.
 */
export function setTableOrdering(
  id: string,
  isOrderingEnabled: boolean,
): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>(`/api/tables/${id}/ordering`, {
    method: "PUT",
    body: JSON.stringify({ isOrderingEnabled }),
  });
}

/**
 * Issue a new ordering token for a table.
 *
 * Invalidates every code already printed for it, which is the answer to one having
 * been photographed or posted somewhere.
 */
export function regenerateOrderingToken(id: string): Promise<RestaurantTable> {
  return apiFetch<RestaurantTable>(`/api/tables/${id}/ordering/token`, {
    method: "POST",
  });
}

/**
 * Delete a table added by mistake.
 *
 * Rejected with 409 once an order or a booking has been made against it. Take it out
 * of service instead for a table that genuinely existed.
 */
export function deleteTable(id: string): Promise<void> {
  return apiFetch<void>(`/api/tables/${id}`, { method: "DELETE" });
}
