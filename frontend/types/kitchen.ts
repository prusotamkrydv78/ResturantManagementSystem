import type { KitchenTicketStatus } from "@/types/order";

/**
 * One line as the kitchen reads it.
 *
 * No price and no menu identifier: money is not the kitchen job, and these are the
 * snapshots taken when the waiter submitted, so a later menu change cannot rewrite
 * what the kitchen was asked to make.
 */
export interface KitchenItem {
  /** Identifier, so a chef can tick off this dish rather than the whole slip. */
  id: string;
  itemName: string;
  quantity: number;
  /** The guest instruction. This is the part a chef must not miss. */
  note: string | null;
  /**
   * The menu course this dish came from, as named when it was sent.
   *
   * What lets one rail serve a kitchen with more than one person in it: whoever is on
   * the tandoor filters to Breads and Rice and stops scrolling past cold starters.
   */
  course: string | null;
  /**
   * When this dish was cooked, or null while it is still being made.
   *
   * Per dish, because that is where cooking finishes. Momo and samosa on one slip are
   * done fifteen minutes apart, and a ticket that could only be all-cooked or
   * not-cooked left a chef choosing between a cold samosa and a raw momo.
   */
  readyAtUtc: string | null;
  /** When a waiter carried it to the table, or null while it waits at the pass. */
  servedAtUtc: string | null;
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
  /** How many of the lines are cooked, which is what "two of three" is drawn from. */
  readyItemCount: number;
  items: KitchenItem[];
}
