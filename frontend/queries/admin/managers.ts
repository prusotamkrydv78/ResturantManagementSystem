"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getManager, listManagers } from "@/features/managers/api";
import type { ManagerFilter } from "@/types/manager";
import { adminKeys, LIVE_INTERVAL } from "./keys";

/**
 * Manager accounts, optionally narrowed by a server-side search.
 *
 * A new search keeps the last answer on screen until its own arrives, so the list
 * does not blink to a skeleton between keystrokes.
 */
export function useManagers(
  filter: { search?: string; status?: ManagerFilter } = {},
  options: { live?: boolean } = {},
) {
  return useQuery({
    queryKey: adminKeys.managerList(filter),
    queryFn: () => listManagers(filter),
    refetchInterval: options.live === true ? LIVE_INTERVAL : false,
    placeholderData: keepPreviousData,
  });
}

/** One manager, with their current assignment. */
export function useManager(id: string) {
  return useQuery({
    queryKey: adminKeys.manager(id),
    queryFn: () => getManager(id),
  });
}
