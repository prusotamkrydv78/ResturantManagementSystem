import { apiFetch } from "@/lib/api/client";
import type {
  CreateOrderPayload,
  Order,
  OrderSummary,
  PassTicket,
  SubmitToKitchenResult,
  UpdateOrderPayload,
  WaiterContext,
  WaiterMenuCategory,
  WaiterTable,
} from "@/types/order";

/**
 * The waiter ordering workflow.
 *
 * These are purpose-built ordering endpoints, not the manager administration APIs:
 * they only ever return tables in service and items that are actually orderable.
 * None of them sends a restaurant id.
 */

/** Restaurant name and counts for the waiter workspace. */
export function getWaiterContext(): Promise<WaiterContext> {
  return apiFetch<WaiterContext>("/api/waiter/context");
}

/** Tables in service. */
export function listWaiterTables(): Promise<WaiterTable[]> {
  return apiFetch<WaiterTable[]>("/api/waiter/tables");
}

/** The orderable menu, grouped by category. */
export function listWaiterMenu(): Promise<WaiterMenuCategory[]> {
  return apiFetch<WaiterMenuCategory[]>("/api/waiter/menu");
}

/**
 * Place an order. The payload carries item ids, quantities and notes only — the
 * server supplies names, prices and the total.
 */
export function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return apiFetch<Order>("/api/waiter/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Load one placed order. */
export function getOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/api/waiter/orders/${id}`);
}

/**
 * Open orders for this restaurant, newest first. Restaurant-wide so whoever is on
 * the floor can pick up a table; each row still shows who placed it.
 */
export function listOpenOrders(limit = 50): Promise<OrderSummary[]> {
  return apiFetch<OrderSummary[]>(`/api/waiter/orders?limit=${limit}`);
}

/**
 * Apply the submitted state to an open order. The payload carries no prices: the
 * server keeps the snapshots on existing lines and prices new items itself.
 */
export function updateOrder(
  id: string,
  payload: UpdateOrderPayload,
): Promise<Order> {
  return apiFetch<Order>(`/api/waiter/orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Food cooked and waiting for somebody to carry it to a table.
 *
 * Restaurant-wide, like the open orders list: whoever is on the floor takes what is at
 * the pass. This is also what makes the "food is ready" alert survive a locked phone -
 * the notification is a courtesy, this is the record.
 */
export function listPass(): Promise<PassTicket[]> {
  return apiFetch<PassTicket[]>("/api/waiter/pass");
}

/**
 * Record that this waiter took a cooked ticket to the table.
 *
 * A ticket somebody else already carried answers as success rather than as an error:
 * two waiters reaching the same pass is an ordinary service, and the second one wanted
 * the plate delivered - which it is.
 */
export function markTicketServed(ticketId: string): Promise<PassTicket> {
  return apiFetch<PassTicket>(`/api/waiter/pass/${ticketId}/served`, {
    method: "POST",
  });
}

/**
 * Confirm a customer's order after checking it with the table.
 *
 * Takes no body: there is nothing to say beyond who confirmed it, and the server
 * reads that from the token. Adjusting the order first is an ordinary update, so a
 * waiter standing at the table fixes the quantities and then confirms.
 *
 * Until this is done the kitchen refuses the order, which is the point of it.
 */
export function confirmOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/api/waiter/orders/${id}/confirmation`, {
    method: "POST",
  });
}

/**
 * Send every line not yet on a ticket to the kitchen as one submission.
 *
 * Takes no body: the server decides what is still waiting. Refused when there is
 * nothing pending, or when someone else submitted the same order first.
 */
export function submitToKitchen(id: string): Promise<SubmitToKitchenResult> {
  return apiFetch<SubmitToKitchenResult>(
    `/api/waiter/orders/${id}/kitchen-tickets`,
    { method: "POST" },
  );
}
