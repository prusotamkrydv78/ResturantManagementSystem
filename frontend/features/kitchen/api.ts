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
