"use client";

import { useEffect, useState } from "react";

/**
 * How long it has been, in the words somebody actually uses.
 *
 * Recomputed on a timer rather than read during render, because calling the clock while
 * rendering is impure and a figure that only moved when something else happened would
 * sit frozen through the longest part of a wait - which is exactly the part it is for.
 *
 * Every half minute. A counter ticking every second turns a wait into a stopwatch, and
 * watching a stopwatch makes ten minutes feel like twenty.
 *
 * Null until the first tick, so the server and the browser agree on the first paint.
 */
export function useElapsed(sinceIsoString: string | null): string | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, []);

  if (now === null || sinceIsoString === null) {
    return null;
  }

  const since = new Date(sinceIsoString).getTime();

  if (Number.isNaN(since)) {
    return null;
  }

  const minutes = Math.max(0, Math.round((now - since) / 60_000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
