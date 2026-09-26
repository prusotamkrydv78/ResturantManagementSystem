/**
 * Every read the platform console makes, and what a change makes stale.
 *
 * Screens import from "@/queries/admin" and nowhere deeper, so the files behind this
 * can be split or merged without touching a page.
 */
export { adminKeys, LIVE_INTERVAL } from "./keys";
export { useRestaurant, useRestaurants, useRestaurantStaff } from "./restaurants";
export { useManager, useManagers } from "./managers";
export {
  usePlatformActivity,
  usePlatformPulse,
  usePlatformReport,
  usePlatformRestaurant,
  usePlatformSettings,
  usePlatformSystem,
} from "./platform";
export { useInvalidateEstate, useInvalidatePlatformSettings } from "./invalidate";
export { useAdminLiveUpdates } from "./live";
