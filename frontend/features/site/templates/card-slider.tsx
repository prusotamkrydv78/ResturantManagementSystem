"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A row of cards that scrolls sideways instead of wrapping.
 *
 * Cards in a grid are the thing that breaks first on a narrow screen: three
 * across becomes one down, and a section that read as a considered row becomes a
 * column half a page long that the visitor has to scroll past to reach anything
 * else. A rail keeps the section the height of one card at every width, and
 * sideways is the gesture a phone already expects.
 *
 * Built on scroll snapping rather than on a transform and an index. The browser
 * then owns the physics — momentum, rubber-banding, the trackpad, shift-scroll,
 * and dragging the bar — and every one of those is something a hand-rolled
 * carousel has to reimplement badly. The arrows only nudge the same scroll
 * container the finger does.
 */
export function CardSlider({
  ariaLabel,
  /** Card width per breakpoint. Basis rather than a count, so a card keeps its shape. */
  itemClassName = "basis-[80%] sm:basis-[46%] lg:basis-[31%]",
  className,
  children,
}: {
  ariaLabel: string;
  itemClassName?: string;
  className?: string;
  children: React.ReactNode[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const rail = railRef.current;

    if (rail === null) {
      return;
    }

    // A pixel of slack: sub-pixel layout means scrollLeft rarely lands exactly on
    // the maximum, and without it the end arrow never switches off.
    const max = rail.scrollWidth - rail.clientWidth;

    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;

    if (rail === null) {
      return;
    }

    measure();

    rail.addEventListener("scroll", measure, { passive: true });

    // Also on resize: how many cards fit changes with the pane, and in the editor
    // preview that happens when the device buttons are pressed.
    const observer = new ResizeObserver(measure);
    observer.observe(rail);

    return () => {
      rail.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, children.length]);

  function nudge(direction: -1 | 1) {
    const rail = railRef.current;

    if (rail === null) {
      return;
    }

    // Most of a screenful rather than all of it, so a card stays half in view and
    // the reader can see the row moved rather than being teleported.
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: "smooth" });
  }

  // One card does not slide. Hiding the arrows is the honest thing to do, and it
  // keeps a section with a single photograph from looking broken.
  const isScrollable = !atStart || !atEnd;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={railRef}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2",
          // The bar is removed because the arrows and the cut-off card already say
          // there is more; keyboard focus is why the container is tabbable.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]",
        )}
      >
        {children.map((child, index) => (
          <div key={index} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </div>
        ))}
      </div>

      {isScrollable && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <SliderButton
            label={`Previous ${ariaLabel}`}
            disabled={atStart}
            onClick={() => nudge(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </SliderButton>
          <SliderButton
            label={`Next ${ariaLabel}`}
            disabled={atEnd}
            onClick={() => nudge(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </SliderButton>
        </div>
      )}
    </div>
  );
}

/**
 * One arrow.
 *
 * Disabled rather than hidden at the ends, so the pair does not shift sideways as
 * the rail moves — a control that moves while you are aiming at it is worse than
 * a control that is briefly dim.
 */
function SliderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full border border-current/25 text-current transition-opacity hover:opacity-100 disabled:opacity-25"
    >
      {children}
    </button>
  );
}
