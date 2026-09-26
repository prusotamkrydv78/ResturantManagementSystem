import { ChefHat, CircleCheck, QrCode, Send } from "lucide-react";

/**
 * Small moments from a service, floating in the hero's left margin on wide screens:
 * a ticket sent, a QR order, a plate up, a table paid - each a little card with the
 * line a screen would show and the button somebody would press. They are
 * decoration, so they are hidden from assistive tech and the buttons are not real;
 * LandingScroll pops them in, floats them and lets them lean with the pointer.
 */
const FLOATERS = [
  {
    icon: Send,
    title: "Ticket #42",
    text: "Table 6 · 3 items",
    action: "Send to kitchen",
    tone: "var(--chart-1)",
    place: "top-[14%] left-[1.5%]",
    depth: 1.2,
  },
  {
    icon: QrCode,
    title: "Guest order",
    text: "Table 9 · by QR",
    action: "Accept",
    tone: "var(--chart-4)",
    place: "top-[36%] left-[4%]",
    depth: 0.7,
  },
  {
    icon: ChefHat,
    title: "Plate up",
    text: "Chicken momo × 2",
    action: "Mark served",
    tone: "var(--chart-3)",
    place: "top-[58%] left-[1%]",
    depth: 1,
  },
  {
    icon: CircleCheck,
    title: "Table 2 paid",
    text: "NPR 1,240 · card",
    action: "Print receipt",
    tone: "var(--chart-2)",
    place: "top-[79%] left-[3.5%]",
    depth: 0.8,
  },
];

export function HeroFloaters() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 hidden min-[1600px]:block">
      {FLOATERS.map(({ icon: Icon, title, text, action, tone, place, depth }) => (
        <span key={title} data-hero="float" data-depth={depth} className={`absolute ${place}`}>
          <span
            data-bob
            className="flex w-44 flex-col gap-2.5 rounded-2xl bg-contrast-raised/90 p-3 shadow-xl ring-1 ring-white/5"
          >
            <span className="flex items-center gap-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${tone} 22%, transparent)`, color: tone }}
              >
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold">{title}</span>
                <span className="truncate text-2xs text-contrast-muted">{text}</span>
              </span>
            </span>
            <span
              className="flex h-7 items-center justify-center rounded-lg text-2xs font-semibold"
              style={{ background: tone, color: "var(--contrast)" }}
            >
              {action}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
