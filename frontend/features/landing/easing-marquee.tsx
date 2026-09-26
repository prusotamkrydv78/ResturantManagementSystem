"use client";

import { useEffect, useRef } from "react";

/**
 * A marquee track that glides to a stop while hovered, rather than freezing.
 *
 * The scrolling itself is the CSS `marquee` animation; this only eases that
 * animation's playback rate - to zero over about four seconds after a short pause on hover, and
 * back up to full speed on leave - so the words slow under the pointer and settle.
 */
export function EasingMarquee({ className, children }: { className?: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = track.current;

    if (!element) {
      return;
    }

    let frame = 0;
    let timer = 0;

    // Eases the rate from wherever it is to `to` over `ms`, on an ease-in-out curve so
    // it keeps its pace at first and settles softly, never braking hard.
    const glide = (to: number, ms: number) => {
      const animation = element.getAnimations()[0];

      if (!animation) {
        return;
      }

      const from = animation.playbackRate;
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = t * t * (3 - 2 * t);

        animation.playbackRate = from + (to - from) * eased;

        if (t < 1) {
          frame = requestAnimationFrame(step);
        }
      };

      frame = requestAnimationFrame(step);
    };

    const go = (to: number) => () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);

      if (to === 0) {
        // A short grace before slowing, so a pointer passing over does nothing.
        timer = window.setTimeout(() => glide(0, 4000), 600);
      } else {
        glide(1, 1500);
      }
    };

    const slow = go(0);
    const resume = go(1);

    element.addEventListener("pointerenter", slow);
    element.addEventListener("pointerleave", resume);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener("pointerenter", slow);
      element.removeEventListener("pointerleave", resume);
    };
  }, []);

  return (
    <div ref={track} className={className}>
      {children}
    </div>
  );
}
