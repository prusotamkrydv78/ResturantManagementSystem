import type { TableStatus } from "@/types/table";

/**
 * One open order sitting on a table.
 *
 * Enough to recognise it and act on it. The floor is a way into an order, not a
 * second place to read one.
 */
export interface FloorOrder {
  id: string;
  orderNumber: number;
  subtotal: number;
  itemCount: number;
  placedByName: string;
  createdAtUtc: string;
  /** Tickets on it that have not reached the pass. Zero is what closing needs. */
  unfinishedKitchenTicketCount: number;
  unsubmittedItemCount: number;
  /** Whether it may be paid for and closed now. Decided by the server. */
  canComplete: boolean;
}

/**
 * One table, and what is happening at it right now.
 *
 * Carries the stored occupancy and the open orders side by side. The order lifecycle
 * owns `status`; nothing on this screen writes to it.
 */
export interface FloorTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  /** Whether it is in service. Separate from occupancy. */
  isActive: boolean;
  openOrders: FloorOrder[];
  openValue: number;
  openItemCount: number;
  /** When the earliest open order was placed. Null when nothing is on it. */
  seatedSinceUtc: string | null;
  pendingTicketCount: number;
  preparingTicketCount: number;
  readyTicketCount: number;
  unsubmittedItemCount: number;
  /** Whether any open order on it can be closed now. */
  canSettle: boolean;
}

/**
 * The floor right now: every table, and what is on it.
 *
 * One response for the whole screen, so it cannot contradict itself about which
 * table is free.
 */
export interface FloorOverview {
  /** When the server answered, so the screen can say how fresh it is. */
  generatedAtUtc: string;
  totalCount: number;
  inServiceCount: number;
  occupiedCount: number;
  availableCount: number;
  outOfServiceCount: number;
  seatsInService: number;
  seatsOccupied: number;
  openValue: number;
  readyToSettleCount: number;
  /** Ordered by name, which is the order the room is in. */
  tables: FloorTable[];
}
