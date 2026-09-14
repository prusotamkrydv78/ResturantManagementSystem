"use client";

import { cn } from "@/lib/utils/cn";

/**
 * One bucket, as a control that also shows its size.
 *
 * Shared by the restaurants and managers lists, which ask the same question about
 * different things: how many are fine, how many are unstaffed, how many are switched
 * off. It is a chip rather than a dropdown because on both screens those counts are
 * the news, and a dropdown hides them behind a click.
 *
 * The count is tinted by what it means rather than by its size — an unstaffed
 * restaurant is amber at one as well as at forty — and goes grey at zero, so an empty
 * bucket recedes instead of shouting a colour about nothing.
 */
export function FilterChip({
  active,
  count,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  tone: ChipTone;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary-border bg-primary-soft text-primary"
          : "border-border text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
      <span
        className={cn(
          "tabular text-2xs",
          active ? "text-primary" : count === 0 ? "text-subtle" : CHIP_COUNTS[tone],
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** How loudly a bucket's count reads when it is not the one selected. */
export type ChipTone = "neutral" | "warning" | "danger";

const CHIP_COUNTS: Record<ChipTone, string> = {
  neutral: "text-subtle",
  warning: "text-warning",
  danger: "text-danger",
};
