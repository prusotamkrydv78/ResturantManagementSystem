"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getPlatformPulse,
  getPlatformReport,
  getPlatformRestaurant,
  getPlatformSettings,
  getPlatformSystem,
  listPlatformActivity,
} from "@/features/platform/api";
import { adminKeys, LIVE_INTERVAL } from "./keys";

/** Today across the estate. Live while the overview is open. */
export function usePlatformPulse(options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: adminKeys.pulse(),
    queryFn: getPlatformPulse,
    refetchInterval: options.live === true ? LIVE_INTERVAL : false,
  });
}

/**
 * The report for a range.
 *
 * One cache entry per range, so switching back to a preset already looked at is
 * instant; a new range keeps the last figures on screen until its own arrive.
 */
export function usePlatformReport(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: adminKeys.report(range),
    queryFn: () => getPlatformReport(range),
    placeholderData: keepPreviousData,
  });
}

/** Everything about one restaurant, as the platform sees it. Live while open. */
export function usePlatformRestaurant(id: string) {
  return useQuery({
    queryKey: adminKeys.platformRestaurant(id),
    queryFn: () => getPlatformRestaurant(id),
    refetchInterval: LIVE_INTERVAL,
  });
}

/** What administrators have done, newest first. */
export function usePlatformActivity(limit = 50) {
  return useQuery({
    queryKey: adminKeys.activityPage(limit),
    queryFn: () => listPlatformActivity(limit),
  });
}

/** What a new restaurant starts on. */
export function usePlatformSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: getPlatformSettings,
  });
}

/** The running deployment, and whether its database agrees with it. */
export function usePlatformSystem() {
  return useQuery({
    queryKey: adminKeys.system(),
    queryFn: getPlatformSystem,
  });
}
