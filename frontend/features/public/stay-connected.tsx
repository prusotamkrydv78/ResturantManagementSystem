"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askForPush, pushState, type PushState } from "@/lib/notify/push";

/**
 * Offering to reach a guest once they stop looking at the page.
 *
 * The whole reason this exists: for most of the wait nobody is watching the screen, so
 * the toast and the timeline reach nobody. This is the one moment where asking for
 * permission makes sense to the person being asked - they have just ordered, they are
 * about to put the phone down, and the thing being offered is the thing they want.
 *
 * Asked once and never again. A browser refusal is permanent, so a prompt fired on
 * arrival - before there is anything to be notified about - does not just get declined,
 * it burns the only chance the site had. Dismissing is remembered for the same reason:
 * a card that comes back every visit is a card people learn to close without reading.
 *
 * Disappears entirely once answered. There is nothing to configure here, and a settings
 * row for something the browser already owns would be a second switch that disagrees
 * with the first.
 */
const DISMISSED_KEY = "rms.push.dismissed";

export function StayConnected({ orderNumber }: { orderNumber: number }) {
  const [state, setState] = useState<PushState>("unsupported");
  const [dismissed, setDismissed] = useState(true);
  const [asking, setAsking] = useState(false);

  // Read on mount rather than during render: both of these touch the browser, and
  // neither exists on the server.
  useEffect(() => {
    setState(pushState());

    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "yes");
    } catch {
      // Storage unavailable. Showing the card is the better failure.
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);

    try {
      window.localStorage.setItem(DISMISSED_KEY, "yes");
    } catch {
      // It will simply be offered again next time.
    }
  }

  async function turnOn() {
    setAsking(true);
    setState(await askForPush());
    setAsking(false);
  }

  // Granted needs no card - it is already working. Denied needs none either, because
  // the browser will not ask again and a card that cannot do anything is clutter.
  if (state === "granted") {
    return (
      <p className="settle-in flex items-start gap-2 text-2xs text-muted">
        <Check
          className="toast-badge mt-px size-3.5 shrink-0 text-success"
          aria-hidden="true"
        />
        Your phone will let you know when order #{orderNumber} is ready, even with this
        page closed.
      </p>
    );
  }

  if (state !== "default" || dismissed) {
    return null;
  }

  return (
    <div className="settle-in flex items-start gap-3 rounded-lg border border-primary-border bg-primary-soft p-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary"
      >
        {/* The bell rings, on a long cycle. This card asks permission to buzz a
            phone, and showing what that means beats a sentence describing it -
            but a bell shaking every second would be the exact nuisance the
            reader is being asked to allow. */}
        <BellRing className="ring-bell size-4" />
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-text">
            Put your phone down — we will tell you
          </p>
          <p className="text-2xs text-muted">
            Get a buzz the moment your food is ready. No app, and you can stop it any
            time from your browser.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void turnOn()} disabled={asking}>
            {asking ? "Waiting…" : "Yes, let me know"}
          </Button>

          <button
            type="button"
            onClick={dismiss}
            className="pressable rounded-md px-2 py-1 text-2xs text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            No thanks
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="pressable -m-1 shrink-0 rounded-md p-1 text-subtle transition-colors hover:text-text"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
