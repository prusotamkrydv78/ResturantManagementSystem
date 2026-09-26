"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Marks queries stale in response to server signals, without letting a burst of
 * signals become a burst of requests.
 *
 * WHY A THROTTLE
 *
 * During a dinner rush a platform can see fifty orders a minute, and every one of
 * them is a signal. Refetching the overview fifty times would be fifty identical
 * aggregate reads, and the screen could not show them any faster than a person can
 * read. So each key refetches at most once per window:
 *
 *   - the first signal after a quiet spell refreshes at once, so a single change
 *     appears immediately;
 *   - any more inside the window are folded into one refresh at its end, so the
 *     last change in a burst is never lost.
 *
 * Each key keeps its own window, so a flood of pulse updates never delays a report.
 */
export function useThrottledInvalidate() {
  const client = useQueryClient();
  const lastRun = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Timers belong to this screen; nothing fires after it is gone.
  useEffect(() => {
    const timers = pending.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return useCallback(
    (queryKey: QueryKey, windowMs: number) => {
      const id = JSON.stringify(queryKey);

      if (pending.current.has(id)) {
        // Already scheduled to run at the end of this window.
        return;
      }

      const run = () => {
        pending.current.delete(id);
        lastRun.current.set(id, Date.now());
        void client.invalidateQueries({ queryKey });
      };

      const since = Date.now() - (lastRun.current.get(id) ?? 0);

      if (since >= windowMs) {
        run();
      } else {
        pending.current.set(id, setTimeout(run, windowMs - since));
      }
    },
    [client],
  );
}
