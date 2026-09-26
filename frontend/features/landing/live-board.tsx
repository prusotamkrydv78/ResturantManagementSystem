"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChefHat, CircleCheck, QrCode, ReceiptText, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * A service playing out, in miniature: the hero's live board.
 *
 * What it shows is what the product does - an order sent, a ticket ready at the
 * pass, a guest ordering by QR, a table paying and the day's takings moving with it.
 * The figures are a script, not data, and the whole thing is labelled as an
 * illustration so nobody hears invented numbers read out as live ones.
 *
 * Under reduced motion it draws the first frame and stays there.
 */

interface BoardEvent {
  icon: LucideIcon;
  title: string;
  meta: string;
  tone: "indigo" | "peach" | "lime" | "sky";
  /** Money this event brings in, when a table pays. */
  takes?: number;
}

const SCRIPT: BoardEvent[] = [
  { icon: Send, title: "Table 6 sent to the kitchen", meta: "3 items · ticket #42", tone: "indigo" },
  { icon: QrCode, title: "Guest order at Table 9", meta: "Ordered by QR · 2 items", tone: "sky" },
  { icon: ChefHat, title: "Ticket #41 ready at the pass", meta: "Chicken momo, dal bhat", tone: "peach" },
  { icon: ReceiptText, title: "Table 2 paid", meta: "Card · NPR 1,240", tone: "lime", takes: 1240 },
  { icon: Send, title: "Table 4 sent to the kitchen", meta: "5 items · ticket #43", tone: "indigo" },
  { icon: CircleCheck, title: "Table 6 served", meta: "Ticket #42 left the pass", tone: "peach" },
  { icon: ReceiptText, title: "Table 9 paid", meta: "Digital wallet · NPR 780", tone: "lime", takes: 780 },
  { icon: QrCode, title: "Guest order at Table 3", meta: "Ordered by QR · 4 items", tone: "sky" },
];

const TONE: Record<BoardEvent["tone"], string> = {
  indigo: "var(--chart-1)",
  peach: "var(--chart-3)",
  lime: "var(--chart-2)",
  sky: "var(--chart-4)",
};

/** Hours of the day drawn in the little chart, and how busy each was. */
const HOURS = [18, 26, 22, 40, 58, 46, 30, 52, 74, 88, 64];

const VISIBLE = 4;

/** One row's height, and the gap between rows, in pixels. Fixed so the feed is too. */
const ROW = 56;
const GAP = 6;
const STEP = ROW + GAP;

export function LiveBoard() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = setInterval(() => setTick((current) => current + 1), 2400);

    return () => clearInterval(timer);
  }, []);

  // The newest event first, plus one more on its way out. Each is keyed by where it
  // falls in the endless script, so the same row keeps its element as it moves down
  // and only the newcomer mounts. The extra one sits below the visible four, fading,
  // inside the clipped area - so it never makes the feed taller.
  const feed = Array.from({ length: VISIBLE + 1 }, (_, position) => {
    const at = tick - position;
    const index = ((at % SCRIPT.length) + SCRIPT.length) % SCRIPT.length;

    return { key: at, position, event: SCRIPT[index]! };
  });

  // Takings climb as tables pay; a whole pass of the script is one busy evening.
  const paidSoFar = Array.from({ length: tick + 1 }, (_, i) => SCRIPT[i % SCRIPT.length]!.takes ?? 0)
    .reduce((sum, amount) => sum + amount, 0);
  const takings = 46_180 + paidSoFar;

  const litHours = Math.min(HOURS.length, 7 + (tick % 5));

  return (
    <div
      role="img"
      aria-label="An illustration of the live board: today's takings rising as tables pay, a chart of the day by hour, and a feed of orders being sent, cooked, served and paid."
      className="relative"
    >
      <div className="grid grid-cols-5 gap-3">
        {/* Takings, in lime. */}
        <div className="relative col-span-3 overflow-hidden rounded-2xl bg-accent p-4 text-accent-fg">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-white/30"
          />
          <p className="relative text-xs font-semibold">Taken today</p>
          <p className="tabular relative mt-3 text-[2rem] leading-none font-semibold tracking-tight">
            <motion.span
              key={takings}
              initial={{ opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {takings.toLocaleString("en-US")}
            </motion.span>
          </p>
          <p className="relative mt-2 text-2xs font-semibold opacity-75">NPR · past yesterday</p>
        </div>

        {/* The day by hour. */}
        <div className="col-span-2 flex flex-col rounded-2xl bg-contrast-raised p-4">
          <p className="text-2xs font-medium text-contrast-muted">Today, by hour</p>
          <div className="mt-auto flex h-16 items-end gap-1 pt-3 [contain:layout]">
            {HOURS.map((height, index) => (
              <motion.span
                key={index}
                className="flex-1 rounded-sm"
                style={{ background: index < litHours ? "var(--chart-1)" : "var(--contrast)" }}
                initial={{ height: 4 }}
                animate={{ height: index < litHours ? `${height}%` : "10%" }}
                transition={{ duration: 0.6, delay: index * 0.03 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* The feed. */}
      <div className="mt-3 overflow-hidden rounded-2xl bg-surface p-2 text-text shadow-lg">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="text-sm font-semibold">Live service</span>
          <span className="flex items-center gap-1.5 text-2xs font-semibold text-success">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>

        {/* A fixed-height window onto the feed.
            The first version let AnimatePresence hold the leaving row while the new
            one arrived, so for a moment the list had five rows: the card grew, the
            hero grew with it, and the whole page below jumped on every event. Now the
            rows are absolutely placed and only their transform moves, the window never
            changes size, and layout containment keeps whatever happens in here from
            reaching the page at all. */}
        <ul
          className="relative overflow-hidden [contain:layout]"
          style={{ height: VISIBLE * ROW + (VISIBLE - 1) * GAP }}
        >
          {feed.map(({ key, position, event }) => {
            const Icon = event.icon;
            const colour = TONE[event.tone];
            const leaving = position >= VISIBLE;

            return (
              <motion.li
                key={key}
                initial={{ y: -STEP, opacity: 0 }}
                animate={{ y: position * STEP, opacity: leaving ? 0 : 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 top-0 flex items-center gap-3 rounded-xl bg-surface-2 px-3"
                style={{ height: ROW }}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${colour} 18%, transparent)`, color: colour }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{event.title}</span>
                  <span className="truncate text-2xs text-muted">{event.meta}</span>
                </span>
                <span className="shrink-0 text-2xs text-subtle">now</span>
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* Chips drifting at the edges: small facts, for depth. */}
      <span className="drift pointer-events-none absolute -top-4 -left-6 hidden items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-lg sm:flex">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-3)" }} />
        3 plates at the pass
      </span>
      <span
        className="drift pointer-events-none absolute -right-4 -bottom-4 hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-lg sm:flex"
        style={{ animationDelay: "1.6s" }}
      >
        <CircleCheck className="size-3.5" aria-hidden="true" />
        Table freed
      </span>
    </div>
  );
}
