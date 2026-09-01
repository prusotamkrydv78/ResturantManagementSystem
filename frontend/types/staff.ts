/**
 * What a staff member does on the floor.
 *
 * Separate from the platform role: this decides what they will be allowed to do
 * once ordering and kitchen features exist, not what part of the product they can
 * reach today.
 */
export type StaffRole = "Waiter" | "Chef";

/** Every role, in the order they are offered in the UI. */
export const STAFF_ROLES: readonly StaffRole[] = ["Waiter", "Chef"];

/**
 * A staff member.
 *
 * Returned identically to the restaurant manager who administers the roster and to
 * a Super Admin reading it, so the two cannot show different answers.
 */
export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  restaurantName: string;
  createdAtUtc: string;
  /**
   * Their photograph, or null.
   *
   * For recognition rather than for show: a manager matching a name on the roster to
   * a face on a shift. Carries a version stamp so the browser can cache it hard and
   * still see a replacement at once.
   */
  imageUrl: string | null;
}

/** What a staff photograph upload has to stay inside. Mirrors the API. */
export const STAFF_IMAGE = {
  maxBytes: 2 * 1024 * 1024,
  accept: "image/jpeg,image/png,image/webp,image/avif",
} as const;

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
