"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useRealtimeStatus } from "@/lib/realtime/realtime-context";

/**
 * Says so when the screen has stopped updating by itself.
 *
 * WHY IT EXISTS
 *
 * The order list and the billing queue are kept current by the live connection alone.
 * When it dropped they froze, and a frozen list looks exactly like a quiet one: a
 * waiter had no way to tell "nothing has happened" from "you are not being told". The
 * connection state was tracked the whole time and shown to nobody.
 *
 * WHY IT WAITS
 *
 * Not shown for the first few seconds of an outage. Almost every drop is a moment of
 * wifi that the connection recovers from on its own, and a warning that flashed up and
 * vanished several times a service would teach people to ignore the one that mattered.
 */
const GRACE_MS = 8_000;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function LiveUpdatesBanner() {
  const status = useRealtimeStatus();
  const down = status !== null && status.enabled && !status.connected;

  // Whether the device itself has no network, which is worth saying differently: it
  // is something staff can fix by walking back into range, and the server is fine.
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const [graceOver, setGraceOver] = useState(false);

  useEffect(() => {
    if (!down) {
      return;
    }

    const timer = setTimeout(() => setGraceOver(true), GRACE_MS);

    return () => {
      clearTimeout(timer);
      setGraceOver(false);
    };
  }, [down]);

  if (!down || !graceOver) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning-border bg-warning-soft px-4 py-2 text-sm text-text"
    >
      <WifiOff className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">
          {online ? "Live updates paused." : "No internet connection."}
        </span>{" "}
        <span className="text-muted">
          This screen may be out of date. It will refresh itself as soon as the
          connection is back.
        </span>
      </span>
      <button
        type="button"
        onClick={() => status?.retryNow()}
        className="shrink-0 rounded-md border border-border-strong bg-surface px-2.5 py-1 text-sm font-medium text-text transition-colors hover:bg-surface-3"
      >
        Try now
      </button>
    </div>
  );
}
