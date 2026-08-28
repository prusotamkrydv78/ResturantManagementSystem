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
