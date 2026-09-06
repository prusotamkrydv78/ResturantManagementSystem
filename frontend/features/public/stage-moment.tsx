"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  ChefHat,
  Flame,
  HandPlatter,
  ReceiptText,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { STAGE_COPY, type CustomerStage } from "@/features/public/order-progress";
import { playChime, type ChimeTone } from "@/lib/notify/chime";
import { cn } from "@/lib/utils/cn";

/**
 * Every step of a customer's order, given the whole screen for a beat.
 *
 * This used to be a toast for five stages out of six and a full-screen moment for the
 * one. That split was the wrong way round for the audience: a toast is a good shape for
 * somebody working a screen all shift, who needs to be told without being stopped, and
 * a guest is the opposite of that person. Their phone is face down on a table. They pick
 * it up because it buzzed, and the question in their head on the way up is "what
 * happened" - which a card in the corner answers about as well as a footnote.
 *
 * So each stage gets the screen, and the answer is the first and only thing on it.
 *
 * It works because a guest sees this six times in an evening, once each. The same
 * treatment on a waiter's pad would be intolerable by the third table - which is exactly
 * why the toast is still what the staff side uses, and why nothing here is shared with
 * it beyond the stage names.
 *
 * Each stage gets its own colour, its own icon and its own hold. They are not decoration:
 * a guest half-looking from across a table reads the colour before the words, and a red
 * screen saying an order was cancelled must not be able to be mistaken for a green one
 * saying the food is coming.
 *
 * Portalled to the body, because the receipt sits inside stacking contexts and cards with
 * `backdrop-filter` - and a blur anywhere above a fixed element makes it measure itself
 * against that box instead of against the screen.
 */

/** How one stage announces itself. */
interface Moment {
  icon: React.ReactNode;
  /** The disc behind the icon. Read before the words, so it carries the meaning. */
  disc: string;
  /** How long it holds before it starts leaving, in milliseconds. */
  hold: number;
  /**
   * How many rings it throws off.
   *
   * The dial for how much of an occasion this is. Nought is not an absence of effort;
   * it is what stops a cancellation from arriving dressed as good news.
   */
  rings: 0 | 1 | 2;
  /**
   * Which of the three chimes it speaks in.
   *
   * Rising for something that wants attention, falling for something that is dealt
   * with, level for the rest. A guest whose phone is in a pocket hears the shape of
   * the news before they have looked at anything.
   */
  voice: ChimeTone;
  /** Steam, for the two stages where something is actually hot. */
  steam?: boolean;
}

const MOMENTS: Record<CustomerStage, Moment> = {
  // Somebody has read it and agreed it. The relief stage: until this lands a guest has
  // no evidence the restaurant heard them at all.
  Confirmed: {
    icon: <BadgeCheck className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-success",
    hold: 1900,
    rings: 1,
    voice: "info",
  },

  // Progress rather than an event. Briefest of the six, and the quietest.
  WithKitchen: {
    icon: <ChefHat className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-primary",
    hold: 1700,
    rings: 1,
    voice: "info",
  },

  BeingPrepared: {
    icon: <Flame className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-warning",
    hold: 1900,
    rings: 1,
    voice: "info",
    steam: true,
  },

  // The one everybody is actually waiting for, and the only one that gets everything at
  // once: two rings, steam, and the longest hold of the six.
  Ready: {
    icon: <UtensilsCrossed className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-warning",
    hold: 2400,
    rings: 2,
    voice: "alert",
    steam: true,
  },

  Served: {
    icon: <HandPlatter className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-success",
    hold: 2000,
    rings: 2,
    voice: "settled",
  },

  Settled: {
    icon: <ReceiptText className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-success",
    hold: 2200,
    rings: 2,
    voice: "settled",
  },

  // No rings and no bounce anywhere near it. Bad news delivered with a flourish reads as
  // a product that has not noticed what it is saying, and this is the one message here
  // that a guest may have to act on.
  Cancelled: {
    icon: <XCircle className="size-14" strokeWidth={1.75} aria-hidden="true" />,
    disc: "bg-danger",
    hold: 2800,
    rings: 0,
    voice: "alert",
  },
};

/** How long the exit takes. Must match `moment-out` in the stylesheet. */
const LEAVING_MS = 280;

