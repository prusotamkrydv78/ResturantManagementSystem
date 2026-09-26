"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChefHat, CircleCheck, ClipboardList, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * One order, from the table to the till, told as it happens.
 *
 * Four stages that play in turn, each with the screen that stage lives on. It
 * advances on its own so a visitor who only scrolls still sees the whole journey,
 * and choosing a stage stops the clock so somebody reading is never pulled away
 * mid-sentence. Reduced motion shows the first stage and leaves the choosing to them.
 */

interface Stage {
  icon: LucideIcon;
  title: string;
  body: string;
}

const STAGES: Stage[] = [
  {
    icon: ClipboardList,
    title: "Opened at the table",
    body: "Pick a table, add dishes.",
  },
  {
    icon: ChefHat,
    title: "Sent to the kitchen",
    body: "It lands on the kitchen screen instantly.",
  },
  {
    icon: CircleCheck,
    title: "Ready at the pass",
    body: "The floor sees when food is up.",
  },
  {
    icon: ReceiptText,
    title: "Paid and closed",
    body: "The bill adds up. The table frees itself.",
  },
];

const STAGE_MS = 4200;

export function OrderJourney() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = setTimeout(() => setActive((current) => (current + 1) % STAGES.length), STAGE_MS);

    return () => clearTimeout(timer);
  }, [active, paused]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6">
      <ol className="flex flex-col gap-2">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = index === active;

          return (
            <li key={stage.title}>
              <button
                type="button"
                onClick={() => {
                  setActive(index);
                  setPaused(true);
                }}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-colors",
                  isActive
                    ? "border-transparent bg-contrast text-contrast-fg"
                    : "border-border bg-surface text-text hover:border-border-strong/40",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold",
                      isActive ? "bg-accent text-accent-fg" : "bg-panel text-panel-fg",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-base font-semibold tracking-tight">{stage.title}</span>
                  <span
                    className={cn(
                      "ml-auto font-mono text-2xs",
                      isActive ? "text-contrast-muted" : "text-subtle",
                    )}
                  >
                    0{index + 1}
                  </span>
                </span>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.p
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="overflow-hidden pl-12 text-sm text-contrast-muted"
                    >
                      <span className="block pt-2">{stage.body}</span>
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* The clock for this stage, drawn along the bottom while it plays. */}
                {isActive && !paused && (
                  <motion.span
                    key={`progress-${active}`}
                    className="absolute bottom-0 left-0 h-1 bg-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: STAGE_MS / 1000, ease: "linear" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-3xl bg-panel p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm"
          >
            {active === 0 && <OpenedScreen />}
            {active === 1 && <KitchenScreen />}
            {active === 2 && <PassScreen />}
            {active === 3 && <PaidScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the screens -- */

function Card({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="rounded-2xl bg-surface p-4 text-text shadow-lg">
      {children}
    </div>
  );
}

function OpenedScreen() {
  const lines = [
    { name: "Chicken momo", qty: 2, price: 440 },
    { name: "Dal bhat tarkari", qty: 1, price: 350 },
    { name: "Masala tea", qty: 2, price: 120 },
  ];

  return (
    <Card label="A waiter's order for Table 6: three dishes with quantities and prices.">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Table 6</span>
        <span className="rounded-full bg-panel px-2 py-0.5 text-2xs font-medium text-panel-fg">Order #118</span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lines.map((line, index) => (
          <motion.li
            key={line.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.18 }}
            className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-2xs font-bold text-accent-fg">
              {line.qty}
            </span>
            <span className="flex-1 text-sm">{line.name}</span>
            <span className="tabular text-sm font-medium">{line.price}</span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="tabular font-semibold">NPR 910</span>
      </div>
    </Card>
  );
}

function KitchenScreen() {
  return (
    <Card label="The kitchen rail: ticket 42 for Table 6 arriving and moving from waiting to on the stove.">
      <p className="text-sm font-semibold">Kitchen rail</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="rounded-xl border-l-4 bg-surface-2 p-3"
          style={{ borderColor: "var(--chart-3)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold">#42</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="rounded-full px-1.5 py-0.5 text-2xs font-medium"
              style={{ background: "color-mix(in srgb, var(--chart-3) 18%, transparent)", color: "var(--chart-3)" }}
            >
              On the stove
            </motion.span>
          </div>
          <p className="mt-1 text-2xs text-muted">Table 6</p>
          <ul className="mt-2 text-xs">
            <li>2 × Chicken momo</li>
            <li>1 × Dal bhat</li>
          </ul>
        </motion.div>
        <div className="rounded-xl bg-surface-2 p-3 opacity-60">
          <span className="font-mono text-xs font-semibold">#41</span>
          <p className="mt-1 text-2xs text-muted">Table 2</p>
          <ul className="mt-2 text-xs">
            <li>1 × Paneer tikka</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function PassScreen() {
  return (
    <Card label="The pass: ticket 42's dishes ticked off one by one until it is fully ready.">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Ticket #42 · Table 6</span>
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 300, damping: 16 }}
          className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-accent-fg"
        >
          Ready
        </motion.span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {["2 × Chicken momo", "1 × Dal bhat tarkari", "2 × Masala tea"].map((dish, index) => (
          <li key={dish} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.25 + index * 0.3, type: "spring", stiffness: 320, damping: 18 }}
              className="flex size-5 items-center justify-center rounded-full bg-success text-surface"
            >
              <CircleCheck className="size-3.5" aria-hidden="true" />
            </motion.span>
            {dish}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PaidScreen() {
  return (
    <Card label="A receipt for Table 6: subtotal, service charge, VAT and total, paid by card, and the table freed.">
      <div className="text-center">
        <p className="text-sm font-semibold">JanakHotel</p>
        <p className="text-2xs text-muted">Receipt · Order #118 · Table 6</p>
      </div>
      <dl className="mt-3 flex flex-col gap-1 border-y border-dashed border-border py-3 text-sm">
        {[
          ["Subtotal", "910.00"],
          ["Service charge 10%", "91.00"],
          ["VAT 13%", "130.13"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Total</span>
        <span className="tabular text-2xl font-semibold tracking-tight">NPR 1,131.13</span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-accent py-2 text-sm font-semibold text-accent-fg"
      >
        <CircleCheck className="size-4" aria-hidden="true" />
        Paid by card · Table 6 is free
      </motion.div>
    </Card>
  );
}
