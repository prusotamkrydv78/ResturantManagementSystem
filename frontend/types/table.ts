/**
 * Live occupancy of a table.
 *
 * Driven by the ordering system and never set by hand: a table becomes occupied when
 * an order opens on it and is released when the bill is settled. Nothing in the UI
 * offers to change it, and a reservation does not change it either.
 */
export type TableStatus = "Available" | "Occupied" | "Reserved";

/** Smallest and largest seat count the API accepts. */
export const TABLE_CAPACITY = { min: 1, max: 100 } as const;

/** A table, as seen by its restaurant manager. */
export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  isActive: boolean;
  /** Whether guests may order by scanning this table. Off until a manager turns it on. */
  isOrderingEnabled: boolean;
  /**
   * The opaque token in this table ordering link.
   *
   * Returned only to the manager of the restaurant that owns the table, and only so a
   * code can be printed. It is a credential: anybody holding it can order onto this
   * table, which is why regenerating it exists.
   */
  publicOrderingToken: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/**
 * The path a table ordering code points at.
 *
 * Deliberately short and outside the application routes, because it is printed on a
 * card and sometimes typed by hand off one.
 */
export function orderingPath(token: string): string {
  return `/t/${token}`;
}

/**
 * The full link to put on a code.
 *
 * Built from wherever this page is being served rather than from configuration: the
 * code has to work on the same host the manager is looking at, and a hardcoded host
 * would print cards that only work in one environment. Returns just the path when
 * called during server rendering, where there is no location to read.
 */
export function orderingLink(token: string): string {
  const path = orderingPath(token);

  return typeof window === "undefined"
    ? path
    : `${window.location.origin}${path}`;
}

/**
 * Payload for adding a table. There is no restaurant field: the backend places it
 * in the restaurant of the signed-in manager.
 */
export interface CreateTablePayload {
  name: string;
  capacity: number;
}

/** Payload for editing a table. In-service status has its own call. */
export interface UpdateTablePayload {
  name: string;
  capacity: number;
}
