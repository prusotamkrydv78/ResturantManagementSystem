import Link from "next/link";
import {
  WorkspaceLink,
} from "@/features/auth/workspace-link";
import {
  BadgeCheck,
  Radio,
  ShieldCheck,
  Smartphone,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { SurfaceScope } from "@/components/layout/surface-scope";
import { HeroFloaters } from "@/features/landing/hero-floaters";
import { PageLoader } from "@/features/landing/page-loader";
import { ScreenGallery } from "@/features/landing/screen-gallery";
import { HeaderShell, SectionNav } from "@/features/landing/site-nav";
import { ServiceStory } from "@/features/landing/service-story";
import { LandingScroll } from "@/features/landing/landing-scroll";
import { EasingMarquee } from "@/features/landing/easing-marquee";
import { FeatureShowcase } from "@/features/landing/feature-showcase";
import { LiveBoard } from "@/features/landing/live-board";
import { CyclingWord, LandingMotion, Reveal, SectionReveal, WordReveal } from "@/features/landing/motion";
import { OrderJourney } from "@/features/landing/order-journey";
import { RoleSwitcher } from "@/features/landing/role-switcher";
import { cn } from "@/lib/utils/cn";

/**
 * The front door.
 *
 * WHAT IT HAS TO DO
 *
 * Earn thirty seconds. Somebody arriving here decides almost at once whether this
 * is worth reading, so the page leads with the product moving - a service playing
 * out on the live board - rather than with a paragraph about it, and every section
 * after that shows before it tells: an order travelling from table to till, a
 * kitchen rail, stock leaving the shelf, each role's own screen.
 *
 * WHAT IT MUST NOT DO
 *
 * Claim anything the product does not do. There are no invented customer logos, no
 * testimonials, no usage statistics and no pricing. The figures in the illustrations
 * are a script, and every illustration says so to a screen reader. A landing page
 * that oversells is a support ticket with a delay on it.
 *
 * Deliberately no sign-up. Accounts are issued by a platform administrator, and the
 * page says so rather than leaving somebody hunting for a button that was never built.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <SurfaceScope surface="brand" />
      <SiteHeader />

      <LandingMotion>
        <LandingScroll>
          <PageLoader />
          {/* How far down the page the visitor is, filled by LandingScroll; a
              click glides back to the top. */}
          <a
            href="#top"
            data-progress-ring
            aria-label="Back to the top"
            className="group fixed right-5 bottom-5 z-[60] grid size-14 place-items-center rounded-full bg-contrast text-contrast-fg shadow-xl ring-1 ring-white/10 transition-transform hover:scale-110"
          >
            <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="28" cy="28" r="24" fill="none" stroke="var(--contrast-raised)" strokeWidth="3" />
              <circle
                data-progress-arc
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset="100"
              />
            </svg>
            <span data-progress-label className="tabular relative font-mono text-[0.65rem] font-semibold group-hover:text-accent">
              0%
            </span>
          </a>
        <main className="flex flex-1 flex-col gap-3 px-3 pb-3 sm:px-4">
          <Hero />
          <SectionReveal>
            <Marquee />
          </SectionReveal>
          <SectionReveal>
            <Journey />
          </SectionReveal>
          <SectionReveal>
            <Features />
          </SectionReveal>
          <SectionReveal>
            <ServiceStory />
          </SectionReveal>
          <SectionReveal>
            <ScreenGallery />
          </SectionReveal>
          <SectionReveal>
            <Roles />
          </SectionReveal>
          <SectionReveal>
            <Statement />
          </SectionReveal>
          <SectionReveal>
            <Access />
          </SectionReveal>
          <SectionReveal>
            <Finale />
          </SectionReveal>
        </main>
        </LandingScroll>
      </LandingMotion>

      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared furniture                                                           */
/* -------------------------------------------------------------------------- */

function Well({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl", className)}>{children}</div>;
}

function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <span
      data-eyebrow
      className={cn(
        "w-fit rounded-full px-3 py-1 font-mono text-2xs font-medium tracking-[0.14em] uppercase",
        onDark ? "bg-contrast-raised text-accent" : "bg-surface text-primary shadow-(--surface-shadow)",
      )}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight text-text sm:text-5xl">
        {title}
      </h2>
      {lede !== undefined && <p className="text-base text-muted sm:text-lg">{lede}</p>}
    </Reveal>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-fg"
        aria-hidden="true"
      >
        <UtensilsCrossed className="size-[18px]" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-text">Restaurant OS</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Story", href: "#story" },
  { label: "Screens", href: "#screens" },
  { label: "Roles", href: "#roles" },
  { label: "Access", href: "#access" },
] as const;

