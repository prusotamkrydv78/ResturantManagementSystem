"use client";

import { useState } from "react";
import { Check, Minus, Plus, QrCode } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The gallery's screens, and they work: a visitor can seat a table and send its
 * order, move tickets along the rail, fill a basket on the guest's phone, switch
 * the manager's view and browse the website's menu. Small, local and made up -
 * nothing here talks to a server - but touching the product beats being told
 * about it.
 */

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-canvas text-text">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-2">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="ml-2 text-2xs font-medium text-muted">{label}</span>
        <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[0.6rem] font-semibold text-accent-fg">Try it</span>
      </div>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- waiter --- */

const DISHES = ["Chicken momo", "Dal bhat", "Masala tea", "Paneer tikka"];

export function WaiterScreen() {
  const [busy, setBusy] = useState<Set<number>>(() => new Set([2, 4, 7]));
  const [table, setTable] = useState(6);
  const [lines, setLines] = useState<string[]>(["Chicken momo"]);
  const [sent, setSent] = useState(false);

  const pick = (next: number) => {
    setTable(next);
    setLines([]);
    setSent(false);
  };

  const send = () => {
    if (lines.length === 0) {
      return;
    }
    setBusy((current) => new Set(current).add(table));
    setSent(true);
  };

  return (
    <Frame label="Floor · Tables">
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-3">
        <div className="grid grid-cols-4 content-start gap-2">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => pick(number)}
              aria-pressed={table === number}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl text-xs font-semibold transition-all hover:scale-105",
                table === number
                  ? "bg-accent text-accent-fg ring-2 ring-text"
                  : busy.has(number)
                    ? "bg-panel text-panel-fg"
                    : "bg-surface",
              )}
            >
              T{number}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-1.5 rounded-xl bg-surface p-2.5">
          <span className="text-xs font-semibold">Table {table}</span>
          <div className="flex flex-wrap gap-1">
            {DISHES.map((dish) => (
              <button
                key={dish}
                type="button"
                onClick={() => {
                  setLines((current) => [...current, dish].slice(-4));
                  setSent(false);
                }}
                className="rounded-md bg-surface-2 px-1.5 py-1 text-[0.6rem] font-medium transition-colors hover:bg-accent hover:text-accent-fg"
              >
                + {dish}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className="rise rounded-md bg-surface-2 px-2 py-1 text-2xs">
                1 × {line}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={send}
            className={cn(
              "flex items-center justify-center gap-1 rounded-lg py-1.5 text-2xs font-semibold transition-colors",
              sent ? "bg-success text-surface" : "bg-contrast text-contrast-fg hover:bg-text",
            )}
          >
            {sent ? (
              <>
                <Check className="size-3" /> Sent to kitchen
              </>
            ) : (
              "Send to kitchen"
            )}
          </button>
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------- kitchen --- */

const STATES = ["Waiting", "Cooking", "Ready"] as const;
const STATE_TONE = ["var(--text-subtle)", "var(--chart-3)", "var(--chart-2)"];

export function KitchenScreen() {
  const [tickets, setTickets] = useState([
    { id: 43, table: "Table 4", state: 0, lines: ["1 × Mutton curry", "2 × Naan"] },
    { id: 42, table: "Table 6", state: 1, lines: ["2 × Chicken momo", "1 × Dal bhat"] },
    { id: 41, table: "Table 2", state: 2, lines: ["1 × Paneer tikka", "2 × Lassi"] },
  ]);
  const [next, setNext] = useState(44);

  // Tap a ticket to move it along; a ready one is served and a new order arrives.
  const advance = (id: number) => {
    const ticket = tickets.find((candidate) => candidate.id === id);

    if (!ticket) {
      return;
    }

    if (ticket.state < 2) {
      setTickets(tickets.map((candidate) => (candidate.id === id ? { ...candidate, state: candidate.state + 1 } : candidate)));
      return;
    }

    setTickets([
      { id: next, table: `Table ${(next % 8) + 1}`, state: 0, lines: ["2 × Veg momo", "1 × Kheer"] },
      ...tickets.filter((candidate) => candidate.id !== id),
    ]);
    setNext(next + 1);
  };

  return (
    <Frame label="Kitchen · Rail · tap a ticket">
      <div className="grid h-full grid-cols-3 gap-2">
        {STATES.map((state, lane) => (
          <div key={state} className="flex min-h-0 flex-col gap-1.5 rounded-xl bg-surface-2 p-1.5">
            <span className="text-[0.6rem] font-semibold" style={{ color: STATE_TONE[lane] }}>
              {state}
            </span>
            {tickets
              .filter((ticket) => ticket.state === lane)
              .map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => advance(ticket.id)}
                  className="rise flex flex-col gap-1 rounded-lg border-t-4 bg-surface p-1.5 text-left transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: STATE_TONE[lane] }}
                >
                  <span className="text-xs font-bold">#{ticket.id}</span>
                  <span className="text-[0.6rem] text-muted">{ticket.table}</span>
                  {ticket.lines.map((line) => (
                    <span key={line} className="text-[0.6rem]">
                      {line}
                    </span>
                  ))}
                  <span className="mt-0.5 text-[0.55rem] font-semibold text-primary">
                    {lane === 2 ? "Serve →" : "Next →"}
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------- guest --- */

const MENU = [
  { name: "Chicken momo", price: 220 },
  { name: "Dal bhat", price: 350 },
  { name: "Masala tea", price: 60 },
];

export function GuestScreen() {
  const [basket, setBasket] = useState<number[]>([1, 0, 0]);
  const [placed, setPlaced] = useState(false);
  const total = MENU.reduce((sum, item, index) => sum + item.price * basket[index]!, 0);
  const count = basket.reduce((sum, quantity) => sum + quantity, 0);

  const change = (index: number, by: number) => {
    setBasket((current) => current.map((quantity, i) => (i === index ? Math.max(0, quantity + by) : quantity)));
    setPlaced(false);
  };

  return (
    <div className="flex h-full items-center justify-center gap-6 rounded-2xl bg-panel">
      <div className="h-[94%] w-[40%] min-w-40 rounded-[1.4rem] bg-contrast p-1.5 shadow-2xl">
        <div className="flex h-full flex-col overflow-hidden rounded-[1.1rem] bg-canvas text-text">
          <div className="bg-surface px-2.5 py-2">
            <p className="font-mono text-[0.55rem] text-subtle uppercase">Table 7</p>
            <p className="text-xs font-semibold">Menu</p>
          </div>
          <div className="flex flex-1 flex-col gap-1 p-1.5">
            {MENU.map((item, index) => (
              <span key={item.name} className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1.5 text-[0.6rem] font-medium">
                <span className="flex-1 truncate">{item.name}</span>
                <button type="button" aria-label={`One less ${item.name}`} onClick={() => change(index, -1)} className="flex size-4 items-center justify-center rounded bg-surface-2">
                  <Minus className="size-2.5" />
                </button>
                <span className="tabular w-3 text-center">{basket[index]}</span>
                <button type="button" aria-label={`One more ${item.name}`} onClick={() => change(index, 1)} className="flex size-4 items-center justify-center rounded bg-accent text-accent-fg">
                  <Plus className="size-2.5" />
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={count === 0}
              onClick={() => setPlaced(true)}
              className={cn(
                "mt-auto flex items-center justify-between rounded-lg px-2 py-1.5 text-[0.6rem] font-semibold transition-colors disabled:opacity-40",
                placed ? "bg-success text-surface" : "bg-contrast text-contrast-fg",
              )}
            >
              <span>{placed ? "Sent to your waiter ✓" : `Place order · ${count}`}</span>
              <span className="tabular">NPR {total}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="hidden max-w-40 flex-col gap-2 text-panel-fg sm:flex">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-surface text-text">
          <QrCode className="size-9" />
        </span>
        <span className="text-sm font-semibold">Scan. Order. Done.</span>
        <span className="text-xs opacity-75">Try the phone - add a few dishes.</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- manager --- */

const VIEWS = {
  Today: { tiles: ["48,200", "126", "9 / 14"], bars: [30, 45, 38, 60, 82, 70, 52, 90, 76], labels: ["12", "13", "14", "15", "16", "17", "18", "19", "20"] },
  Week: { tiles: ["3,12,400", "812", "avg 11"], bars: [55, 62, 48, 70, 95, 88, 74], labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
};

export function ManagerScreen() {
  const [view, setView] = useState<keyof typeof VIEWS>("Today");
  const [hover, setHover] = useState<number | null>(null);
  const data = VIEWS[view];

  return (
    <Frame label="Manager · Reports">
      <div className="flex h-full flex-col gap-2">
        <div className="flex gap-1">
          {(Object.keys(VIEWS) as Array<keyof typeof VIEWS>).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setView(name)}
              aria-pressed={view === name}
              className={cn(
                "rounded-md px-2 py-1 text-[0.6rem] font-semibold transition-colors",
                view === name ? "bg-contrast text-contrast-fg" : "bg-surface hover:bg-surface-2",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["Taken", "Orders", "Tables"].map((label, index) => (
            <div key={label} className={cn("rounded-xl p-2", index === 0 ? "bg-accent text-accent-fg" : "bg-surface")}>
              <p className="text-2xs opacity-75">{label}</p>
              <p className="tabular text-sm font-semibold">{data.tiles[index]}</p>
            </div>
          ))}
        </div>
        <div className="relative flex min-h-0 flex-1 items-end gap-1.5 rounded-xl bg-surface p-2.5" onMouseLeave={() => setHover(null)}>
          {data.bars.map((height, index) => (
            <span key={`${view}-${index}`} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(index)}>
              {hover === index && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-contrast px-1.5 py-0.5 text-[0.55rem] font-semibold whitespace-nowrap text-contrast-fg">
                  {data.labels[index]} · {height}%
                </span>
              )}
              <span
                className="block w-full origin-bottom rounded-sm transition-all duration-500"
                style={{ height: `${height}%`, background: hover === index ? "var(--accent-fg)" : "var(--chart-1)" }}
              />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------- website --- */

const SITE_MENU = {
  Momo: ["Chicken momo · 220", "Veg momo · 180", "Jhol momo · 240"],
  Curries: ["Mutton curry · 520", "Dal bhat · 350", "Paneer masala · 380"],
  Drinks: ["Masala tea · 60", "Sweet lassi · 120", "Fresh lime · 90"],
};

export function WebsiteScreen() {
  const [section, setSection] = useState<keyof typeof SITE_MENU>("Momo");

  return (
    <Frame label="your-restaurant.restaurantos.app">
      <div className="flex h-full flex-col gap-2">
        <div className="flex flex-col justify-end rounded-xl bg-contrast p-3 text-contrast-fg">
          <p className="font-mono text-[0.55rem] tracking-[0.14em] text-accent uppercase">Open today · 11 - 10</p>
          <p className="text-base leading-tight font-semibold">Momo, curry and good tea.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SITE_MENU) as Array<keyof typeof SITE_MENU>).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSection(name)}
              aria-pressed={section === name}
              className={cn(
                "rounded-lg px-2 py-1.5 text-center text-2xs font-medium transition-colors",
                section === name ? "bg-accent text-accent-fg" : "bg-surface hover:bg-surface-2",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <ul key={section} className="flex flex-1 flex-col gap-1">
          {SITE_MENU[section].map((dish) => (
            <li key={dish} className="rise flex justify-between rounded-md bg-surface px-2 py-1 text-2xs">
              <span>{dish.split(" · ")[0]}</span>
              <span className="tabular text-muted">NPR {dish.split(" · ")[1]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
