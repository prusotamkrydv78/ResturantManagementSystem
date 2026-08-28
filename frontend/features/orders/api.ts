import { apiFetch } from "@/lib/api/client";
import type {
  CreateOrderPayload,
  Order,
  OrderSummary,
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