function SiteHeader() {
  return (
    <HeaderShell>
      {/* At the top a full-width bar attached to the edge; once the page moves it
          pulls in from the sides and drops into a floating pill. Plain classes
          rather than Well, whose max width would fight the ones here. */}
      <div className="ui-surface mx-auto flex h-16 w-full max-w-[100vw] items-center justify-between gap-6 rounded-none border-b border-border bg-surface/90 px-5 backdrop-blur-md transition-[max-width,height,border-radius,background-color,box-shadow,padding,margin] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-10 group-data-[raised]/header:mt-3 group-data-[raised]/header:h-12 group-data-[raised]/header:max-w-5xl group-data-[raised]/header:rounded-2xl group-data-[raised]/header:border group-data-[raised]/header:bg-surface/95 group-data-[raised]/header:px-3 group-data-[raised]/header:shadow-xl sm:group-data-[raised]/header:px-4">
        <Link href="/" className="rounded-md">
          <Wordmark />
        </Link>

        <SectionNav items={NAV} />

        <WorkspaceLink size="sm" />
      </div>
    </HeaderShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

const FACTS = [
  { icon: Radio, label: "Live on every screen", detail: "no refresh button" },
  { icon: Smartphone, label: "Guests order by QR", detail: "no app to install" },
  { icon: Users, label: "Four roles, one sign-in", detail: "each sees their own job" },
  { icon: BadgeCheck, label: "Built for Nepal", detail: "NPR, VAT, service charge" },
] as const;

function Hero() {
  return (
    <section id="top" data-hero="panel" className="relative isolate mt-3 overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg">
      {/* A faint dot grid and two lime glows: depth without anything that reads as a picture. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <span
        aria-hidden="true"
        data-hero="glow" className="pointer-events-none absolute -top-48 -left-40 -z-10 size-[36rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 40%, transparent), transparent)" }}
      />
      <span
        aria-hidden="true"
        data-hero="glow" className="pointer-events-none absolute -right-32 -bottom-56 -z-10 size-[32rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 20%, transparent), transparent)" }}
      />

      <HeroFloaters />

      <Well className="grid items-center gap-12 px-6 pt-14 pb-10 sm:px-10 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:gap-14">
        <div className="flex flex-col items-start gap-6">
          <span data-hero="pill" className="flex items-center gap-2 rounded-full bg-contrast-raised py-1 pr-3 pl-1">
            <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-bold text-accent-fg">NEW</span>
            <span className="text-xs text-contrast-muted">Your own restaurant website, in four designs</span>
          </span>

          <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl">
            <span className="block overflow-hidden pb-[0.14em]">
              <span data-hero="line" className="block">
                <span data-split>Your</span>{" "}
                <CyclingWord
                  className="text-accent"
                  words={["floor,", "kitchen,", "till,", "stock,", "bookings,"]}
                />
              </span>
            </span>
            <span className="-mt-[0.14em] block overflow-hidden pb-[0.14em]">
              <span data-hero="line" className="block">
                <span data-split>finally in step.</span>
              </span>
            </span>
          </h1>

          <p data-hero="lede" className="max-w-xl text-lg text-contrast-muted">
            Orders, kitchen, bills and stock - one live system.
          </p>

          <div data-hero="cta" className="flex flex-wrap items-center gap-3">
            <WorkspaceLink
              signedOutLabel="Sign in to your restaurant"
              variant="accent"
              className="h-12 px-6 text-base"
            />
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-contrast-raised px-6 text-base font-medium transition-colors hover:bg-contrast-raised"
            >
              Watch an order travel
            </a>
          </div>

        </div>

        <div data-hero="board" className="w-full">
          <LiveBoard />
        </div>
      </Well>

      {/* What is true about it, in four short lines along the bottom of the hero. */}
      <Well className="px-6 pb-8 sm:px-10">
        <ul data-hero="facts" className="grid gap-px overflow-hidden rounded-2xl bg-contrast-raised/60 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ icon: Icon, label, detail }) => (
            <li key={label} className="flex items-center gap-3 bg-contrast/60 px-4 py-3">
              <Icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-contrast-muted">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Marquee                                                                    */
/* -------------------------------------------------------------------------- */

const CAPABILITIES = [
  "Live floor",
  "Kitchen display",
  "QR ordering",
  "Billing & receipts",
  "Recipes & stock",
  "Reservations",
  "Customers",
  "Reports",
  "Staff accounts",
  "Your own website",
  "Reviews",
  "Multi-restaurant console",
];

/** The capability strip. Its track holds the list twice so it loops without a seam. */
function Marquee() {
  return (
    <section data-marquee aria-label="Everything included" className="overflow-hidden rounded-2xl bg-accent py-4 text-accent-fg">
      <EasingMarquee className="marquee-track flex w-max items-center gap-8">
        {[...CAPABILITIES, ...CAPABILITIES].map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-8 text-lg font-semibold tracking-tight whitespace-nowrap sm:text-xl"
            aria-hidden={index >= CAPABILITIES.length ? true : undefined}
          >
            {item}
            <UtensilsCrossed className="size-4 opacity-50" aria-hidden="true" />
          </span>
        ))}
      </EasingMarquee>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Journey                                                                    */
/* -------------------------------------------------------------------------- */

function Journey() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <Well className="flex flex-col gap-8 px-3 py-14 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Watch one order travel,{" "}
              <span className="text-primary">table to till.</span>
            </>
          }
          lede="From table to till, in four steps."
        />
        <Reveal delay={0.1}>
          <OrderJourney />
        </Reveal>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="scroll-mt-20">
      <Well className="flex flex-col gap-8 px-3 pb-14 sm:px-6">
        <SectionHeading
          eyebrow="What you get"
          title={
            <>
              Three things your team{" "}
              <span className="text-primary">feels on day one.</span>
            </>
          }
          lede="Everything a restaurant runs on, in one place."
        />
        <FeatureShowcase />
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

function Roles() {
  return (
    <section data-panel id="roles" className="scroll-mt-20 rounded-[2rem] bg-panel text-panel-fg">
      <Well className="flex flex-col gap-8 px-6 py-14 sm:px-10">
        <Reveal className="flex max-w-2xl flex-col gap-3">
          <Eyebrow>Roles</Eyebrow>
          <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Everybody signs in to their own job.
          </h2>
          <p className="text-base opacity-80 sm:text-lg">
            Pick a role to see their screen.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <RoleSwitcher />
        </Reveal>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Statement                                                                  */
/* -------------------------------------------------------------------------- */

function Statement() {
  return (
    <section data-panel className="relative isolate overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 20%, transparent), transparent)" }}
      />
      <Well className="flex flex-col items-center gap-6 px-6 py-20 text-center sm:px-10 sm:py-24">
        <Eyebrow onDark>The idea</Eyebrow>
        <WordReveal
          text="One order. One spine. Nothing to reconcile at the end of the night."
          className="max-w-4xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl"
        />
        <p className="max-w-xl text-base text-contrast-muted sm:text-lg">
          Change it once, every screen updates.
        </p>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

function Access() {
  const steps = [
    { step: "01", title: "The administrator sets up the restaurant", body: "Creates it and issues a manager." },
    { step: "02", title: "The manager sets up the room", body: "Adds tables, menu and staff." },
    { step: "03", title: "Everybody signs in to their own workspace", body: "One sign-in, their own screen." },
  ];

  return (
    <section id="access" className="scroll-mt-20">
      <Well className="flex flex-col gap-8 px-3 py-14 sm:px-6">
        <SectionHeading
          eyebrow="Access"
          title="Accounts are issued, not requested."
          lede="No public sign-up."
        />

        <div className="grid gap-3 lg:grid-cols-4">
          {steps.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.08}>
              <article className="ui-surface flex h-full flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-panel font-mono text-sm font-semibold text-panel-fg">
                  {item.step}
                </span>
                <h3 className="text-base font-semibold tracking-tight text-text">{item.title}</h3>
                <p className="text-sm text-muted">{item.body}</p>
              </article>
            </Reveal>
          ))}

          <Reveal delay={0.24}>
            <article className="flex h-full flex-col gap-3 rounded-3xl bg-contrast p-5 text-contrast-fg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-fg" aria-hidden="true">
                <ShieldCheck className="size-5" />
              </span>
              <h3 className="text-base font-semibold tracking-tight">One restaurant cannot see another</h3>
              <p className="text-sm text-contrast-muted">
                Every restaurant&rsquo;s data is kept apart.
              </p>
            </article>
          </Reveal>
        </div>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The end of the tour, and the reason for it.
 *
 * A full screen of lime. As it scrolls in, a ring of ink grows behind the words and
 * the headline swells from small to enormous, tied to the scrollbar, so arriving
 * here feels like the page opening up rather than running out. Then the one action
 * the page exists for, and a way back to the top for anybody who wants another look.
 */
function Finale() {
  return (
    <section
      id="finale"
      data-finale
      className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-accent px-6 py-24 text-center text-accent-fg sm:px-10"
    >
      <span
        data-finale-orb
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5rem] border-accent-fg/10"
      />
      <span
        data-finale-orb
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[45vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
      />

      <p data-finale-kicker className="font-mono text-xs font-semibold tracking-[0.2em] uppercase opacity-70">
        That is the whole tour
      </p>

      <p
        data-finale-title
        className="mt-6 text-[clamp(3.5rem,13vw,12rem)] leading-[0.9] font-semibold tracking-tighter"
      >
        Get on with
        <br />
        service.
      </p>

      <div data-finale-action className="mt-12 flex flex-col items-center gap-5">
        <WorkspaceLink className="h-16 px-10 text-lg" />
        <p className="text-sm opacity-75">Use the account your administrator gave you.</p>
        <a href="#top" className="text-sm font-semibold underline-offset-4 hover:underline">
          Back to the top ↑
        </a>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const RECEIPT_ITEMS = ["QR table ordering", "Kitchen display", "Bills with VAT", "Recipes & stock", "Bookings", "Your own website"];

const RECEIPT_REVISIT = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "One evening", href: "#story" },
  { label: "Every screen", href: "#screens" },
  { label: "Roles", href: "#roles" },
  { label: "Access", href: "#access" },
];

/** Bar widths for the receipt's barcode: decoration, fixed so the server and browser agree. */
const BARCODE = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 2, 3, 1, 1, 2, 1, 3];

/**
 * The end of the tour is a bill.
 *
 * The product's favourite moment is a table paying and the bill adding itself up,
 * so the page ends the same way: a receipt printer on the counter, and as the
 * visitor scrolls into the footer the receipt prints out of its slot, tied to the
 * scrollbar (LandingScroll). On it, everything in the box - all included - the
 * sections worth another look, and a total paid with the visitor's attention.
 *
 * Nothing on it is invented: no prices, no figures, no accounts we do not have.
 */
function SiteFooter() {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <footer className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div data-footer className="relative isolate overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        <Well className="flex flex-col gap-12 px-6 pt-16 sm:px-10">
          {/* The words. */}
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-start gap-6">
              <span data-footer-col className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
                End of the tour
              </span>
              <h2 data-footer-col className="text-5xl leading-[0.95] font-semibold tracking-tighter sm:text-7xl">
                Thank you for scrolling.
              </h2>
              <p data-footer-col className="max-w-md text-lg text-contrast-muted">
                Here is your bill. Everything on it comes in the box.
              </p>
            </div>
            <div data-footer-col className="flex flex-wrap items-center gap-4">
              <WorkspaceLink variant="accent" className="h-12 px-6 text-base" />
              <a href="#top" className="text-sm font-semibold text-contrast-muted transition-colors hover:text-accent">
                Back to the top ↑
              </a>
            </div>
          </div>

          {/* The printer, and the receipt coming out of it: a tall slip printing
              downward on a phone; on a desktop a long landscape strip feeding out
              to the right, its sections laid side by side. */}
          <div className="mx-auto flex w-full max-w-[22rem] flex-col items-center lg:max-w-none lg:flex-row lg:items-stretch">
            <div className="relative z-10 flex h-12 w-[calc(100%+2rem)] shrink-0 items-center justify-between rounded-2xl bg-contrast-raised px-4 shadow-2xl ring-1 ring-white/5 lg:h-auto lg:w-12 lg:flex-col lg:px-0 lg:py-5">
              <span className="font-mono text-2xs tracking-[0.2em] text-contrast-muted uppercase lg:rotate-180 lg:[writing-mode:vertical-rl]">
                Printing
              </span>
              <span data-footer-led className="size-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
              {/* The slot the paper leaves through. */}
              <span className="absolute inset-x-5 -bottom-px h-1 rounded-full bg-black lg:inset-x-auto lg:inset-y-5 lg:-right-px lg:bottom-auto lg:h-auto lg:w-1" />
            </div>

            <div className="relative -mt-1 w-full min-w-0 overflow-hidden lg:mt-0 lg:-ml-1 lg:py-3">
              <div
                data-receipt
                className="receipt-edge flex flex-col bg-surface px-6 pt-7 pb-10 font-mono text-[0.72rem] leading-relaxed text-text shadow-xl lg:flex-row lg:gap-0 lg:py-6 lg:pr-12 lg:pl-8"
              >
                <ReceiptPart className="items-center text-center lg:min-w-0 lg:flex-[0.8] lg:justify-center">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-contrast text-accent" aria-hidden="true">
                    <UtensilsCrossed className="size-4" />
                  </span>
                  <span className="mt-2 text-sm font-bold tracking-[0.2em]">RESTAURANT OS</span>
                  <span className="text-muted">From table to till</span>
                  <span className="text-muted">Built for Nepal</span>
                </ReceiptPart>

                <ReceiptPart className="lg:min-w-0 lg:flex-1">
                  <p className="mb-1 font-bold">ORDER</p>
                  <Line left="Guest" right="You" />
                  <Line left="Order" right="#0001" />
                  <Line left="Date" right={today} />
                </ReceiptPart>

                <ReceiptPart className="lg:min-w-0 lg:flex-[1.2]">
                  <p className="mb-1 font-bold">IN THE BOX</p>
                  {RECEIPT_ITEMS.map((item) => (
                    <Line key={item} left={`1  ${item}`} right="incl." />
                  ))}
                </ReceiptPart>

                <ReceiptPart className="lg:min-w-0 lg:flex-1">
                  <p className="mb-1 font-bold">WORTH ANOTHER LOOK</p>
                  {RECEIPT_REVISIT.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="-mx-1 flex justify-between gap-3 rounded px-1 transition-colors hover:bg-accent hover:text-accent-fg"
                    >
                      <span>{link.label}</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  ))}
                </ReceiptPart>

                <ReceiptPart className="lg:min-w-0 lg:flex-[1.2] lg:justify-between">
                  <div>
                    <div className="flex justify-between gap-3 text-sm font-bold">
                      <span>TOTAL</span>
                      <span>Everything</span>
                    </div>
                    <Line left="Paid with" right="Your attention" />
                    <Line left="Change due" right="How you run service" />
                  </div>
                  <div className="mt-4 flex flex-col items-center">
                    <div className="flex h-10 items-stretch justify-center gap-px" aria-hidden="true">
                      {BARCODE.map((width, index) => (
                        <span key={index} className={index % 2 === 0 ? "bg-text" : "bg-transparent"} style={{ width: `${width * 1.5}px` }} />
                      ))}
                    </div>
                    <p className="mt-3 text-center">*** Thank you - visit again ***</p>
                  </div>
                </ReceiptPart>
              </div>
            </div>
          </div>
        </Well>

        <Well className="mt-12 flex flex-col gap-2 border-t border-contrast-raised px-6 py-5 text-xs text-contrast-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span>© {new Date().getFullYear()} Restaurant OS</span>
          <span>Accounts are issued by your platform administrator.</span>
        </Well>
      </div>
    </footer>
  );
}

/**
 * One section of the receipt. On the tall slip each is set off by a dashed rule
 * above it; on the landscape strip, by a dashed rule to its left.
 */
function ReceiptPart({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col border-dashed border-border-strong not-first:mt-3 not-first:border-t not-first:pt-3 lg:not-first:mt-0 lg:not-first:ml-5 lg:not-first:border-t-0 lg:not-first:border-l lg:not-first:pt-0 lg:not-first:pl-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One line of the receipt: a label on the left, its value on the right. */
function Line({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 truncate whitespace-pre">{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </div>
  );
}
