"use client";

import { useEffect, useState } from "react";

/**
 * How long ago something happened, for the platform screens.
 *
 * Shared because two screens now ask the same question — the overview wants to know
 * which restaurants have gone silent, and the restaurants list wants to say the same
 * thing per row — and two implementations of "2 days ago" will eventually disagree
 * about what counts as a day.
 */

/** Milliseconds since the epoch, or 0 when the server sent nothing parseable. */
export function timeOf(isoString: string): number {
  const parsed = new Date(isoString).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The wall clock, on a half-minute beat.
 *
 * Null until the browser has mounted, so the server and the first paint agree:
 * reading the clock during render would make the markup differ every time.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());

    // Scheduled rather than called straight out of the effect body: the first
    // reading has to happen after the browser has painted, or the markup React
    // produced on the server and the markup it produces here disagree.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}

/**
 * How long ago, in the words somebody would use out loud.
 *
 * Coarse on purpose. An admin scanning a list needs the difference between an hour
 * and three days; the difference between 71 and 74 minutes is noise that makes the
 * column harder to read.
 */
export function sinceLabel(isoString: string | null, now: number | null): string {
  if (isoString === null) {
    return "never";
  }

  if (now === null) {
    return "—";
  }

  const then = timeOf(isoString);

  if (then === 0) {
    return "—";
  }

  const minutes = Math.max(0, Math.round((now - then) / 60_000));

  if (minutes < 2) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return days === 1 ? "yesterday" : `${days} days ago`;
}
