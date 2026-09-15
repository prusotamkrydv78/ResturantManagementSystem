"use client";

import { motion } from "motion/react";
import type { TargetAndTransition } from "motion/react";

/**
 * How a restaurant page moves.
 *
 * Shared by every design rather than written into each, because the four differ in
 * how they look and not in what "arrives gently" means. A design decides which of its
 * bands are wrapped; this decides what wrapping one does.
 *
 * WHY THE CHOICES ARE THIS FEW
 *
 * Five arrivals and two speeds, and nothing else — no easing picker, no distance, no
 * stagger. A manager choosing between forty combinations is a manager building an
 * animation rather than running a restaurant, and a page where every band enters
 * differently is not a page with personality, it is a page that cannot sit still.
 * These five are the ones that look composed on a page like this; the rest were left
 * out on purpose.
 *
 * REDUCED MOTION IS HONOURED BY THE CONFIG ABOVE
 *
 * Each template wraps itself in `MotionConfig reducedMotion="user"`, which turns every
 * transform below into nothing while leaving opacity alone. A reader who asks for less
 * motion gets a page that is complete and still, not one that never arrives.
 */

/** How a section enters when it is scrolled to. */
export type Arrival = "none" | "fade" | "rise" | "slide" | "zoom";

/** How quickly it does it. */
export type Pace = "calm" | "brisk";

export interface PageMotion {
  /** Whether the large photographs drift as they are looked at. */
  photos: "still" | "drift";
  /** How fast every arrival runs. */
  pace: Pace;
  /** One arrival per section, keyed by the id the editor uses. */
  sections: Record<string, Arrival>;
}

/** What each arrival starts from. The end state is always "as laid out". */
const FROM: Record<Exclude<Arrival, "none">, TargetAndTransition> = {
  fade: { opacity: 0 },
  rise: { opacity: 0, y: 24 },
  slide: { opacity: 0, x: -28 },
  // Barely a zoom. Past about four per cent a band arrives looking like a slide in a
  // presentation, which is the wrong register for every one of these designs.
  zoom: { opacity: 0, scale: 0.97 },
};

const SECONDS: Record<Pace, number> = { calm: 0.75, brisk: 0.45 };

/** What the editor offers, and what each one is called in plain words. */
export const ARRIVAL_OPTIONS: { value: Arrival; label: string }[] = [
  { value: "rise", label: "Rises into place" },
  { value: "fade", label: "Fades in" },
  { value: "slide", label: "Slides from the left" },
  { value: "zoom", label: "Settles from slightly large" },
  { value: "none", label: "Appears, no movement" },
];

export const PACE_OPTIONS: { value: Pace; label: string }[] = [
  { value: "calm", label: "Unhurried" },
  { value: "brisk", label: "Quick" },
];

export const PHOTO_OPTIONS: { value: PageMotion["photos"]; label: string }[] = [
  { value: "drift", label: "Drift slowly" },
  { value: "still", label: "Hold still" },
];

/** The arrival one section is set to, or the page's usual one. */
export function arrivalOf(page: PageMotion | undefined, id: string): Arrival {
  return page?.sections?.[id] ?? "rise";
}

/**
 * A section arriving as it is scrolled to.
 *
 * Once, and never again: a band that re-animates every time it is scrolled past turns
 * a long page into a flickering thing. The viewport margin starts it before the
 * section reaches the middle of the screen, so the movement finishes while the section
 * is still being approached rather than under the reader's eye.
 *
 * With "none" it renders its children and no wrapper at all, so a manager who turns
 * the movement off gets a page with nothing extra in it rather than a page with a
 * motion component doing nothing.
 */
export function Reveal({
  id,
  page,
  children,
}: {
  id: string;
  page: PageMotion | undefined;
  children: React.ReactNode;
}) {
  const arrival = arrivalOf(page, id);

  if (arrival === "none") {
    return children;
  }

  return (
    <motion.div
      initial={FROM[arrival]}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-10% 0px -15% 0px" }}
      transition={{
        duration: SECONDS[page?.pace ?? "calm"],
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A photograph that moves very slowly while it is on screen.
 *
 * Half a minute to travel eight per cent, which is slow enough that nobody catches it
 * happening and the room simply feels alive. Applied to the one or two largest
 * pictures on a page and never to a grid of them — a wall of independently drifting
 * thumbnails is a screensaver.
 */
export function Drift({
  page,
  children,
}: {
  page: PageMotion | undefined;
  children: React.ReactNode;
}) {
  if (page?.photos !== "drift") {
    return children;
  }

  return (
    <motion.div
      className="h-full w-full"
      initial={{ scale: 1.08 }}
      animate={{ scale: 1 }}
      transition={{ duration: 30, ease: "linear" }}
    >
      {children}
    </motion.div>
  );
}
