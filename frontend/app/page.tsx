import Link from "next/link";
import {
  WorkspaceLink,
  WorkspaceTextLink,
} from "@/features/auth/workspace-link";
import {
  Boxes,
  CalendarClock,
  ChartNoAxesColumn,
  ChefHat,
  ClipboardList,
  KeyRound,
  LayoutGrid,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The front door.
 *
 * Everything claimed on this page is something the product actually does. There are no
 * invented integrations, no fabricated customer logos, no pricing table for a product
 * that has no pricing, and no promise of a mobile app that does not exist. A landing
 * page that oversells is a support ticket with a delay on it.
 *
 * The visuals are built from the application own design tokens rather than screenshots
 * or stock art, which means they cannot drift out of date and they show a prospect the
 * real vocabulary they will be working in. They are illustrations of real screens, so
 * they carry `role="img"` and a description: read aloud, a list of made-up table
 * numbers would sound like live data.
 *
 * Deliberately no sign-up. Accounts are issued by a platform administrator, and the
 * page says so plainly in three places rather than leaving somebody hunting for a
 * button that was never built.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <Lifecycle />
        <Modules />
        <Roles />
        <SelfService />
        <AccessModel />
        <Closing />
      </main>

      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared furniture                                                           */
/* -------------------------------------------------------------------------- */

/** The centred well every band shares, so section edges line up down the page. */
function Well({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/**
 * The small uppercase line above a heading.
 *
 * Set in mono. A restaurant floor is a system with numbers in it, and the mono
 * eyebrows carry that register without needing a third typeface loaded.
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-2xs font-medium tracking-[0.14em] text-primary uppercase">
      {children}
    </p>
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
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-semibold text-text sm:text-4xl">{title}</h2>
      {lede !== undefined && (
        <p className="text-base text-muted sm:text-lg">{lede}</p>
      )}
    </div>
  );
}

/** The product mark, used in the header and the footer. */
function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex size-8 items-center justify-center rounded-lg bg-primary-solid text-primary-fg shadow-sm"
        aria-hidden="true"
      >
        <UtensilsCrossed className="size-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-text">
        Restaurant OS
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "What is inside", href: "#modules" },
  { label: "Roles", href: "#roles" },
  { label: "Access", href: "#access" },
] as const;

/**
 * Sticky, and translucent so the page reads as continuous behind it.
 *
 * The anchors are ordinary fragment links: no JavaScript runs on this page at all,
 * which is why it can be served as static HTML.
 */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
      <Well className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="rounded-md">
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
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

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/*
        Two very low-opacity washes of the primary, offset from each other, so the
        top of the page has depth without anything that reads as decoration. Kept
        behind the content and out of the accessibility tree.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 32rem at 12% -10%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%), " +
            "radial-gradient(48rem 28rem at 88% 8%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 72%)",
        }}
      />

      <Well className="grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <span
            className="rise flex items-center gap-2 rounded-full border border-primary-border bg-primary-soft px-3 py-1"
            style={{ animationDelay: "40ms" }}
          >
            <span className="font-mono text-2xs font-medium tracking-[0.12em] text-primary uppercase">
              Restaurant operations platform
            </span>
          </span>

          <h1
            className="rise text-4xl font-semibold text-text sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "90ms" }}
          >
            Your floor, your kitchen and your till,{" "}
            <span className="text-primary">finally in step</span>.
          </h1>

          <p
            className="rise max-w-xl text-base text-muted sm:text-lg"
            style={{ animationDelay: "150ms" }}
          >
            A waiter opens an order. The kitchen sees it the moment it is sent. The
            bill adds itself up from your own menu. Tables, stock, bookings and
            self-service ordering all hang off that one spine — no spreadsheet
            alongside it, no second system to keep in sync.
          </p>

          <div
            className="rise flex flex-wrap items-center gap-3"
            style={{ animationDelay: "210ms" }}
          >
            <WorkspaceLink
              signedOutLabel="Sign in to your restaurant"
              className="h-11 px-5 text-base"
            />
            <LinkButton
              href="#how-it-works"
              variant="secondary"
              className="h-11 px-5 text-base"
            >
              See how it works
            </LinkButton>
          </div>

          <p
            className="rise flex items-start gap-2 text-sm text-subtle"
            style={{ animationDelay: "260ms" }}
          >
            <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              There is no public sign-up. Your platform administrator issues the
              account, and it arrives already attached to your restaurant.
            </span>
          </p>
        </div>

        <div className="rise w-full" style={{ animationDelay: "320ms" }}>
          <FloorPreview />
        </div>
      </Well>
    </section>
  );
}

/**
 * A miniature of the floor screen, drawn with the application own tokens.
 *
 * Not a screenshot: a screenshot goes stale the first time a padding changes, and a
 * stock illustration of a restaurant tells a prospect nothing about the product. This
 * is the real component vocabulary at a smaller size, so what it promises is what
 * arrives.
 */
function FloorPreview() {
  const tables = [
    { name: "T1", seats: 4, state: "occupied", value: "42.50", note: "2 with the kitchen" },
    { name: "T2", seats: 2, state: "ready", value: "18.00", note: "ready to settle" },
    { name: "T3", seats: 6, state: "free", value: null, note: null },
    { name: "T4", seats: 4, state: "occupied", value: "31.00", note: "1 still to send" },
  ] as const;

  const dot = {
    occupied: "bg-primary",
    ready: "bg-success",
    free: "bg-border-strong",
  } as const;

  const label = {
    occupied: "Occupied",
    ready: "Ready",
    free: "Available",
  } as const;

  return (
    <div
      role="img"
      aria-label="An illustration of the floor screen: four tables with their occupancy, open value and kitchen state, above two kitchen tickets."
      className="flex flex-col gap-3"
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <LayoutGrid className="size-4 text-muted" aria-hidden="true" />
            Floor
          </span>
          <span className="flex items-center gap-1.5 font-mono text-2xs tracking-wide text-subtle uppercase">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            live
          </span>
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {tables.map((table) => (
            <li key={table.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex w-10 shrink-0 flex-col">
                <span className="text-sm font-semibold text-text">{table.name}</span>
                <span className="font-mono text-2xs text-subtle">{table.seats} sts</span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className={cn("size-1.5 rounded-full", dot[table.state])}
                    aria-hidden="true"
                  />
                  {label[table.state]}
                </span>
                {table.note !== null && (
                  <span className="truncate text-2xs text-subtle">{table.note}</span>
                )}
              </span>

              <span className="shrink-0 font-mono text-sm text-text tabular">
                {table.value ?? "—"}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2.5">
          <span className="text-2xs text-subtle">3 of 4 in service</span>
          <span className="font-mono text-2xs text-muted tabular">open 91.50</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniTicket number={14} state="On the stove" tone="warning" lines={["1 Burger", "2 Cola"]} />
        <MiniTicket number={15} state="Waiting" tone="neutral" lines={["1 Curry", "1 Soup"]} />
      </div>
    </div>
  );
}

function MiniTicket({
  number,
  state,
  tone,
  lines,
}: {
  number: number;
  state: string;
  tone: "warning" | "neutral";
  lines: readonly string[];
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm",
        "border-l-2",
        tone === "warning" ? "border-l-warning" : "border-l-border-strong",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xs font-medium text-text">KOT #{number}</span>
        <span
          className={cn(
            "text-2xs",
            tone === "warning" ? "text-warning" : "text-subtle",
          )}
        >
          {state}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <span key={line} className="text-2xs text-muted">
            {line}
          </span>
        ))}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The lifecycle                                                              */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    title: "Opened",
    body: "A waiter picks a table and adds what was asked for. Every price comes from your own menu, and each line keeps the name and price it had at that moment.",
  },
  {
    title: "Sent to the kitchen",
    body: "Everything not yet sent goes out as one ticket, not one per dish. Ingredients leave the shelf at exactly this moment, and never twice for the same line.",
  },
  {
    title: "Ready at the pass",
    body: "The kitchen moves the ticket from waiting, to on the stove, to gone. The order becomes settleable the instant its last ticket lands.",
  },
  {
    title: "Settled",
    body: "The amount due is the server own total, never a figure sent from a screen. One payment per order, a receipt, and the table frees itself.",
  },
] as const;

function Lifecycle() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-b border-border bg-surface">
      <Well className="flex flex-col gap-12 py-20 sm:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="One order, from the table to the till"
          lede="Everything else in the product hangs off this. There is one place a table becomes busy, one place food is told to cook, and one place money is recorded — so nothing has to be reconciled afterwards."
        />

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col gap-3">
              {/* The connecting rule, on wide screens only, and never after the last step. */}
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-10 hidden h-px w-[calc(100%-2rem)] bg-border lg:block"
                />
              )}

              <span className="relative flex size-8 items-center justify-center rounded-full border border-primary-border bg-primary-soft font-mono text-xs font-semibold text-primary">
                {index + 1}
              </span>

              <h3 className="text-lg font-semibold text-text">{step.title}</h3>
              <p className="text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Modules                                                                    */
