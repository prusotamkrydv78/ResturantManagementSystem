"use client";

import { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";

/**
 * Motion for the landing page.
 *
 * Everything that moves on the front door goes through these few pieces, so it all
 * moves the same way and all of it honours reduced motion: under that preference
 * reveals appear in place and the cycling word simply holds its first value.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Wraps the page so every motion component below respects reduced motion. */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Rises into place the first time it scrolls into view. */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Kept for callers; the page's GSAP choreography now times every entrance. */
  delay?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/** Marks a section for the landing page's scroll choreography (see LandingScroll). */
export function SectionReveal({ children }: { children: React.ReactNode }) {
  return <div data-section>{children}</div>;
}

/**
 * A word that changes every couple of seconds, sliding up out of the way.
 *
 * WHY EVERY WORD IS ALWAYS THERE
 *
 * The first version mounted the incoming word and unmounted the outgoing one, and
 * the swap re-measured the headline each time - the page visibly flickered on every
 * change. Now all the words sit stacked in one grid cell for the life of the page,
 * and only transform and opacity change: work the compositor does on its own, with
 * no layout and no repaint of anything around it.
 *
 * The cell is as wide as the widest word, so the line never reflows. A little room
 * is kept below the baseline so the clip does not shave off a descender.
 */
export function CyclingWord({ words, className }: { words: readonly string[]; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = setInterval(() => setIndex((current) => (current + 1) % words.length), 2200);

    return () => clearInterval(timer);
  }, [words.length]);

  const previous = (index - 1 + words.length) % words.length;

  return (
    <>
      <span
        className={`relative -mb-[0.14em] inline-grid overflow-hidden pb-[0.14em] align-bottom ${className ?? ""}`}
        aria-hidden="true"
      >
        {words.map((word, i) => (
          <span
            key={word}
            className="col-start-1 row-start-1 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{
              transform:
                i === index ? "translateY(0)" : i === previous ? "translateY(-105%)" : "translateY(105%)",
              opacity: i === index ? 1 : 0,
            }}
          >
            {word}
          </span>
        ))}
      </span>
      {/* Screen readers hear the sentence once, not a word changing every two seconds. */}
      <span className="sr-only">{words[0]}</span>
    </>
  );
}

/** Reveals a statement word by word as it scrolls into view. */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");

  return (
    <motion.p
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      aria-label={text}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0.12, y: 12 },
            shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
          }}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.p>
  );
}
