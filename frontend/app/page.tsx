import Link from "next/link";
import {
  WorkspaceLink,
  WorkspaceTextLink,
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
            <Roles />
          </SectionReveal>
          <SectionReveal>
            <Statement />
          </SectionReveal>
          <SectionReveal>
            <Access />
          </SectionReveal>
          <SectionReveal>
            <Closing />
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
  { label: "Roles", href: "#roles" },
  { label: "Access", href: "#access" },
] as const;

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <Well className="ui-surface flex h-14 items-center justify-between gap-6 rounded-2xl border border-border bg-surface/85 px-3 backdrop-blur-md sm:px-4">
        <Link href="/" className="rounded-md">
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <WorkspaceLink size="sm" />
      </Well>
    </header>
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
    <section data-hero="panel" className="relative isolate mt-3 overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg">
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

function Closing() {
  return (
    <section data-panel className="relative isolate overflow-hidden rounded-[2rem] bg-accent text-accent-fg">
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/30" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 size-72 rounded-full bg-white/20" />

      <Well className="flex flex-col items-start gap-8 px-6 py-16 sm:px-10 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            Open the room.
            <br />
            Get on with service.
          </h2>
          <p className="text-base opacity-80 sm:text-lg">
            Use the account your administrator gave you.
          </p>
        </div>
        <WorkspaceLink className="h-14 shrink-0 px-8 text-base" />
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="px-3 pb-6 sm:px-4">
      <Well className="flex flex-col gap-4 px-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <Wordmark />
          <p className="hidden text-sm text-muted md:block">
            Restaurant operations, from the table to the till.
          </p>
        </div>

        <nav aria-label="Sections" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded text-sm text-muted transition-colors hover:text-text">
              {item.label}
            </a>
          ))}
          <WorkspaceTextLink />
        </nav>
      </Well>
    </footer>
  );
}
