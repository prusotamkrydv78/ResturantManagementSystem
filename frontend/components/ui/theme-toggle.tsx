"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/use-theme";
import { cn } from "@/lib/utils/cn";

/**
 * The one theme switch, wherever it appears.
 *
 * A pill with a knob that slides between a sun and a moon. It used to be two
 * different controls - icons in a pill on the console, labelled segments in the
 * operational sidebar - that did the same thing and looked unrelated.
 *
 * A switch in the ARIA sense: two states, checked meaning dark, so a screen reader
 * announces it as the on/off control it is. The new theme spreads over the page in slow,
 * living patches when it is pressed (see useTheme).
 *
 * `compact` is the smaller size, for the operational sidebar folded to an icon rail.
 */
export function ThemeToggle({
  isCollapsed = false,
  className,
}: {
  /** Kept from the old control's API: the folded sidebar asks for the small size. */
  isCollapsed?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const compact = isCollapsed;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? "Switch to light" : "Switch to dark"}
      onClick={(event) => {
        // The takeover starts at the switch itself.
        const box = event.currentTarget.getBoundingClientRect();
        setTheme(dark ? "light" : "dark", { x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
      className={cn(
        "group relative inline-flex shrink-0 items-center rounded-full p-1 transition-colors duration-300",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        compact ? "h-7 w-12" : "h-8 w-16",
        dark
          ? "bg-ink ring-1 ring-white/10"
          : "bg-surface shadow-(--surface-shadow) ring-1 ring-border",
        className,
      )}
    >
      {/* The two ends, faint, so the pill says what it switches between. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
        <Sun className={cn("transition-opacity", compact ? "size-3" : "size-3.5", dark ? "text-surface opacity-50" : "opacity-0")} />
        <Moon className={cn("transition-opacity", compact ? "size-3" : "size-3.5", dark ? "opacity-0" : "text-muted opacity-60")} />
      </span>

      {/* The knob, carrying the current theme's icon, sliding to its end. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative flex items-center justify-center rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          compact ? "size-5" : "size-6",
          dark ? "bg-accent text-accent-fg" : "bg-ink text-surface",
          dark ? (compact ? "translate-x-5" : "translate-x-8") : "translate-x-0",
        )}
      >
        {dark ? (
          <Moon className={compact ? "size-3" : "size-3.5"} />
        ) : (
          <Sun className={compact ? "size-3" : "size-3.5"} />
        )}
      </span>
    </button>
  );
}

