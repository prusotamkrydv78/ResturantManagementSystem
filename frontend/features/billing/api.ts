import { apiFetch } from "@/lib/api/client";
import type { OrderStatus } from "@/types/order";
import type { Receipt } from "@/types/receipt";
import type {
  BillingOrder,
  BillingOrderSummary,
  CancelOrderPayload,
  OrderHistoryEntry,
  RecordPaymentPayload,
  RecordPaymentResult,
} from "@/types/billing";

/**
 * Billing and order closure for a restaurant manager.
 *
 * None of these sends a restaurant id: ownership comes from the restaurant the
 * authenticated manager runs. There is no payment collection to read, create or
 * edit — a payment exists only as the result of settling an order.
 */

/**
 * The billing queue: open orders, oldest first. Pass true to also get the most
 * recently closed ones, so a manager can confirm what was just settled.
 */
export function listBillingOrders(
  includeCompleted = false,
): Promise<BillingOrderSummary[]> {
  const query = includeCompleted ? "?includeCompleted=true" : "";

  return apiFetch<BillingOrderSummary[]>(`/api/billing/orders${query}`);
}

/** One order with everything needed to settle it. */
export function getBillingOrder(id: string): Promise<BillingOrder> {
  return apiFetch<BillingOrder>(`/api/billing/orders/${id}`);
}

/**
 * Record the payment, close the order and release the table, in one call.
 *
 * The payload carries the method only. The amount comes from the stored order
 * total, so there is no figure here for the client to decide.
 */
export function recordPayment(
  id: string,
  payload: RecordPaymentPayload,
): Promise<RecordPaymentResult> {
  return apiFetch<RecordPaymentResult>(`/api/billing/orders/${id}/payment`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Call an order off without payment, and release the table, in one call.
 *
 * Nothing is deleted. The order keeps its number and its lines, and any kitchen
 * tickets keep their own status; what changes is the order state, plus who called
 * it off and why. A reason is required.
 */
export function cancelOrder(
  id: string,
  payload: CancelOrderPayload,
): Promise<BillingOrder> {
  return apiFetch<BillingOrder>(`/api/billing/orders/${id}/cancellation`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Orders that have ended, newest first, however they ended. Pass a status for one
 * outcome only. The server caps the limit whatever is asked for.
 */
export function listOrderHistory(
  status?: Exclude<OrderStatus, "Open">,
  limit = 50,
): Promise<OrderHistoryEntry[]> {
  const query = new URLSearchParams({ limit: String(limit) });

  if (status !== undefined) {
    query.set("status", status);
  }

  return apiFetch<OrderHistoryEntry[]>(`/api/billing/history?${query.toString()}`);
}

/**
 * The receipt for an order that was paid for.
 *
 * Nothing is created by asking: the document is assembled from records that already
 * exist, so the same request always produces the same receipt. Refused for an order
 * that is still open or was cancelled.
 */
export function getReceipt(id: string): Promise<Receipt> {
  return apiFetch<Receipt>(`/api/billing/orders/${id}/receipt`);
}
