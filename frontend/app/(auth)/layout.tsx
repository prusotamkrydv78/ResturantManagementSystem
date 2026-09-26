import Link from "next/link";
import { ChefHat, LayoutGrid, ReceiptText, UtensilsCrossed } from "lucide-react";
import { SurfaceScope } from "@/components/layout/surface-scope";

/**
 * The frame around signing in: the product on one side, the form on the other.
 *
 * The ink panel is the only place a person who has never used the product sees what
 * it is before they are inside it, so it says three true things and shows a small
 * picture of the real screens - built from the same tokens, not a screenshot. On a
 * phone it steps aside and the form has the whole screen; nobody signs in to a till
 * from a phone to read a brochure.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <SurfaceScope surface="brand" />

      <aside className="relative m-2 hidden flex-col justify-between overflow-hidden rounded-3xl bg-contrast p-10 text-contrast-fg lg:flex">
        {/* Two soft lime glows for depth. Decoration only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 40%, transparent), transparent)" }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 20%, transparent), transparent)" }}
        />

        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-lg">
          <span
            className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-fg"
            aria-hidden="true"
          >
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight">Restaurant OS</span>
            <span className="text-xs text-contrast-muted">Restaurant operations platform</span>
          </span>
        </Link>

        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Your floor, your kitchen and your till,{" "}
            <span className="text-accent">finally in step.</span>
          </h2>

          <ul className="flex flex-col gap-3">
            {[
              { icon: LayoutGrid, text: "The floor and the kitchen see every order the moment it is sent." },
              { icon: ReceiptText, text: "The bill adds itself up from your own menu, never a typed total." },
              { icon: ChefHat, text: "Everybody signs in to their own job - manager, waiter or chef." },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-contrast-muted">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-contrast-raised text-accent">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <Preview />
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-8">
        <Link href="/" className="flex w-fit items-center gap-2.5 rounded-lg lg:hidden">
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-fg"
            aria-hidden="true"
          >
            <UtensilsCrossed className="size-[18px]" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-text">Restaurant OS</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-center text-xs text-subtle">
          Restaurant management platform · accounts are issued, never self-registered
        </p>
      </main>
    </div>
  );
}

/**
 * A glimpse of the real screens: today's takings and a ticket at the pass.
 *
 * Illustrative, and marked so - read aloud, invented figures would sound like data.
 */
function Preview() {
  return (
    <div
      role="img"
      aria-label="An illustration of the product: today's takings on a lime tile beside a kitchen ticket."
      className="relative grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3"
    >
      <div className="relative overflow-hidden rounded-2xl bg-accent p-4 text-accent-fg">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-white/30"
        />
        <p className="relative text-xs font-semibold">Taken today</p>
        <p className="tabular relative mt-3 text-3xl leading-none font-semibold tracking-tight">
          48,260
        </p>
        <p className="relative mt-2 text-2xs font-medium opacity-75">112% of yesterday</p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-contrast-raised p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xs font-semibold">KOT #42</span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent">
            Ready
          </span>
        </div>
        <p className="text-2xs text-contrast-muted">Table 6</p>
        <ul className="flex flex-col gap-0.5 text-xs">
          <li>2 × Chicken momo</li>
          <li>1 × Dal bhat</li>
        </ul>
      </div>
    </div>
  );
}
