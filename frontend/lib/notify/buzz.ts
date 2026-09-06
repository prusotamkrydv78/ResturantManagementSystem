/**
 * The notification that works in a restaurant.
 *
 * A phone at dinner is on silent far more often than not, so the chime reaches nobody
 * and the toast reaches nobody either - the screen is dark. A short vibration is the one
 * channel that still gets through, and it is the one people actually feel.
 *
 * The patterns are deliberately different per weight, because a phone in a pocket is
 * read by feel rather than looked at: two quick taps is progress, a longer double pulse
 * is "go and get your food". A guest learns the difference within one meal without ever
 * being told.
 *
 * Silently absent on desktop and on iOS, where the API is not implemented. Nothing here
 * is load bearing - it sits alongside the sound and the toast rather than replacing
 * either.
 */

/** How much a stage is worth interrupting somebody for. */
export type BuzzWeight = "gentle" | "alert" | "done";

/**
 * Milliseconds on, off, on. Kept short: a long vibration in a quiet dining room is the
 * kind of thing that makes somebody turn the whole feature off.
 */
const PATTERNS: Record<BuzzWeight, readonly number[]> = {
  // Something moved along. Barely there on purpose.
  gentle: [18],
  // Worth looking up for - the food is at the pass, or a waiter is coming over.
  alert: [45, 70, 45],
  // An ending. One longer pulse that reads as a full stop rather than a request.
  done: [90],
};

/**
 * Vibrates, or does nothing at all.
 *
 * Never throws. Some browsers expose the method and reject the call depending on how
 * the page was reached, and a failed buzz must not take a notification down with it.
 */
export function buzz(weight: BuzzWeight = "gentle"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  try {
    navigator.vibrate([...PATTERNS[weight]]);
  } catch {
    // Blocked by the browser, or the page has never been interacted with.
  }
}
