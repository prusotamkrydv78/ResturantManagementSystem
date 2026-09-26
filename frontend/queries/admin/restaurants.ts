"use client";

import { useQuery } from "@tanstack/react-query";
import { getRestaurant, listRestaurants, listRestaurantStaff } from "@/features/restaurants/api";
import { adminKeys, LIVE_INTERVAL } from "./keys";

/** Every restaurant on the platform. Live while the overview is open. */
export function useRestaurants(options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: adminKeys.restaurantList(),
    queryFn: listRestaurants,
    refetchInterval: options.live === true ? LIVE_INTERVAL : false,
  });
}

/** One restaurant's editable record. */
export function useRestaurant(id: string) {
  return useQuery({
    queryKey: adminKeys.restaurant(id),
    queryFn: () => getRestaurant(id),
  });
}

/** The staff accounts of one restaurant, fetched only once asked for. */
export function useRestaurantStaff(id: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.restaurantStaff(id),
    queryFn: () => listRestaurantStaff(id),
    enabled,
  });
}
