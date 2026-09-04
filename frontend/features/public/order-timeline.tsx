"use client";

import { Check, Loader2 } from "lucide-react";
import {
  isAtLeast,
  ORDER_STAGES,
  STAGE_COPY,
  type OrderStage,
} from "@/features/public/order-progress";
import { cn } from "@/lib/utils/cn";

/**
 * Where a customer's order has got to.
 *
 * The answer to the one question a guest actually has after ordering, which this product
 * previously left them to guess at: the receipt said "a member of staff will send it to
 * the kitchen" and kept saying it through confirmation, cooking and delivery.
 *
 * Every stage is listed from the start rather than appearing one at a time, so somebody
 * can see what is still to come and roughly where they are in it. A list that grew would
 * make the wait feel open ended.
 *
 * It never goes backwards, which the stage arithmetic guarantees rather than this
 * component. Progress that retreats reads as a fault even when it is only a reconnection.
 */
export function OrderTimeline({
  stage,
  live,
}: {
  /** The furthest stage reached, or null while nothing has happened yet. */
  stage: OrderStage | null;
  /** Whether the live connection is up, so the page can be honest about it. */
  live: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Where your order is</h2>

        {/* Said plainly rather than hidden. A guest watching a screen that has quietly
            stopped listening would keep waiting for a step that will never animate. */}
        <span className="flex items-center gap-1.5 text-2xs text-subtle">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-success" : "bg-border-strong",
            )}
          />
          {live ? "Updating live" : "Not updating — pull to refresh"}
        </span>
      </div>

      <ol className="flex flex-col">
        {ORDER_STAGES.map((step, index) => {
          const reached = isAtLeast(stage, step);
          // The first step not yet reached is the one being waited on, and only when
          // something has already happened - before that, nothing is in progress.
          const isNext =
            !reached &&
            ORDER_STAGES.findIndex((candidate) => !isAtLeast(stage, candidate)) === index;
          const isLast = index === ORDER_STAGES.length - 1;

          return (
            <li key={step} className="flex gap-3">
              {/* The rail: a marker, and a line down to the next one. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    reached && "border-success bg-success text-inverse",
                    isNext && "border-primary bg-primary-soft text-primary",
                    !reached && !isNext && "border-border bg-surface-3",
                  )}
                >
                  {reached && <Check className="size-3" strokeWidth={3} />}
                  {isNext && <Loader2 className="size-3 animate-spin" />}
                </span>

                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-px flex-1",
                      reached ? "bg-success" : "bg-border",
                    )}
                  />
                )}
              </div>

              <div className={cn("flex flex-col", isLast ? "pb-0" : "pb-4")}>
                <span
                  className={cn(
                    "text-sm",
                    reached && "font-medium text-text",
                    isNext && "font-medium text-primary",
                    !reached && !isNext && "text-subtle",
                  )}
                >
                  {STAGE_COPY[step].done}
                </span>

                {/* Only the step in progress explains itself. Explaining all five at
                    once would be a wall of text on a phone. */}
                {isNext && (
                  <span className="text-2xs text-muted">
                    {STAGE_COPY[step].detail}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
