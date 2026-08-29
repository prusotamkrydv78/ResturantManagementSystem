"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/**
 * A label that appears beside what it describes, with a cone pointing at it.
 *
 * Built here rather than pulled in, because the product needs one placement and a
 * tooltip library is mostly a collision engine for the placements it does not.
 *
 * Two things it does not do the naive way:
 *
 * Positioned fixed, from the trigger's measured rectangle, and rendered through a
 * portal. Both because its first caller is the collapsed sidebar, whose scroll
 * container clips horizontally - an absolutely positioned tooltip inside it would
 * be cut off at exactly the edge it needs to cross.
 *
 * Opened by focus as well as hover, and wired with aria-describedby, so the label
 * is not something only a mouse can reach. An icon rail with no text is precisely
 * where that matters.
 */

type Side = "right" | "top";

export function Tooltip({
  content,
  side = "right",
  className,
  children,
}: {
  /** The label. Kept short: this is a name, not documentation. */
  content: React.ReactNode;
  side?: Side;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  const show = useCallback(() => {
    // `display: contents` leaves the wrapper with no box of its own, so the
    // measurement has to come from the element it wraps.
    const target = anchorRef.current?.firstElementChild ?? anchorRef.current;

    if (target === null) {
      return;
    }

    const rect = target.getBoundingClientRect();

    setPosition(
      side === "right"
        ? { top: rect.top + rect.height / 2, left: rect.right + 10 }
        : { top: rect.top - 10, left: rect.left + rect.width / 2 },
    );
  }, [side]);

  const hide = useCallback(() => setPosition(null), []);

  // A tooltip is placed once, against coordinates that stop being true the moment
  // anything moves. Rather than track it, close it: the pointer is still on the
  // trigger and hovering again is free.
  useEffect(() => {
    if (position === null) {
      return;
    }

    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [position, hide]);

  const isOpen = position !== null;

  return (
    <span
      ref={anchorRef}
      // No box of its own, so wrapping a nav row does not change how the row lays
      // out inside its column.
      className="contents"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={isOpen ? id : undefined}
    >
      {children}

      {isOpen &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={{ top: position.top, left: position.left }}
            className={cn(
              "pointer-events-none fixed z-50 rounded-md border border-border bg-surface-3 px-2 py-1 text-xs font-medium whitespace-nowrap text-text shadow-md",
              side === "right"
                ? "-translate-y-1/2"
                : "-translate-x-1/2 -translate-y-full",
              className,
            )}
          >
            {content}

            {/* The cone: a square turned forty-five degrees, showing only the two
                sides that face the trigger. Those two carry the panel's own border,
                so the point reads as part of the panel rather than a shape parked
                against it. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute size-2 rotate-45 border-border bg-surface-3",
                side === "right"
                  ? "top-1/2 -left-1 -translate-y-1/2 border-b border-l"
                  : "-bottom-1 left-1/2 -translate-x-1/2 border-r border-b",
              )}
            />
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Labels a rail entry, and gets out of the way once the rail is open.
 *
 * Both sidebars fold to icons and both need the same thing, so the rule lives
 * here rather than twice: a tooltip is what replaces a label that has been taken
 * away, not a second copy of one still on screen.
 */
export function RailLabel({
  label,
  isCollapsed,
  children,
}: {
  label: React.ReactNode;
  isCollapsed: boolean;
  children: React.ReactNode;
}) {
  return isCollapsed ? <Tooltip content={label}>{children}</Tooltip> : <>{children}</>;
}
