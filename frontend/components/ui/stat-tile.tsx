import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * One headline figure, on a tile.
 *
 * The platform console's single way of showing a number that matters: an icon in a
 * tinted chip, the label, the figure, and a line saying what it means. Each tile
 * carries its own colour so a row of four reads as four different things at a glance
 * rather than four copies of the same grey box - the colour is for telling them
 * apart, never for good or bad, which is what the footnote and the delta are for.
 *
 * "featured" is the lime tile: the one figure on a screen that is looked for first.
 */
export type StatTone = "indigo" | "lime" | "peach" | "sky" | "rose" | "teal";

const TONE_VAR: Record<StatTone, string> = {
  indigo: "var(--chart-1)",
  lime: "var(--chart-2)",
  peach: "var(--chart-3)",
  sky: "var(--chart-4)",
  rose: "var(--chart-5)",
  teal: "var(--chart-6)",
};

export function StatTile({
  icon: Icon,
  label,
  value,
  footnote,
  delta,
  tone = "indigo",
  featured = false,
  href,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
  /** A movement against the period before, drawn beside the figure. */
  delta?: React.ReactNode;
  tone?: StatTone;
  featured?: boolean;
  /** When set, the whole tile is the way to where the figure is acted on. */
  href?: string;
  className?: string;
}) {
  const colour = TONE_VAR[tone];

  const body = (
    <>
      {featured && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/30"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-14 size-28 rounded-full bg-white/20"
          />
        </>
      )}

      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            featured && "bg-accent-fg text-accent",
          )}
          style={
            featured
              ? undefined
              : {
                  background: `color-mix(in srgb, ${colour} 16%, transparent)`,
                  color: colour,
                }
          }
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium",
            featured ? "text-accent-fg" : "text-muted",
          )}
        >
          {label}
        </span>
        {href !== undefined && (
          <ArrowUpRight
            className={cn(
              "size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
              featured ? "text-accent-fg" : "text-subtle group-hover:text-text",
            )}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "tabular text-[1.625rem] leading-none font-semibold tracking-tight",
            featured ? "text-accent-fg" : "text-text",
          )}
        >
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5",
              featured ? "bg-white/60" : "bg-surface-2",
            )}
          >
            {delta}
          </span>
        )}
      </div>

      {footnote !== undefined && (
        <p
          className={cn(
            "relative mt-1.5 text-xs",
            featured ? "text-accent-fg/75" : "text-muted",
          )}
        >
          {footnote}
        </p>
      )}
    </>
  );

  const shell = cn(
    "relative flex flex-col overflow-hidden rounded-2xl px-4 py-3",
    featured
      ? "bg-accent"
      : "ui-surface border border-border bg-surface",
    href !== undefined && "group transition-colors",
    href !== undefined && !featured && "hover:border-border-strong/40",
    className,
  );

  return href === undefined ? (
    <div className={shell}>{body}</div>
  ) : (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}
