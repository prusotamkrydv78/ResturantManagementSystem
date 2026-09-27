import { BarChart3, ChefHat, Globe, QrCode, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GuestScreen, KitchenScreen, ManagerScreen, WaiterScreen, WebsiteScreen } from "./gallery-screens";

/**
 * Every screen in the product, on a strip that slides sideways as the page scrolls.
 *
 * Markup only: LandingScroll pins the section and drives the strip with the
 * scrollbar, so a visitor scrolling down walks past the waiter's screen, the
 * kitchen's, the guest's phone, the manager's day and the restaurant's own website
 * without ever leaving the page. Every screen can be tapped and played with (see
 * gallery-screens). The figures are a script; the section says it is an
 * illustration.
 */

interface Screen {
  number: string;
  icon: LucideIcon;
  who: string;
  title: string;
  picture: React.ReactNode;
}

const SCREENS: Screen[] = [
  { number: "01", icon: UtensilsCrossed, who: "Waiter", title: "Take the order at the table.", picture: <WaiterScreen /> },
  { number: "02", icon: ChefHat, who: "Kitchen", title: "Cook in the order it came.", picture: <KitchenScreen /> },
  { number: "03", icon: QrCode, who: "Guest", title: "Order from their own phone.", picture: <GuestScreen /> },
  { number: "04", icon: BarChart3, who: "Manager", title: "See the whole day, live.", picture: <ManagerScreen /> },
  { number: "05", icon: Globe, who: "Website", title: "Your own restaurant website.", picture: <WebsiteScreen /> },
];

export function ScreenGallery() {
  return (
    <section
      id="screens"
      data-gallery
      aria-label="Every screen in the product (illustration)"
      className="relative flex h-[calc(100svh_-_3.5rem)] mt-2 min-h-[38rem] flex-col overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg"
    >
      <div className="flex items-end justify-between gap-6 px-6 pt-10 sm:px-10 sm:pt-14">
        <div className="flex max-w-xl flex-col gap-3">
          <span
            data-eyebrow
            className="w-fit rounded-full bg-contrast-raised px-3 py-1 font-mono text-2xs font-medium tracking-[0.14em] text-accent uppercase"
          >
            Every screen
          </span>
          <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Five screens. <span className="text-accent">One live service.</span>
          </h2>
          <p className="text-sm text-contrast-muted">Go on - tap them. Every screen works.</p>
        </div>
        <span data-gallery-count className="tabular hidden font-mono text-sm text-contrast-muted sm:block">
          01 / 05
        </span>
      </div>

      <div className="flex flex-1 items-center motion-reduce:overflow-x-auto">
        <div data-gallery-track className="flex gap-5 px-6 will-change-transform sm:gap-8 sm:px-10">
          {SCREENS.map(({ number, icon: Icon, who, title, picture }) => (
            <div key={number} data-gallery-panel className="flex w-[82vw] shrink-0 flex-col gap-4 sm:w-[34rem] lg:w-[40rem]">
              <div data-gallery-picture className="aspect-[16/10] overflow-hidden rounded-3xl bg-contrast-raised p-3 sm:p-4">
                {picture}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="font-mono text-2xs tracking-[0.14em] text-contrast-muted uppercase">
                    {number} · {who}
                  </span>
                  <span className="text-lg font-semibold tracking-tight sm:text-xl">{title}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One segment per screen, filling as that screen slides past. */}
      <div className="flex gap-2 px-6 pb-8 sm:gap-3 sm:px-10" aria-hidden="true">
        {SCREENS.map(({ number, who }) => (
          <div key={number} className="flex flex-1 flex-col gap-2">
            <div className="relative h-1 overflow-hidden rounded-full bg-contrast-raised">
              <span data-gallery-seg className="absolute inset-0 origin-left scale-x-0 rounded-full bg-accent" />
            </div>
            <span data-gallery-seg-label className="font-mono text-[0.6rem] tracking-[0.14em] text-contrast-muted uppercase sm:text-2xs">
              {number} {who}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