export function StageMoment({
  stage,
  orderNumber,
  onDone,
}: {
  stage: CustomerStage;
  /** Shown underneath, because a table may be waiting on more than one. */
  orderNumber: number | null;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  // Only for the mute switch. The sound belongs to the moment rather than to a toast
  // now, but the choice to turn it off still belongs wherever the user made it.
  const { soundOn } = useToast();
  const moment = MOMENTS[stage];
  const copy = STAGE_COPY[stage];

  // Spoken as it arrives, and deliberately from in here rather than from the caller.
  // The screen and the chime are one announcement; wiring them separately is how they
  // end up disagreeing after somebody edits one of them. Once per mount, which is once
  // per stage, because the caller keys this on the stage.
  useEffect(() => {
    if (soundOn) {
      playChime(moment.voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two timers rather than one, so it fades out instead of being cut. A full-screen
  // thing that vanishes between two frames reads as a fault in the page - the eye
  // registers that something went missing well before it works out what.
  useEffect(() => {
    const goes = setTimeout(() => setLeaving(true), moment.hold);

    return () => clearTimeout(goes);
  }, [moment.hold]);

  useEffect(() => {
    if (!leaving) {
      return;
    }

    const gone = setTimeout(onDone, LEAVING_MS);

    return () => clearTimeout(gone);
  }, [leaving, onDone]);

  return createPortal(
    <div
      // A status rather than a dialog. It announces itself and leaves, it takes no
      // input, and trapping focus in something with no way out would strand a keyboard
      // for no reason.
      role="status"
      aria-live="polite"
      // Tapping sends it away early. Somebody who has read it in half a second should
      // not have to watch the rest, and a screen that ignores a tap feels stuck.
      onClick={() => setLeaving(true)}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-canvas/95 backdrop-blur",
        leaving ? "moment-out" : "moment-in",
      )}
    >
      <div className="relative flex size-32 items-center justify-center">
        {/* Steam, for the stages where there is something hot to have steam. Two wisps
            offset in time and position, because one on its own reads as a rendering
            fault rather than as a hot plate. */}
        {moment.steam === true && (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "wisp absolute -top-2 left-10 h-8 w-1.5 rounded-full blur-[3px]",
                moment.disc,
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "wisp absolute -top-3 right-10 h-8 w-1.5 rounded-full blur-[3px] [animation-delay:900ms]",
                moment.disc,
              )}
            />
          </>
        )}

        {/* Behind the disc and larger, so they read as the impact of it landing rather
            than as a second object arriving alongside. The second is held back a beat;
            two rings in step would just look like one thick one. */}
        {moment.rings >= 1 && (
          <span
            aria-hidden="true"
            className={cn("sent-ring absolute size-28 rounded-full", moment.disc)}
          />
        )}

        {moment.rings >= 2 && (
          <span
            aria-hidden="true"
            className={cn(
              "sent-ring absolute size-28 rounded-full [animation-delay:200ms]",
              moment.disc,
            )}
          />
        )}

        <span
          className={cn(
            "relative flex size-28 items-center justify-center rounded-full text-inverse",
            moment.disc,
            // The overshoot is what makes it read as arriving rather than as having
            // been there. Withheld from a cancellation, which should not bounce.
            moment.rings === 0 ? "settle-in" : "sent-pop",
          )}
        >
          {moment.icon}
        </span>
      </div>

      <div className="sent-rise flex flex-col items-center gap-1 px-6 text-center">
        <p className="text-2xl font-semibold text-text">{copy.title}</p>
        <p className="text-sm text-muted">{copy.detail}</p>

        {orderNumber !== null && (
          <p className="mt-1 text-2xs text-subtle">
            Order <span className="tabular">#{orderNumber}</span>
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Holds the stages waiting for the screen.
 *
 * A queue rather than a single value, because two stages can land within a second of
 * each other - a waiter confirming an order and sending it straight through is one
 * gesture on their side and two events on this one. Without a queue the second would
 * replace the first mid-animation and a guest would see a flicker instead of either.
 *
 * Never more than two deep, and the middle is what gets dropped. Six stages arriving
 * during a reconnection would otherwise take the screen for a quarter of a minute,
 * playing out a story that had already finished. What a guest wants in that case is the
 * newest thing that happened, so the queue keeps what is on screen, keeps the newest,
 * and quietly loses whatever is now in between.
 */
export function useStageMoments(): {
  /** The stage that should be on screen, or null when there is nothing to say. */
  moment: CustomerStage | null;
  /** Queues a stage. */
  show: (stage: CustomerStage) => void;
  /** Called when one has finished, to bring on whatever is behind it. */
  done: () => void;
} {
  const [queue, setQueue] = useState<readonly CustomerStage[]>([]);

  const show = useCallback((stage: CustomerStage) => {
    setQueue((current) => {
      const showing = current[0];

      // Nothing on screen, so it goes straight up. Otherwise it waits behind whatever
      // is showing and displaces anything that was already waiting.
      return showing === undefined ? [stage] : [showing, stage];
    });
  }, []);

  const done = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  return { moment: queue[0] ?? null, show, done };
}
