import type { KitchenTicketStatus } from "@/types/order";

/**
 * One line as the kitchen reads it.
 *
 * No price and no menu identifier: money is not the kitchen job, and these are the
 * snapshots taken when the waiter submitted, so a later menu change cannot rewrite
 * what the kitchen was asked to make.
 */
export interface KitchenItem {
  itemName: string;
  quantity: number;
  /** The guest instruction. This is the part a chef must not miss. */
  note: string | null;
}

/** A ticket on the kitchen rail. */
export interface KitchenTicket {
  id: string;
  /** The number the kitchen calls out. */
  ticketNumber: number;
  status: KitchenTicketStatus;
  /** The order it came from, so the food can be matched to a table. */
  orderNumber: number;
  tableName: string;
  /** Total units on the ticket. */
  itemCount: number;
  createdAtUtc: string;
  /** When cooking began. Null while the ticket is still waiting. */
  startedAtUtc: string | null;
  /** When it reached the pass. Null until then. */
  readyAtUtc: string | null;
  items: KitchenItem[];
}
