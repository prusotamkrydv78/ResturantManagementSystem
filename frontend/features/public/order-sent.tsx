"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    const timer = setTimeout(onDone, duration);

    return () => clearTimeout(timer);
  }, [onDone, duration]);

  return createPortal(
    <div
      // A status rather than a dialog: it announces itself and then leaves, and it
      // takes no input, so trapping focus in it would strand a keyboard for no
      // reason.
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-canvas/95 backdrop-blur"
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
