"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Check, Globe, Package, QrCode, ReceiptText } from "lucide-react";

/** The rest of the product, one line each, beside the kitchen. */
const SMALL = [
  { icon: QrCode, title: "QR table ordering", body: "Guests scan and order. No app, no sign-up.", tone: "bg-accent text-accent-fg" },
  { icon: ReceiptText, title: "Bills add up themselves", body: "Service and VAT worked out on every bill.", tone: "bg-panel text-panel-fg" },
  { icon: Package, title: "Stock that counts down", body: "Every dish sold takes its ingredients off.", tone: "bg-panel text-panel-fg" },
  { icon: CalendarDays, title: "Bookings", body: "Reservations and tables in one diary.", tone: "bg-accent text-accent-fg" },
  { icon: BarChart3, title: "Live reports", body: "Takings and best sellers as they happen.", tone: "bg-accent text-accent-fg" },
  { icon: Globe, title: "Your own website", body: "Menu and details on your own address.", tone: "bg-panel text-panel-fg" },
];
import { cn } from "@/lib/utils/cn";

/**
 * The three things the product does best, each given the room to show itself.
 *
 * WHY THREE
 *
 * A grid of every feature reads as a spec sheet: either too much to take in, or so
 * little per card that each one looks like every other. Three moments carry the
 * product - the kitchen hearing an order the instant it is sent, a guest ordering from
 * their own phone, a bill that is right without anybody adding it up - and each gets a
 * big tile, a big line and a picture that is actually doing the thing.
 *
 * THE MOTION
 *
 * The kitchen rail and the phone keep moving, because a live product is the point.
 * Everything moves by transform inside a box of fixed size, so nothing here can push
 * the page around; reduced motion holds each picture on its first frame.
 */
export function FeatureShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-5 lg:grid-rows-2">
      {/* The live kitchen: the heart of it, so the biggest tile. */}
      <Showcase
        className="bg-contrast text-contrast-fg lg:col-span-3 lg:row-span-2"
        number="01"
        title="Your kitchen, live."
        body="Orders hit the kitchen screen the second they are sent."
        mutedClass="text-contrast-muted"
      >
        <KitchenLanes />
      </Showcase>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:row-span-2">
        {SMALL.map((item) => (
          <article
            key={item.title}
            className={cn("flex flex-col gap-3 rounded-[1.5rem] p-5", item.tone)}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/60 text-text">
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg leading-tight font-semibold tracking-tight">{item.title}</h3>
            <p className="text-sm leading-relaxed opacity-75">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tile ----- */

function Showcase({
  className,
  number,
  title,
  body,
  mutedClass,
  side = false,
  children,
}: {
  className: string;
  number: string;
  title: string;
  body: string;
  mutedClass: string;
  /** Words beside the picture on a wide screen, for the two smaller tiles. */
  side?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "relative flex gap-6 overflow-hidden rounded-[2rem] p-6 sm:p-8",
        side ? "flex-col sm:flex-row sm:items-center lg:flex-col lg:items-stretch" : "flex-col",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-3", side && "sm:flex-1")}>
        <span className={cn("font-mono text-xs font-semibold tracking-[0.2em]", mutedClass)}>{number}</span>
        <h3 className="text-3xl leading-[1.05] font-semibold tracking-tight sm:text-4xl">{title}</h3>
        <p className={cn("max-w-md text-sm leading-relaxed sm:text-base", mutedClass)}>{body}</p>
      </div>
      <div className={cn("relative", side ? "sm:w-60 sm:shrink-0 lg:mt-auto lg:w-auto" : "mt-auto")} aria-hidden="true">
        {children}
      </div>
    </article>
  );
}

/** Ticks a counter on a fixed beat, unless the visitor prefers stillness. */
function useBeat(ms: number) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = setInterval(() => setBeat((current) => current + 1), ms);

    return () => clearInterval(timer);
  }, [ms]);

  return beat;
}

/* ------------------------------------------------------- kitchen lanes ----- */

const LANES = [
  { name: "Waiting", tone: "var(--contrast-muted)" },
  { name: "Cooking", tone: "var(--chart-3)" },
  { name: "Ready", tone: "var(--chart-2)" },
] as const;

const ORDERS = [
  { table: "Table 4", dishes: ["2 × Chicken momo", "1 × Dal bhat"] },
  { table: "Table 9", dishes: ["1 × Mutton curry", "2 × Garlic naan"] },
  { table: "Table 2", dishes: ["1 × Paneer tikka", "2 × Masala tea"] },
  { table: "Table 6", dishes: ["3 × Veg momo", "1 × Sweet lassi"] },
  { table: "Table 1", dishes: ["1 × Chicken biryani", "1 × Kheer"] },
];

/**
 * Three lanes, and tickets flowing through them.
 *
 * Every beat each ticket moves one lane to the right, the ready one leaves, and a new
 * one arrives in waiting. Tickets are placed absolutely and moved by transform, so the
 * lanes never change size however many are in flight.
 */
function KitchenLanes() {
  const beat = useBeat(2000);

  // The ticket in lane L at this beat is number (beat - L). One extra, past the last
  // lane, is on its way out and fading.
  const tickets = [0, 1, 2, 3].map((lane) => {
    const id = beat - lane;
    const order = ORDERS[((id % ORDERS.length) + ORDERS.length) % ORDERS.length]!;

    return { id, lane, order, number: 40 + id };
  });

  return (
    <div className="rounded-3xl bg-contrast-raised p-3 sm:p-4">
      <div className="grid grid-cols-3 gap-2 pb-3">
        {LANES.map((lane) => (
          <span key={lane.name} className="flex items-center gap-1.5 px-1 text-xs font-semibold">
            <span className="size-2 rounded-full" style={{ background: lane.tone }} />
            {lane.name}
          </span>
        ))}
      </div>

      <div className="relative h-40 overflow-hidden sm:h-44">
        {tickets.map(({ id, lane, order, number }) => {
          const tone = LANES[Math.min(lane, 2)]!.tone;
          const leaving = lane > 2;

          return (
            <div
              key={id}
              className="absolute top-0 left-0 h-full w-[calc((100%-1rem)/3)] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{
                transform: `translateX(calc(${lane} * (100% + 0.5rem)))`,
                opacity: leaving ? 0 : 1,
              }}
            >
              {/* The arrival animation sits on this inner box: it sets its own transform,
                  which on the outer one would fight the lane position. */}
              <div className="rise flex h-full flex-col rounded-2xl border-t-4 bg-surface p-3 text-text" style={{ borderColor: tone }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">#{number}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-2xs font-semibold"
                    style={{ background: `color-mix(in srgb, ${tone} 20%, transparent)`, color: tone }}
                  >
                    {LANES[Math.min(lane, 2)]!.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{order.table}</p>
                <ul className="mt-auto flex flex-col gap-1.5">
                  {order.dishes.map((dish, index) => {
                    // Dishes tick off as the ticket cooks: none waiting, the first
                    // while cooking, all of them when ready.
                    const done = lane >= 2 || (lane === 1 && index === 0);

                    return (
                      <li key={dish} className="flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                            done ? "border-success bg-success" : "border-border-strong",
                          )}
                        >
                          {done && <Check className="size-2.5 text-surface" strokeWidth={3.5} />}
                        </span>
                        <span className="truncate">{dish}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

