"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChartNoAxesColumn, ChefHat, ClipboardList, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Everybody signs in to their own job - shown by letting a visitor be each of them.
 *
 * Four tabs, and the panel beside them is what that person's screen holds. A tab
 * list rather than four static cards because the point is the difference between
 * them: the same product, a different room depending on who walked in.
 */

interface Role {
  key: string;
  icon: LucideIcon;
  name: string;
  line: string;
  sees: string[];
  screen: { label: string; value: string; accent?: boolean }[];
}

const ROLES: Role[] = [
  {
    key: "manager",
    icon: ChartNoAxesColumn,
    name: "Manager",
    line: "Owns exactly one restaurant, end to end.",
    sees: ["Menu, tables, staff and settings", "Stock, customers and bookings", "Billing, receipts and reports", "The restaurant's own website"],
    screen: [
      { label: "Taken today", value: "NPR 48,260", accent: true },
      { label: "Open orders", value: "7" },
      { label: "At the pass", value: "3 plates" },
      { label: "Bookings tonight", value: "12" },
    ],
  },
  {
    key: "waiter",
    icon: ClipboardList,
    name: "Waiter",
    line: "On the floor for a shift.",
    sees: ["The room, and who is sitting where", "Open, edit and send orders", "Food ready at the pass", "Take payment at the table"],
    screen: [
      { label: "My tables", value: "5 occupied", accent: true },
      { label: "Ready to serve", value: "Table 6" },
      { label: "Bill asked for", value: "Table 2" },
      { label: "Guest order to agree", value: "Table 9" },
    ],
  },
  {
    key: "chef",
    icon: ChefHat,
    name: "Chef",
    line: "At the pass, and nowhere else.",
    sees: ["The live ticket rail", "Start tickets and tick off dishes", "Call a plate back", "Nothing about money"],
    screen: [
      { label: "On the stove", value: "#43 · Table 4", accent: true },
      { label: "Waiting", value: "#44 · Table 9" },
      { label: "Waiting", value: "#45 · Table 1" },
      { label: "Ready", value: "#42 · Table 6" },
    ],
  },
  {
    key: "admin",
    icon: Store,
    name: "Platform admin",
    line: "Runs the platform, not a restaurant.",
    sees: ["Create restaurants", "Issue and assign managers", "Watch the whole estate live", "Reports across every restaurant"],
    screen: [
      { label: "Estate taken today", value: "NPR 312,400", accent: true },
      { label: "Restaurants trading", value: "11 of 12" },
      { label: "Need a manager", value: "1" },
      { label: "Busiest", value: "JanakHotel" },
    ],
  },
];

export function RoleSwitcher() {
  const [active, setActive] = useState(0);
  const role = ROLES[active]!;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div role="tablist" aria-label="Roles" className="flex gap-2 overflow-x-auto lg:flex-col">
        {ROLES.map((item, index) => {
          const Icon = item.icon;
          const selected = index === active;

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`role-panel-${item.key}`}
              onClick={() => setActive(index)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                selected ? "bg-surface text-text shadow-lg" : "text-panel-fg hover:bg-surface/50",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl",
                  selected ? "bg-accent text-accent-fg" : "bg-surface/60",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{item.name}</span>
                <span className={cn("hidden text-xs lg:block", selected ? "text-muted" : "opacity-70")}>
                  {item.line}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`role-panel-${role.key}`}
        role="tabpanel"
        aria-label={role.name}
        className="relative min-h-72 overflow-hidden rounded-3xl bg-surface p-5 text-text shadow-lg"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={role.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="flex flex-col gap-3">
              <p className="font-mono text-2xs font-medium tracking-[0.14em] text-primary uppercase">
                What a {role.name.toLowerCase()} sees
              </p>
              <h3 className="text-2xl font-semibold tracking-tight">{role.line}</h3>
              <ul className="flex flex-col gap-2">
                {role.sees.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              role="img"
              aria-label={`An illustration of the ${role.name.toLowerCase()}'s screen.`}
              className="grid grid-cols-2 gap-2 self-center"
            >
              {role.screen.map((tile, index) => (
                <motion.div
                  key={`${tile.label}-${index}`}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.07 }}
                  className={cn(
                    "flex flex-col gap-1 rounded-2xl p-3",
                    tile.accent ? "col-span-2 bg-accent text-accent-fg" : "bg-surface-2",
                  )}
                >
                  <span className={cn("text-2xs", tile.accent ? "font-semibold" : "text-muted")}>
                    {tile.label}
                  </span>
                  <span className={cn("font-semibold tracking-tight", tile.accent ? "text-2xl" : "text-base")}>
                    {tile.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
