"use client";

import { useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "./keys";

/**
 * What a change to the estate makes stale.
 *
 * A restaurant or manager edit can move the figures too - suspending a restaurant
 * changes who is trading, assigning a manager changes the estate's health - so both
 * families and the platform figures are marked stale together. Stale is cheap: only
 * the queries a screen is actually showing refetch now; the rest refetch when next
 * looked at.
 */
export function useInvalidateEstate() {
  const client = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: adminKeys.restaurants }),
      client.invalidateQueries({ queryKey: adminKeys.managers }),
      client.invalidateQueries({ queryKey: adminKeys.platform }),
    ]);
  };
}

/** After the platform defaults change: the defaults, and the log that records it. */
export function useInvalidatePlatformSettings() {
  const client = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: adminKeys.settings() }),
      client.invalidateQueries({ queryKey: adminKeys.activity() }),
    ]);
  };
}
