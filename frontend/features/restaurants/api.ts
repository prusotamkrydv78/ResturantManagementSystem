import { apiFetch } from "@/lib/api/client";
import type { Manager } from "@/types/manager";
import type {
  AssignManagerPayload,
  CreateRestaurantPayload,
  Restaurant,
  RestaurantSettings,
  RestaurantSummary,
  TimeZoneOption,
  UpdateMyRestaurantPayload,
  UpdateRestaurantSettingsPayload,
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
 * Super Admin: give this restaurant a manager, either an existing account or a
 * new one. Delegates to the manager module server side, so it returns the
 * manager rather than the restaurant.
 */
export function assignManager(
  restaurantId: string,
  payload: AssignManagerPayload,
): Promise<Manager> {
  return apiFetch<Manager>(`/api/restaurants/${restaurantId}/manager`, {
    method: "POST",
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
 * How the caller restaurant is configured to operate.
 *
 * Separate from the profile call: the two are edited on different screens and mean
 * different things.
 */
export function getMySettings(): Promise<RestaurantSettings> {
  return apiFetch<RestaurantSettings>("/api/restaurants/mine/settings");
}

/** Change how the restaurant operates. Sends no restaurant id. */
export function updateMySettings(
  payload: UpdateRestaurantSettingsPayload,
): Promise<RestaurantSettings> {
  return apiFetch<RestaurantSettings>("/api/restaurants/mine/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * The timezones the server will accept.
 *
 * Fetched rather than listed here so the options are exactly what validation allows,
 * on whatever machine the API happens to be running.
 */
export function listTimeZones(): Promise<TimeZoneOption[]> {
  return apiFetch<TimeZoneOption[]>("/api/restaurants/timezones");
}
