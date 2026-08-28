import { apiFetch } from "@/lib/api/client";
import type { StaffMember } from "@/types/staff";
import type {
  CreateRestaurantPayload,
  Restaurant,
  RestaurantSummary,
  SetRestaurantActivePayload,
  UpdateMyRestaurantPayload,
  UpdateRestaurantPayload,
} from "@/types/restaurant";

/**
 * Restaurant API calls, in one place. All go through the shared client, so the
 * access token and the refresh-on-401 behaviour apply automatically.
 */

/** Super Admin: create a restaurant. */
export function createRestaurant(
  payload: CreateRestaurantPayload,
): Promise<Restaurant> {
  return apiFetch<Restaurant>("/api/restaurants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Super Admin: list every restaurant. */
export function listRestaurants(): Promise<RestaurantSummary[]> {
  return apiFetch<RestaurantSummary[]>("/api/restaurants");
}

/** Super Admin: load one restaurant with its manager. */
export function getRestaurant(id: string): Promise<Restaurant> {
  return apiFetch<Restaurant>(`/api/restaurants/${id}`);
}

/**
 * Super Admin: edit any restaurant. The only call that can change a slug.
 */
export function updateRestaurant(
  id: string,
  payload: UpdateRestaurantPayload,
): Promise<Restaurant> {
  return apiFetch<Restaurant>(`/api/restaurants/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Super Admin: suspend or restore a restaurant.
 *
 * There is no delete. Suspending stops new orders, staff-placed and guest alike,
 * and leaves sign-in and work already running untouched, so the takings every
 * report is built from survive and a night in progress can still be closed out.
 */
export function setRestaurantActive(
  id: string,
  payload: SetRestaurantActivePayload,
): Promise<Restaurant> {
  return apiFetch<Restaurant>(`/api/restaurants/${id}/status`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Restaurant Manager: load their own restaurant. Takes no id — the backend
 * resolves it from the access token.
 */
export function getMyRestaurant(): Promise<Restaurant> {
  return apiFetch<Restaurant>("/api/restaurants/mine");
}

/**
 * Restaurant Manager: update their own restaurant. Sends no id — the backend
 * resolves the record from the access token, so there is nothing here that could
 * point at someone else restaurant.
 */
export function updateMyRestaurant(
  payload: UpdateMyRestaurantPayload,
): Promise<Restaurant> {
  return apiFetch<Restaurant>("/api/restaurants/mine", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Super Admin: the staff of one restaurant.
 *
 * Read-only. Hiring, editing and suspending stay with the manager, so there is no
 * matching write call here.
 */
export function listRestaurantStaff(
  id: string,
  search?: string,
): Promise<StaffMember[]> {
  const query =
    search === undefined || search.trim() === ""
      ? ""
      : `?search=${encodeURIComponent(search.trim())}`;

  return apiFetch<StaffMember[]>(`/api/restaurants/${id}/staff${query}`);
}