/* -------------------------------------------------------------------------- */

const MODULES = [
  {
    icon: LayoutGrid,
    title: "Floor and tables",
    body: "Whether a table is busy is decided by whether an order is running on it. There is no switch for somebody to forget to flip, and two parties on one table release it only when the last bill is settled.",
  },
  {
    icon: ClipboardList,
    title: "Waiter ordering",
    body: "Open an order, add items, add a note. A line already with the kitchen cannot be altered, and raising a price tonight can never rewrite a bill somebody already agreed to.",
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    body: "One ticket per trip to the pass, numbered so it can be called out. Cooking tickets sit above waiting ones, finished tickets leave the rail, and no price is ever shown in the kitchen.",
  },
  {
    icon: ReceiptText,
    title: "Billing and receipts",
    body: "Cash, card or digital, recorded against the server own total. One payment per order is a guarantee from the database rather than a hidden button. Cancelling asks why, and keeps everything.",
  },
  {
    icon: Boxes,
    title: "Inventory and recipes",
    body: "Give a dish a recipe and its ingredients come off the shelf when the kitchen is told to cook. Every movement says why it happened, and the ledger can be read back line by line.",
  },
  {
    icon: CalendarClock,
    title: "Customers and reservations",
    body: "Keep the regulars, hold tables for them, and see overlaps refused before they happen. A booking never argues with the floor about who is sitting where.",
  },
  {
    icon: QrCode,
    title: "Self-service ordering",
    body: "Put a code on a table and guests order from their own phone. What they order arrives as an ordinary order on that table — same numbering, same bill, same kitchen.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Reports and the service day",
    body: "Set your timezone and the hour your day starts, and takings are counted in your own calendar rather than the server one. Cancelled orders are reported, never counted as revenue.",
  },
] as const;

