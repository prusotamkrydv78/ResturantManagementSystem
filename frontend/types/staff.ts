/**
 * What a staff member does on the floor.
 *
 * Separate from the platform role: this decides what they will be allowed to do
 * once ordering and kitchen features exist, not what part of the product they can
 * reach today.
 */
export type StaffRole = "Waiter" | "Chef" | "Cashier";

/** Every role, in the order they are offered in the UI. */
export const STAFF_ROLES: readonly StaffRole[] = ["Waiter", "Chef", "Cashier"];

/** A staff member, as seen by their restaurant manager. */
export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  restaurantName: string;
  createdAtUtc: string;
}

/**
 * Payload for creating a staff account. There is no restaurant field: the backend
 * assigns them to the restaurant of the signed-in manager.
 */
export interface CreateStaffPayload {
  fullName: string;
  email: string;
  password: string;
  role: StaffRole;
}

/** Payload for editing a staff member. Active status has its own call. */
export interface UpdateStaffPayload {
  fullName: string;
  email: string;
  role: StaffRole;
}
