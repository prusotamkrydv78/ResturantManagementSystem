"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getManagerDashboard } from "@/features/dashboard/api";
import { getMyRestaurant } from "@/features/restaurants/api";
import { getManagerFloor } from "@/features/floor/api";
import { listPass } from "@/features/orders/api";
import { listBillingOrders } from "@/features/billing/api";
import { getReportSummary } from "@/features/reports/api";
import { getReservationBoard } from "@/features/reservations/api";
import { listReviews } from "@/features/reviews/api";
import { listCategories, listItems } from "@/features/menu/api";
import { listTables } from "@/features/tables/api";
import { listStaff } from "@/features/staff/api";
import { listInventory } from "@/features/inventory/api";
import { listCustomers } from "@/features/customers/api";
import { getSite } from "@/features/website/api";
import { managerKeys } from "./keys";
import { loadKitchen } from "./reads";

/**
 * Starts loading a screen before it is opened.
 *
 * The sidebar calls this when the pointer rests on a link or it is focused. By the
 * time the click lands the data is usually already in the cache, so the page opens
 * filled in rather than as a skeleton - the difference between an app and a site.
 * Nothing is fetched for a screen whose data is still fresh.
 */
const PREFETCH: Record<string, (client: ReturnType<typeof useQueryClient>) => Promise<void>> = {
  "/dashboard": (client) =>
    Promise.all([
      client.prefetchQuery({ queryKey: managerKeys.dashboard(), queryFn: getManagerDashboard }),
      client.prefetchQuery({ queryKey: managerKeys.profile(), queryFn: getMyRestaurant }),
    ]).then(() => undefined),
  "/floor": (client) => client.prefetchQuery({ queryKey: managerKeys.floor("manager"), queryFn: getManagerFloor }),
  "/kitchen": (client) => client.prefetchQuery({ queryKey: managerKeys.kitchen(), queryFn: loadKitchen }),
  "/pass": (client) => client.prefetchQuery({ queryKey: managerKeys.pass(), queryFn: listPass }),
  "/billing": (client) =>
    client.prefetchQuery({ queryKey: managerKeys.billingList(), queryFn: () => listBillingOrders(true) }),
  "/reservations": (client) =>
    client.prefetchQuery({
      queryKey: managerKeys.reservations({ onDate: "", includeClosed: false }),
      queryFn: () => getReservationBoard({ includeClosed: false }),
    }),
  "/menu": (client) =>
    Promise.all([
      client.prefetchQuery({ queryKey: managerKeys.categories(), queryFn: listCategories }),
      client.prefetchQuery({ queryKey: managerKeys.items({ search: "", categoryId: "" }), queryFn: () => listItems() }),
    ]).then(() => undefined),
  "/reviews": (client) => client.prefetchQuery({ queryKey: managerKeys.reviews(), queryFn: () => listReviews(100) }),
  "/reports": (client) =>
    client.prefetchQuery({ queryKey: managerKeys.report({ from: "", to: "" }), queryFn: () => getReportSummary() }),
  "/settings": (client) =>
    Promise.all([
      client.prefetchQuery({ queryKey: managerKeys.profile(), queryFn: getMyRestaurant }),
      client.prefetchQuery({ queryKey: managerKeys.tables(), queryFn: listTables }),
      client.prefetchQuery({ queryKey: managerKeys.staff(""), queryFn: () => listStaff("") }),
      client.prefetchQuery({ queryKey: managerKeys.inventory(false), queryFn: () => listInventory(false) }),
      client.prefetchQuery({
        queryKey: managerKeys.customers({ search: "", includeInactive: false }),
        queryFn: () => listCustomers({ search: "", includeInactive: false }),
      }),
    ]).then(() => undefined),
  "/settings/restaurant": (client) => client.prefetchQuery({ queryKey: managerKeys.profile(), queryFn: getMyRestaurant }),
  "/settings/website": (client) => client.prefetchQuery({ queryKey: managerKeys.site(), queryFn: getSite }),
  "/settings/tables": (client) => client.prefetchQuery({ queryKey: managerKeys.tables(), queryFn: listTables }),
  "/settings/staff": (client) => client.prefetchQuery({ queryKey: managerKeys.staff(""), queryFn: () => listStaff("") }),
  "/settings/inventory": (client) =>
    client.prefetchQuery({ queryKey: managerKeys.inventory(false), queryFn: () => listInventory(false) }),
  "/settings/customers": (client) =>
    client.prefetchQuery({
      queryKey: managerKeys.customers({ search: "", includeInactive: false }),
      queryFn: () => listCustomers({ search: "", includeInactive: false }),
    }),
};

/** A function that warms the cache for a link's destination, if it knows it. */
export function usePrefetchManagerRoute() {
  const client = useQueryClient();

  return useCallback(
    (href: string | undefined) => {
      const load = href === undefined ? undefined : PREFETCH[href];

      if (load !== undefined) {
        // A failed prefetch is not an error: the page asks again when it opens.
        void load(client).catch(() => undefined);
      }
    },
    [client],
  );
}
