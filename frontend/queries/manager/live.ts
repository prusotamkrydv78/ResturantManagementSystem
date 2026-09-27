"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useThrottledInvalidate } from "@/lib/query/use-throttled-invalidate";
import { useRealtimeEvent, useRealtimeResync } from "@/lib/realtime/realtime-context";
import { managerKeys } from "./keys";

/**
 * Keeps the restaurant console current by server signal rather than by each screen
 * reloading itself.
 *
 * THE RULE
 *
 * Every order and ticket event the server sends is turned into which cached reads
 * are now stale. TanStack refetches only the ones a screen is showing; the rest
 * refresh when next opened. One place decides this, instead of every page listening
 * for its own events and fetching again from nothing.
 *
 *   - An order placed, confirmed or asking for the bill: service, billing, today.
 *   - A kitchen ticket moving: service (floor, kitchen, pass), and today's figures.
 *   - An order settled or cancelled: all of that, plus reports and reservations
 *     (a settled table frees its booking), because money moved.
 *
 * Mounted once in the console shell while a manager is signed in. On reconnect,
 * signals sent while the connection was down are not coming, so everything in the
 * restaurant is marked stale once and re-read.
 */

/** Service screens and today's figures: fresh within a moment. */
const SERVICE_WINDOW = 1_500;
/** Reports: a range total, which nobody needs updated faster than this. */
const REPORT_WINDOW = 15_000;

export function useManagerLiveUpdates() {
  const invalidate = useThrottledInvalidate();
  const client = useQueryClient();

  const service = () => {
    invalidate(managerKeys.service, SERVICE_WINDOW);
    invalidate(managerKeys.dashboard(), SERVICE_WINDOW);
  };

  const orders = () => {
    service();
    invalidate(managerKeys.billing, SERVICE_WINDOW);
  };

  const moneyMoved = () => {
    orders();
    invalidate(managerKeys.reports, REPORT_WINDOW);
    invalidate(["restaurant", "reservations"], SERVICE_WINDOW);
  };

  useRealtimeEvent("orderPlaced", orders);
  useRealtimeEvent("orderConfirmed", orders);
  useRealtimeEvent("billRequested", orders);

  useRealtimeEvent("ticketQueued", service);
  useRealtimeEvent("ticketStarted", service);
  useRealtimeEvent("ticketReady", service);
  useRealtimeEvent("ticketRecalled", service);
  useRealtimeEvent("ticketServed", service);

  useRealtimeEvent("orderSettled", moneyMoved);
  useRealtimeEvent("orderCancelled", moneyMoved);

  useRealtimeResync(() => {
    void client.invalidateQueries({ queryKey: managerKeys.all });
  });
}
