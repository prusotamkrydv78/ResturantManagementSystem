"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme/use-theme";
import { THEMES, THEME_LABELS, type ThemePreference } from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

/**
 * The theme switcher.
 *
 * Three explicit choices rather than one dark-mode switch, because "follow the
 * system" is a real answer and a two-state toggle cannot express it: flipping such a
 * switch to the value the system already had silently pins it, and the screen then
 * stops following the machine at dusk with no way to ask for that back.
 *
 * Named per theme rather than derived, so a fourth palette added to `THEMES` appears
 * here as soon as it is given an icon below.
 */

const ICONS: Record<ThemePreference, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (isCollapsed) {
    // One button that cycles, because a rail this narrow has room for one icon
    // and not for three. The icon is the current choice, so pressing it repeatedly
    // walks the list and comes back round.
    const index = THEMES.indexOf(theme);
    const next = THEMES[(index + 1) % THEMES.length] ?? "system";
    const Icon = ICONS[theme];

    return (
      <Tooltip content={`Theme: ${THEME_LABELS[theme]}`}>
        <button
          type="button"
          onClick={() => setTheme(next)}
          aria-label={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[next]}.`}
          className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      </Tooltip>
    );
  }

  return (
    // A radio group rather than a row of buttons: exactly one is chosen at a time,
    // and that is what makes the arrow keys work without any handler of ours.
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex gap-0.5 rounded-md border border-border bg-surface-2 p-0.5"
    >
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const isActive = option === theme;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(option)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors",
              isActive
                ? "bg-surface text-text shadow-sm"
                : "text-subtle hover:text-text",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {THEME_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
