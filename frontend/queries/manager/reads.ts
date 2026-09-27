"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getManagerDashboard } from "@/features/dashboard/api";
import { getMyRestaurant } from "@/features/restaurants/api";
import { getManagerFloor, getWaiterFloor } from "@/features/floor/api";
import { listKitchenTickets } from "@/features/kitchen/api";
import { listPass } from "@/features/orders/api";
import { getBillingOrder, listBillingOrders, listOrderHistory } from "@/features/billing/api";
import { getReportSummary } from "@/features/reports/api";
import { getReservationBoard } from "@/features/reservations/api";
import { listReviews } from "@/features/reviews/api";
import { getItem, listCategories, listItems } from "@/features/menu/api";
import { listTables } from "@/features/tables/api";
import { listStaff } from "@/features/staff/api";
import { listInventory } from "@/features/inventory/api";
import { listCustomers } from "@/features/customers/api";
import { getSite } from "@/features/website/api";
import type { OrderStatus } from "@/types/order";
import { LIVE_INTERVAL, managerKeys } from "./keys";

/**
 * Every read the restaurant console makes.
 *
 * A screen asks for what it shows and gets it from the shared cache: a page seen a
 * moment ago opens at once with what is already known and refreshes behind itself,
 * rather than dropping to a skeleton and asking again from nothing. That is most of
 * what makes moving around the console feel like an app rather than a website.
 *
 * Live screens (the overview, the floor, the kitchen, the pass, billing) are kept
 * current by the server's signals (live.ts) and carry only a slow poll as a net.
 * Lists behind a search or a filter keep showing the previous result while the new
 * one loads, so typing in a search box never blanks the page.
 */

/* ---------------------------------------------------------------- today --- */

export function useManagerDashboard() {
  return useQuery({
    queryKey: managerKeys.dashboard(),
    queryFn: getManagerDashboard,
    refetchInterval: LIVE_INTERVAL,
  });
}

export function useMyRestaurant() {
  return useQuery({ queryKey: managerKeys.profile(), queryFn: getMyRestaurant });
}

/* -------------------------------------------------------------- service --- */

/** The floor, as whoever is looking sees it: a manager's and a waiter's differ. */
export function useFloor(role: "manager" | "waiter") {
  return useQuery({
    queryKey: managerKeys.floor(role),
    queryFn: role === "manager" ? getManagerFloor : getWaiterFloor,
    refetchInterval: LIVE_INTERVAL,
  });
}

/**
 * The rail and the pass strip together: live work, and what has just gone out. One
 * query, because the screen always reads both and a move changes both at once.
 *
 * A quicker poll than the other live screens: the ages on a ticket are the point of
 * the kitchen, and they have to keep counting while nothing happens.
 */
export function useKitchenTickets() {
  return useQuery({
    queryKey: managerKeys.kitchen(),
    queryFn: loadKitchen,
    refetchInterval: KITCHEN_INTERVAL,
  });
}

export async function loadKitchen() {
  const [live, ready] = await Promise.all([listKitchenTickets(), listKitchenTickets("Ready")]);

  return { live, ready };
}

const KITCHEN_INTERVAL = 20_000;

/** Food waiting to be carried. Polled quicker: it should not depend on a socket. */
export function usePass() {
  return useQuery({ queryKey: managerKeys.pass(), queryFn: listPass, refetchInterval: 20_000 });
}

/* ---------------------------------------------------------------- money --- */

/** Open orders, with the most recently settled kept for confirmation. */
export function useBillingOrders() {
  return useQuery({
    queryKey: managerKeys.billingList(),
    queryFn: () => listBillingOrders(true),
    refetchInterval: LIVE_INTERVAL,
  });
}

export function useBill(id: string) {
  return useQuery({ queryKey: managerKeys.bill(id), queryFn: () => getBillingOrder(id) });
}

export function useOrderHistory(status: Exclude<OrderStatus, "Open"> | "All") {
  return useQuery({
    queryKey: managerKeys.history(status),
    queryFn: () => listOrderHistory(status === "All" ? undefined : status),
    placeholderData: keepPreviousData,
  });
}

/** A range of days. Empty strings mean the server's own default: today. */
export function useReport(range: { from: string; to: string }) {
  return useQuery({
    queryKey: managerKeys.report(range),
    queryFn: () =>
      getReportSummary(range.from === "" ? undefined : range.from, range.to === "" ? undefined : range.to),
    placeholderData: keepPreviousData,
  });
}

/* ------------------------------------------------------ bookings, guests --- */

export function useReservationBoard(options: { onDate: string; includeClosed: boolean }) {
  return useQuery({
    queryKey: managerKeys.reservations(options),
    queryFn: () =>
      getReservationBoard({
        onDate: options.onDate === "" ? undefined : options.onDate,
        includeClosed: options.includeClosed,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_INTERVAL,
  });
}

/**
 * The latest hundred reviews and the figures over all of them. More than fits on a
 * screen: the list and its filters reach back that far, and a manager narrowing to
 * one-star reviews wants more than a fortnight of them.
 */
export function useReviews() {
  return useQuery({ queryKey: managerKeys.reviews(), queryFn: () => listReviews(100) });
}

/* ----------------------------------------------------------------- menu --- */

export function useMenuCategories() {
  return useQuery({ queryKey: managerKeys.categories(), queryFn: listCategories });
}

export function useMenuItems(filter: { search: string; categoryId: string }) {
  return useQuery({
    queryKey: managerKeys.items(filter),
    queryFn: () =>
      listItems({
        search: filter.search,
        categoryId: filter.categoryId === "" ? undefined : filter.categoryId,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useMenuItem(id: string) {
  return useQuery({ queryKey: managerKeys.item(id), queryFn: () => getItem(id) });
}

/* ---------------------------------------------------------------- setup --- */

export function useTables() {
  return useQuery({ queryKey: managerKeys.tables(), queryFn: listTables });
}

export function useStaff(search: string) {
  return useQuery({
    queryKey: managerKeys.staff(search),
    queryFn: () => listStaff(search),
    placeholderData: keepPreviousData,
  });
}

export function useInventory(includeArchived: boolean) {
  return useQuery({
    queryKey: managerKeys.inventory(includeArchived),
    queryFn: () => listInventory(includeArchived),
    placeholderData: keepPreviousData,
  });
}

export function useCustomers(filter: { search: string; includeInactive: boolean }) {
  return useQuery({
    queryKey: managerKeys.customers(filter),
    queryFn: () => listCustomers(filter),
    placeholderData: keepPreviousData,
  });
}

export function useSite() {
  return useQuery({ queryKey: managerKeys.site(), queryFn: getSite });
}
