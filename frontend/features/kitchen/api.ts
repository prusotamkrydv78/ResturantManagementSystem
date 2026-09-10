import { apiFetch } from "@/lib/api/client";
import type { KitchenTicket } from "@/types/kitchen";
import type { KitchenTicketStatus } from "@/types/order";

/**
 * The chef kitchen workflow.
 *
 * None of these sends a restaurant id: the server derives the restaurant from the
 * authenticated chef. The two status calls send no body either, because there is
 * nothing for the client to decide — the ticket knows what may follow what.
 */

/**
 * The kitchen queue. Without a status this is live work only: tickets being cooked
 * first, then tickets waiting, oldest first within each group.
 */
export function listKitchenTickets(
  status?: KitchenTicketStatus,
): Promise<KitchenTicket[]> {
  const query = status === undefined ? "" : `?status=${status}`;

  return apiFetch<KitchenTicket[]>(`/api/kitchen/tickets${query}`);
}

/** Start cooking a waiting ticket. Refused when another chef got there first. */
export function startKitchenTicket(id: string): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/api/kitchen/tickets/${id}/start`, {
    method: "PUT",
  });
}

/**
 * Send a ticket being cooked to the pass. A kitchen state only: the order stays
 * open and nothing is marked served.
 */
export function markKitchenTicketReady(id: string): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/api/kitchen/tickets/${id}/ready`, {
    method: "PUT",
  });
}

/**
 * Tick one dish off a ticket as cooked.
 *
 * The ticket reaches Ready by itself when the last dish is ticked, so there is no
 * second step to remember - and until then the rail can say "two of three".
 */
export function markKitchenItemReady(
  ticketId: string,
  itemId: string,
): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(
    `/api/kitchen/tickets/${ticketId}/items/${itemId}/ready`,
    { method: "PUT" },
  );
}

/** Put one cooked dish back on the stove. The undo for the tick above. */
export function recallKitchenItem(
  ticketId: string,
  itemId: string,
): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(
    `/api/kitchen/tickets/${ticketId}/items/${itemId}/recall`,
    { method: "PUT" },
  );
}

/**
 * Take a ticket back off the pass and put it back on the stove.
 *
 * The undo for the step above, which is one tap on a rail of identical cards and
 * sends a waiter walking to a pass that may have nothing on it. Refused once a waiter
 * has carried the food - at that point it is on a table, and whatever needs doing is
 * a new ticket.
 */
export function recallKitchenTicket(id: string): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/api/kitchen/tickets/${id}/recall`, {
    method: "PUT",
  });
}
