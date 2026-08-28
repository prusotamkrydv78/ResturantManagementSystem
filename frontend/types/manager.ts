/** The restaurant a manager runs, as returned inside a manager payload. */
export interface AssignedRestaurant {
  id: string;
  name: string;
  slug: string;
}

/** A restaurant manager, as seen by a Super Admin. */
export interface Manager {
  id: string;
  fullName: string;
  email: string;
  isAssigned: boolean;
  restaurant: AssignedRestaurant | null;
  /** False when the account is suspended: it cannot sign in or refresh. */
  isActive: boolean;
  createdAtUtc: string;
}

/** Which managers a list request should return. */
export type ManagerFilter = "All" | "Assigned" | "Unassigned";

/**
 * Payload for creating a manager. There is no role field: the server always sets
 * RestaurantManager, so a client cannot ask for a privileged account.
 */
export interface CreateManagerPayload {
  fullName: string;
  email: string;
  password: string;
  /** Optional restaurant to assign immediately. */
  restaurantId?: string;
}

/** Payload for editing a manager. */
export interface UpdateManagerPayload {
  fullName: string;
  email: string;
}

/**
 * Payload for replacing a manager password.
 *
 * The current password is not required. The caller is the platform owner, who issued
 * the account, and there is no self-service reset for the manager to use instead.
 */
export interface ResetManagerPasswordPayload {
  password: string;
}

/** Payload for suspending or restoring a manager account. */
export interface SetManagerActivePayload {
  isActive: boolean;
}
