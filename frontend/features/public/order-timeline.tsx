"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  isAtLeast,
  ORDER_STAGES,
  STAGE_COPY,
  type OrderStage,
} from "@/features/public/order-progress";
import { useElapsed } from "@/features/public/use-elapsed";
import { cn } from "@/lib/utils/cn";

/**
 * The step that has *just* been reached, for as long as it takes to say so.
 *
 * The difference between a timeline and a status list. Without this the component
 * only ever knows which steps are done, so a guest who looks away for ten seconds
 * comes back to a different picture with no idea which part of it changed - and
 * the one thing they wanted to know was exactly that.
 *
 * The furthest stage reached *is* the step that just completed, so there is
 * nothing to diff beyond noticing that the value moved.
 *
 * Cleared on a timer rather than left set. A highlight that never goes out stops
 * meaning "this just happened" by about the second stage, and a page left open on
 * a table would sit glowing at whatever it last heard about.
 */
function useJustLanded(stage: OrderStage | null): OrderStage | null {
  const seen = useRef<OrderStage | null>(null);
  const [landed, setLanded] = useState<OrderStage | null>(null);

  useEffect(() => {
    if (stage === null || stage === seen.current) {
      return;
    }

    seen.current = stage;
    setLanded(stage);

    const timer = setTimeout(() => setLanded(null), 1100);

    // Two stages arriving close together restart the highlight on the second
    // rather than letting the first one's timer put it out early.
    return () => clearTimeout(timer);
  }, [stage]);

  return landed;
}

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
  placedAtUtc,
}: {
  /** The furthest stage reached, or null while nothing has happened yet. */
  stage: OrderStage | null;
  /** Whether the live connection is up, so the page can be honest about it. */
  live: boolean;
  /** When the order went in, so the wait can be counted. */
  placedAtUtc: string;
}) {
  const waited = useElapsed(placedAtUtc);
  const landed = useJustLanded(stage);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">
          Where your order is
          {waited !== null && (
            <span className="ml-2 font-normal text-muted">{waited}</span>
          )}
        </h2>

        {/* Said plainly rather than hidden. A guest watching a screen that has quietly
            stopped listening would keep waiting for a step that will never animate. */}
        <span className="flex items-center gap-1.5 text-2xs text-subtle">
          <span aria-hidden="true" className="relative flex size-1.5">
            {/* A ring going out from the dot while the socket is up. The claim
                being made here is that the page is listening right now, and a
                still dot is exactly what a page that has quietly died looks
                like - so the claim has to be the thing that moves. */}
            {live && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            )}

            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                live ? "bg-success" : "bg-border-strong",
              )}
            />
          </span>
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
          // The one that changed a moment ago, which is the only row anybody is
          // looking for when they pick the phone back up.
          const justLanded = landed === step;

          return (
            <li
              key={step}
              // A staggered arrival for the list itself, running once when the
              // receipt first paints. Set inline because the delay is per row,
              // and left unconditional because re-rendering does not restart a
              // CSS animation - so this can never fire on a stage change.
              className="step-say flex gap-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              {/* The rail: a marker, and a line down to the next one. */}
              <div className="flex flex-col items-center">
                <span aria-hidden="true" className="relative flex size-5 shrink-0">
                  {/* Thrown off the marker at the moment it lands and then gone.
                      Mounted conditionally rather than toggled by class, so it
                      replays properly on a second arrival. */}
                  {justLanded && (
                    <span className="step-halo absolute inset-0 rounded-full bg-success" />
                  )}

                  <span
                    className={cn(
                      "relative flex size-5 items-center justify-center rounded-full border",
                      reached && "border-success bg-success text-inverse",
                      isNext &&
                        "border-primary bg-primary-soft text-primary stage-pulse",
                      !reached && !isNext && "border-border bg-surface-3",
                      justLanded && "step-land",
                    )}
                  >
                    {reached && <Check className="size-3" strokeWidth={3} />}
                    {isNext && <Loader2 className="size-3 animate-spin" />}
                  </span>
                </span>

                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-px flex-1",
                      reached ? "bg-success" : "bg-border",
                      // Drawn downward as the step above it completes, so progress
                      // visibly travels between the two markers instead of the
                      // whole rail turning green in one frame.
                      justLanded && "rail-fill",
                    )}
                  />
                )}
              </div>

              <div className={cn("flex flex-col", isLast ? "pb-0" : "pb-4")}>
                <span
                  className={cn(
                    "text-sm transition-colors duration-500",
                    reached && "font-medium text-text",
                    isNext && "font-medium text-primary",
                    !reached && !isNext && "text-subtle",
                    // Held green for a beat before easing back to the ordinary
                    // done colour, so the row names itself as the one that moved.
                    justLanded && "text-success!",
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
