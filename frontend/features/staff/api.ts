import { apiFetch } from "@/lib/api/client";
import type {
  CreateStaffPayload,
  StaffMember,
  UpdateStaffPayload,
} from "@/types/staff";

/**
 * Staff calls for a restaurant manager.
 *
 * None of these send a restaurant id. The API derives the restaurant from the
 * access token, so a manager can only ever act on their own roster.
 */

/** List the staff of the signed-in manager restaurant. */
export function listStaff(search?: string): Promise<StaffMember[]> {
  const query =
    search !== undefined && search.trim() !== ""
      ? `?search=${encodeURIComponent(search.trim())}`
      : "";

  return apiFetch<StaffMember[]>(`/api/staff${query}`);
}

/** Load one staff member. */
export function getStaffMember(id: string): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${id}`);
}

/** Create a staff account in the manager restaurant. */
export function createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
  return apiFetch<StaffMember>("/api/staff", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update a staff member name, email and role. */
export function updateStaff(
  id: string,
  payload: UpdateStaffPayload,
): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Activate or deactivate a staff account. Deactivating keeps the record and ends
 * their sessions; it never deletes anything.
 */
export function setStaffActive(id: string, isActive: boolean): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
}

/**
 * Replace a staff member password.
 *
 * The only way back in for somebody who has forgotten theirs: the product has no
 * forgot-password flow and these accounts are issued rather than registered.
 */
export function resetStaffPassword(
  id: string,
  password: string,
): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

/**
 * Put a photograph on a staff account, replacing any it already had.
 *
 * FormData rather than JSON: the bytes would be a third larger base64-encoded, and
 * the API client leaves the content type alone for FormData so the browser can set
 * the multipart boundary itself.
 */
export function setStaffImage(id: string, file: File): Promise<StaffMember> {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<StaffMember>(`/api/staff/${id}/image`, { method: "POST", body });
}

/** Take the photograph off a staff account. */
export function removeStaffImage(id: string): Promise<StaffMember> {
  return apiFetch<StaffMember>(`/api/staff/${id}/image`, { method: "DELETE" });
}

/**
 * Delete a staff account added by mistake.
 *
 * Rejected with 409 once the account has taken an order, recorded a payment or moved
 * stock. Deactivate somebody who actually worked and then left.
 */
export function deleteStaff(id: string): Promise<void> {
  return apiFetch<void>(`/api/staff/${id}`, { method: "DELETE" });
}
