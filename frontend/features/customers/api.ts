import { apiFetch } from "@/lib/api/client";
import type {
  CreateCustomerPayload,
  Customer,
  CustomerDetail,
  UpdateCustomerPayload,
} from "@/types/customer";

/**
 * Customer calls for a restaurant manager.
 *
 * None of these send a restaurant id. The API derives the restaurant from the access
 * token, so a manager can only ever reach their own customers, and an id from another
 * restaurant comes back as not found.
 */

/** List the customers on the books, optionally searched by name or phone. */
export function listCustomers(options?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<Customer[]> {
  const query = new URLSearchParams();

  if (options?.search !== undefined && options.search.trim() !== "") {
    query.set("search", options.search.trim());
  }

  if (options?.includeInactive === true) {
    query.set("includeInactive", "true");
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiFetch<Customer[]>(`/api/customers${suffix}`);
}

/** Load one customer with what they have done. */
export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${id}`);
}

/** Record a customer in the manager restaurant. */
export function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  return apiFetch<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Change a customer details. */
export function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Take a customer off the books, or put them back. Nothing is deleted, because their
 * history has to survive them leaving.
 */
export function setCustomerActive(
  id: string,
  isActive: boolean,
): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Delete a customer outright.
 *
 * Only succeeds while they have no orders and no bookings, which in practice means the
 * row was a mistake. Anything else is refused and should be deactivated instead.
 */
export function deleteCustomer(id: string): Promise<void> {
  return apiFetch<void>(`/api/customers/${id}`, { method: "DELETE" });
}
