"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useThrottledInvalidate } from "@/lib/query/use-throttled-invalidate";
import {
  useRealtimeEvent,
  useRealtimeResync,
  type PlatformActivityPayload,
} from "@/lib/realtime/realtime-context";
import { adminKeys } from "./keys";

/**
 * Keeps the platform console current by server signal rather than by polling.
 *
 * THE RULE
 *
 * The server says when trading moves in a restaurant, and whether money moved. This
 * turns that into which queries are stale, and TanStack refetches only the ones a
 * screen is showing; the rest refresh when next opened. Nothing is refetched for a
 * change that cannot affect it.
 *
 * WHAT IS LIVE, AND WHAT IS NOT
 *
 *   - Today's figures (the pulse): every order, payment and plate at the pass moves
 *     them. Refreshed on every signal, at most every few seconds.
 *   - One restaurant's trading page: only that restaurant's signals.
 *   - Reports: only when money moved, and less eagerly - a report is read, not
 *     watched second by second.
 *
 * Restaurant and manager records, settings, the activity log and the system card
 * are deliberately not here. They change only when an administrator changes them,
 * and the screen that made the change already refreshes itself when it saves.
 *
 * Mounted once, in the admin shell, for as long as a platform admin is signed in.
 */

/** Today's figures and a restaurant's page: fresh within a couple of seconds. */
const TRADING_WINDOW = 3_000;

/** Reports: a range total, which nobody needs updated faster than this. */
const REPORT_WINDOW = 15_000;

export function useAdminLiveUpdates() {
  const invalidate = useThrottledInvalidate();
  const client = useQueryClient();

  useRealtimeEvent<PlatformActivityPayload>("platformActivity", (event) => {
    invalidate(adminKeys.pulse(), TRADING_WINDOW);
    invalidate(adminKeys.platformRestaurant(event.restaurantId), TRADING_WINDOW);

    if (event.moneyMoved) {
      // Every cached range at once, by the family key. Only a report currently on
      // screen refetches; the others are simply marked stale.
      invalidate(adminKeys.reports(), REPORT_WINDOW);
    }
  });

  // Signals sent while the connection was down are not coming. On reconnect every
  // live figure is re-read once, rather than trusted.
  useRealtimeResync(() => {
    void client.invalidateQueries({ queryKey: adminKeys.platform });
  });
}
