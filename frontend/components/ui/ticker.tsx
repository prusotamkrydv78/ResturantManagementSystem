"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/**
 * A figure that counts up to itself.
 *
 * Not decoration: the number it lands on is the only one on this screen an operator
 * will look for first, and watching it run gives the eye somewhere to be while the
 * rest of the card settles. It also makes a change visible - when the poll comes back
 * thirty seconds later with a bigger figure, the count runs the difference rather
 * than swapping one number for another where nobody was looking.
 *
 * Driven by a motion value rather than by state, so the ninety frames it takes are
 * ninety canvas-free paints and not ninety React renders.
 */
export function Ticker({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduced = useReducedMotion();
  const count = useMotionValue(0);
  const text = useTransform(count, (running) =>
    running.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );

  useEffect(() => {
    if (reduced === true) {
      count.set(value);

      return;
    }

    const run = animate(count, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => run.stop();
  }, [count, reduced, value]);

  return <motion.span>{text}</motion.span>;
}
