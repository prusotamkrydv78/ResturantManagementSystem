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
