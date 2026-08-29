"use client";

import { useCallback, useId } from "react";
import { ChevronDown } from "lucide-react";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import { cn } from "@/lib/utils/cn";

/**
 * A titled group of navigation links that folds away.
 *
 * Shared by the main sidebar and the settings rail, which both group their links
 * under headings and both want the same behaviour from them. One copy, so the two
 * cannot drift into folding differently.
 *
 * Folding is a real button with the heading as its label, rather than a click
 * handler hung on the heading itself, so it is reachable by keyboard and
 * announces whether it is open.
 */
export function NavSection({
  label,
  /** Heading level. The sidebar nests under the page, the settings rail does not. */
  as: Heading = "h3",
  isOpen,
  onToggle,
  indentClassName = "px-2",
  className,
  children,
}: {
  label: string;
  as?: "h2" | "h3";
  isOpen: boolean;
  onToggle: () => void;
  /**
   * Horizontal padding, matched to the links below it. The two rails indent by
   * different amounts, and a heading that does not line up with its own list
   * reads as a mistake.
   */
  indentClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panelId = useId();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Heading>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md py-1 text-2xs font-semibold tracking-wider text-subtle uppercase transition-colors hover:bg-surface-3 hover:text-muted",
            indentClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3 shrink-0 transition-transform duration-200",
              !isOpen && "-rotate-90",
            )}
          />
        </button>
      </Heading>

      {/* Unmounted rather than hidden: a folded section should not be a set of
          tab stops a keyboard user has to walk through to reach the next one. */}
      {isOpen && (
        <div id={panelId} className="flex flex-col gap-1">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Remembers which sections of one navigation are folded.
 *
 * Keyed by heading text rather than by index, so reordering the navigation does
 * not silently fold a different section than the one somebody closed.
 */
export function useClosedSections(
  storageKey: string,
): [(label: string) => boolean, (label: string) => void] {
  const [closed, setClosed] = useStoredPreference(storageKey, NOTHING_CLOSED);

  const isClosed = useCallback(
    (label: string) => closed.includes(label),
    [closed],
  );

  const toggle = useCallback(
    (label: string) => {
      setClosed(
        closed.includes(label)
          ? closed.filter((entry) => entry !== label)
          : [...closed, label],
      );
    },
    [closed, setClosed],
  );

  return [isClosed, toggle];
}

/** Hoisted so the server snapshot is one stable reference, not a new array a render. */
const NOTHING_CLOSED: string[] = [];
