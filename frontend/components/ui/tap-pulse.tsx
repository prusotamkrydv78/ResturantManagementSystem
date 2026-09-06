"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A ring that opens where a finger lands.
 *
 * The one piece of feedback nothing else on a touch screen gives. A button can darken,
 * scale and reflow, and all of that says "this control changed" - none of it says "your
 * tap landed here". On a phone, in a busy room, with a thumb covering the very thing it
 * just pressed, that is the question actually being asked, and the answer has to appear
 * somewhere the thumb is not.
 *
 * Mounted once per page rather than wrapped around each control. Every button, link,
 * tile and stepper on the screen is covered without any of them knowing about it, and
 * nothing has to be remembered when the next one is written.
 *
 * Only for taps on something that does anything. A ring blooming under a finger that
 * was starting a scroll, or resting on a paragraph, is noise that teaches people to
 * stop reading it - and on a long menu most contact with the glass is scrolling.
 *
 * Portalled and fixed, so it is never clipped by the control it belongs to, never
 * inherits a rounded corner or an overflow rule, and can sit above a sheet.
 */

/** One ring, waiting to finish. */
interface Pulse {
  id: number;
  x: number;
  y: number;
}

/**
 * What counts as worth acknowledging.
 *
 * Written as one selector so the answer lives in a single place. `label` is here for the
 * star ratings, whose real input is visually hidden and whose label is the whole target.
 */
const INTERACTIVE =
  'button, a[href], [role="button"], label, summary, select, input[type="radio"], input[type="checkbox"], input[type="submit"]';

/** How long a ring lives. Must outlast `tap-pulse` in the stylesheet. */
const LIFETIME_MS = 520;

/** At most this many at once, so a drum roll of taps cannot pile up nodes. */
const MAX_LIVE = 4;

export function TapPulse() {
  const [pulses, setPulses] = useState<readonly Pulse[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      // On press rather than on click, which is the whole point: this has to answer
      // the finger at the moment it touches, not after the control has decided what
      // to do. A tap that turns into a drag gets a ring it did not need, which is a
      // far smaller cost than every real tap arriving late.
      const target = event.target;

      if (!(target instanceof Element) || target.closest(INTERACTIVE) === null) {
        return;
      }

      const id = nextId.current++;

      setPulses((current) => [...current, { id, x: event.clientX, y: event.clientY }].slice(-MAX_LIVE));

      window.setTimeout(() => {
        setPulses((current) => current.filter((pulse) => pulse.id !== id));
      }, LIFETIME_MS);
    }

    // On the window and passive, so this can never delay or swallow the press it is
    // reporting on. Capture, so a control that stops propagation still gets a ring.
    window.addEventListener("pointerdown", onPointerDown, {
      passive: true,
      capture: true,
    });

    return () =>
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  // Nothing until something has been pressed, which doubles as the guard that keeps
  // `document` out of the server render: the list can only fill from a pointer event,
  // and there are none on a server. No mounted flag needed.
  if (pulses.length === 0) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden="true"
      // Above the sheets and the full-screen moments, and deaf to pointers - a ring
      // that could be clicked would eat the second tap of a double.
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {pulses.map((pulse) => (
        <span
          key={pulse.id}
          className="tap-pulse absolute size-10 rounded-full bg-primary"
          // Centred on the contact point. Inline because it is a measurement rather
          // than a style - there is no class for "wherever the finger was".
          style={{ left: pulse.x - 20, top: pulse.y - 20 }}
        />
      ))}
    </div>,
    document.body,
  );
}
