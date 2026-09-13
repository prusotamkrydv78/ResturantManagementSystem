"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/** How long the fade out takes. Must match `moment-out` in the stylesheet. */
const LEAVING_MS = 280;

/**
 * The moment an order lands.
 *
 * Shown over both ways of ordering, for a beat, before whatever comes next is
 * revealed underneath — the receipt on the website, the table's running order on the
 * staff pad.
 *
 * It earns the flourish where nothing else in the product would. A manager sees a
 * save confirmation forty times a shift and would come to hate a celebration by the
 * tenth; a guest does this once, it is the only task they ever perform here, and
 * until it lands they have no way of knowing whether the restaurant heard them. That
 * uncertainty is the thing being answered, and a line of green text answers it
 * weakly.
 *
 * Short on purpose. Long enough to register as an event, over before anybody who has
 * done it twice starts waiting for it.
 *
 * Portalled to the body, because both callers sit inside pages with sticky, blurred
 * bars, and a `backdrop-filter` anywhere above a fixed element makes that element
 * measure itself against the blurred box instead of the screen.
 */
export function OrderSentOverlay({
  orderNumber,
  onDone,
  /** How long it holds before handing the screen back, in milliseconds. */
  duration = 1700,
}: {
  orderNumber: number | null;
  onDone: () => void;
  duration?: number;
}) {
const [leaving, setLeaving] = useState(false);

  /**
   * Held in a ref, and this is the whole bug.
   *
   * The timer effect depended on `onDone`, and every caller passes an inline arrow -
   * a new function on each render. So each render of the page underneath tore the
   * timer down and started it again, and a page that re-rendered faster than this
   * overlay's own lifetime could never dismiss it.
   *
   * That was survivable while the page was quiet. Per-dish progress made it common:
   * the receipt now refetches on every message from the kitchen, so a chef ticking
   * off four dishes in a row is four re-renders inside the same second and a half,
   * and the overlay stops being able to close - full screen, over everything, with
   * nothing to press. The only way out was a reload.
   *
   * Keeping the callback here means the countdown depends on the duration alone, and
   * nothing the page does can restart it.
   */
  const latest = useRef(onDone);

  useEffect(() => {
    latest.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), duration);

    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (!leaving) {
      return;
    }

    const gone = setTimeout(() => latest.current(), LEAVING_MS);

    return () => clearTimeout(gone);
  }, [leaving]);

  return createPortal(
    <div
      // A status rather than a dialog: it announces itself and then leaves, and it
      // takes no input, so trapping focus in it would strand a keyboard for no
      // reason.
role="status"
      aria-live="polite"
      // A way out, whatever else happens.
      //
      // This covered the whole screen with no control on it at all, so anything that
      // wedged it left a guest with a dead phone and no recourse but a reload. A
      // full-screen panel needs a way out even when the timer is working, and
      // especially when it is not.
      onClick={() => setLeaving(true)}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-canvas/95 backdrop-blur",
        leaving ? "moment-out" : "moment-in",
      )}
    >
      <div className="relative flex size-28 items-center justify-center">
        {/* Behind the disc and larger, so it reads as the impact rather than as a
            second object. */}
        <span
          aria-hidden="true"
          className="sent-ring absolute size-24 rounded-full bg-success"
        />

        <span className="sent-pop relative flex size-24 items-center justify-center rounded-full bg-success">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="size-12"
          >
            <path
              d="M5 12.5 10 17.5 19 7"
              stroke="var(--text-inverse)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sent-draw"
            />
          </svg>
        </span>
      </div>

      <div className="sent-rise flex flex-col items-center gap-1 px-6 text-center">
        <p className="text-2xl font-semibold text-text">Order sent</p>

        {orderNumber === null ? (
          <p className="text-sm text-muted">
            A member of staff will send it to the kitchen.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Quote order{" "}
            <span className="font-semibold text-text tabular">
              #{orderNumber}
            </span>{" "}
            to a member of staff.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