function Modules() {
  return (
    <section id="modules" className="scroll-mt-16 border-b border-border">
      <Well className="flex flex-col gap-12 py-20 sm:py-24">
        <SectionHeading
          eyebrow="What is inside"
          title="Everything a service needs, and nothing it does not"
          lede="Each of these is a screen somebody actually works in, not a module waiting to be built."
        />

        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="group flex flex-col gap-3 bg-surface p-5 transition-colors hover:bg-surface-2"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-colors group-hover:border-primary-border group-hover:bg-primary-soft group-hover:text-primary">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-text">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

const ROLES = [
  {
    icon: Store,
    role: "Platform administrator",
    line: "Runs the platform, not a restaurant.",
    sees: ["Create restaurants", "Issue and assign managers"],
  },
  {
    icon: ChartNoAxesColumn,
    role: "Restaurant manager",
    line: "Owns exactly one restaurant, end to end.",
    sees: [
      "Menu, tables, staff, settings",
      "Inventory, customers, reservations",
      "Billing, receipts, reports",
    ],
  },
  {
    icon: ClipboardList,
    role: "Waiter",
    line: "On the floor for a shift.",
    sees: ["The room and who is on it", "Open, edit and send orders"],
  },
  {
    icon: ChefHat,
    role: "Chef",
    line: "At the pass, and nowhere else.",
    sees: ["The live ticket rail", "Start and finish tickets"],
  },
] as const;

function Roles() {
  return (
    <section id="roles" className="scroll-mt-16 border-b border-border bg-surface">
      <Well className="flex flex-col gap-12 py-20 sm:py-24">
        <SectionHeading
          eyebrow="Roles"
          title="Everybody signs in to their own job"
          lede="A manager configures the restaurant, a waiter takes orders, a chef cooks. Keeping those apart is what makes who placed this order a question with an answer — and every boundary is enforced by the server, not by hiding a button."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ icon: Icon, role, line, sees }) => (
            <article
              key={role}
              className="flex flex-col gap-4 rounded-xl border border-border bg-canvas p-5 transition-shadow hover:shadow-md"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>

              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-text">{role}</h3>
                <p className="text-sm text-muted">{line}</p>
              </div>

              <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
                {sees.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-muted"
                  >
                    <span
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Self-service                                                               */
/* -------------------------------------------------------------------------- */

function SelfService() {
  return (
    <section className="border-b border-border">
      <Well className="grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-20">
        <div className="flex flex-col gap-6">
          <SectionHeading
            eyebrow="Self-service"
            title="Let the table order for itself"
            lede="Switch guest ordering on for a table and it gets a printable code. A guest scans it, sees your menu, and orders from their own phone — no app to install and nothing to sign up for."
          />

          <ul className="flex flex-col gap-4">
            {[
              {
                title: "It is not a second ordering system",
                body: "A guest order is an ordinary order on that table, with a number from the same sequence. Your waiters, your kitchen and your billing see it without learning anything new.",
              },
              {
                title: "Nothing cooks without your staff",
                body: "Guest lines arrive waiting to be sent. Your team still puts them through to the kitchen, so nobody holding a photograph of a code can put food on a stove.",
              },
              {
                title: "Codes are yours to control",
                body: "Turn ordering off for the evening without reprinting a thing. Issue a new code and every card already printed for that table stops working immediately.",
              },
            ].map((point) => (
              <li key={point.title} className="flex flex-col gap-1 border-l-2 border-primary-border pl-4">
                <h3 className="text-base font-semibold text-text">{point.title}</h3>
                <p className="text-sm text-muted">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-[18rem]">
          <PhonePreview />
        </div>
      </Well>
    </section>
  );
}

/**
 * The guest ordering screen, at phone size.
 *
 * The same reasoning as the floor preview: real tokens, real layout, no screenshot to
 * go stale. The device frame is the only invented part, and it is there so the thing
 * reads as a phone at a glance.
 */
function PhonePreview() {
  const items = [
    { name: "Soup of the day", price: "4.50", chosen: 0 },
    { name: "Chicken burger", price: "12.50", chosen: 2 },
    { name: "Cola", price: "2.50", chosen: 1 },
  ] as const;

  return (
    <div
      role="img"
      aria-label="An illustration of the guest ordering screen on a phone: the restaurant name, the table, three menu items with steppers, and a button reading order three items for twenty seven fifty."
      className="rounded-[1.75rem] border border-border-strong bg-surface-3 p-2 shadow-lg"
    >
      <div className="overflow-hidden rounded-[1.35rem] border border-border bg-canvas">
        <div className="border-b border-border bg-surface px-4 py-3">
          <p className="font-mono text-2xs tracking-wide text-subtle uppercase">
            Table 7
          </p>
          <p className="text-base font-semibold text-text">The Pine Room</p>
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-text">
                  {item.name}
                </span>
                <span className="font-mono text-2xs text-muted tabular">
                  {item.price}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                {item.chosen > 0 && (
                  <span className="font-mono text-xs font-semibold text-text tabular">
                    {item.chosen}
                  </span>
                )}
                <span
                  className="flex size-7 items-center justify-center rounded-md border border-primary-solid bg-primary-solid text-primary-fg"
                  aria-hidden="true"
                >
                  <span className="text-sm leading-none">+</span>
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border bg-surface p-3">
          <span className="flex h-10 items-center justify-center rounded-md bg-primary-solid px-3 text-sm font-medium text-primary-fg">
            Order 3 items · 27.50
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Access model                                                               */
/* -------------------------------------------------------------------------- */

function AccessModel() {
  return (
    <section id="access" className="scroll-mt-16 border-b border-border bg-surface">
      <Well className="flex flex-col gap-12 py-20 sm:py-24">
        <SectionHeading
          eyebrow="Access"
          title="Accounts are issued, not requested"
          lede="Nobody signs themselves up. A platform administrator creates the restaurant and hands it to the manager who runs it; that manager issues accounts to their own staff. Every account therefore arrives attached to one restaurant and one role."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              step: "01",
              title: "The platform administrator sets up the restaurant",
              body: "They create it and issue its manager an account. One restaurant has exactly one manager, and the platform refuses a second.",
            },
            {
              step: "02",
              title: "The manager sets up the room",
              body: "Tables, menu, stock and settings, then accounts for their own waiters and chefs. Deactivating somebody ends their shift immediately rather than when a token expires.",
            },
            {
              step: "03",
              title: "Everybody signs in to their own workspace",
              body: "One sign-in page, and what somebody reaches is decided by the account they were given — checked on every request, not by which links were rendered.",
            },
          ].map((item) => (
            <article
              key={item.step}
              className="flex flex-col gap-3 rounded-xl border border-border bg-canvas p-5"
            >
              <span className="font-mono text-sm font-semibold text-primary">
                {item.step}
              </span>
              <h3 className="text-base font-semibold text-text">{item.title}</h3>
              <p className="text-sm text-muted">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-primary-border bg-primary-soft p-5 sm:flex-row sm:items-start sm:gap-5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-solid text-primary-fg"
            aria-hidden="true"
          >
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-text">
              One restaurant cannot see another
            </h3>
            <p className="max-w-3xl text-sm text-muted">
              A manager reaches their own restaurant and nothing else. No request
              anywhere in the product accepts a restaurant identifier from the
              browser — it is derived from the account — and an identifier belonging
              to somebody else is answered exactly as one that was never issued, so
              it cannot even be used to find out that it exists.
            </p>
          </div>
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
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(48rem 24rem at 50% 120%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />

      <Well className="flex flex-col items-center gap-6 py-24 text-center sm:py-28">
        <Eyebrow>Ready when you are</Eyebrow>
        <h2 className="max-w-2xl text-3xl font-semibold text-text sm:text-5xl">
          Open the room and get on with service
        </h2>
        <p className="max-w-xl text-base text-muted sm:text-lg">
          Sign in with the account your administrator issued. If you do not have one
          yet, they are the person to ask.
        </p>
        <WorkspaceLink className="h-11 px-6 text-base" />
      </Well>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <Well className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted">
            Restaurant operations, from the table to the till.
          </p>
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-2">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded text-sm text-muted transition-colors hover:text-text"
            >
              {item.label}
            </a>
          ))}
          <WorkspaceTextLink />
        </nav>
      </Well>
    </footer>
  );
}
