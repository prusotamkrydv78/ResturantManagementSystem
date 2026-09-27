/**
 * Every read the restaurant console makes, what a change makes stale, and how the
 * cache is warmed before a screen opens.
 *
 * Screens import from "@/queries/manager" and nowhere deeper, so the files behind this
 * can be split or merged without touching a page. Same shape as "@/queries/admin".
 */
export { LIVE_INTERVAL, managerKeys } from "./keys";
export {
  useBill,
  useBillingOrders,
  useCustomers,
  useFloor,
  useInventory,
  useKitchenTickets,
  loadKitchen,
  useManagerDashboard,
  useMenuCategories,
  useMenuItem,
  useMenuItems,
  useMyRestaurant,
  useOrderHistory,
  usePass,
  useReport,
  useReservationBoard,
  useReviews,
  useSite,
  useStaff,
  useTables,
} from "./reads";
export { useManagerLiveUpdates } from "./live";
export { usePrefetchManagerRoute } from "./prefetch";
export { useInvalidateRestaurant } from "./invalidate";
