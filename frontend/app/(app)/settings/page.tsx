"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { SETTINGS_SECTIONS } from "@/components/layout/settings-nav";
import { getMyRestaurant } from "@/features/restaurants/api";
import { listTables } from "@/features/tables/api";
import { listStaff } from "@/features/staff/api";
import { listInventory } from "@/features/inventory/api";
import { listCustomers } from "@/features/customers/api";
import { cn } from "@/lib/utils/cn";
import type { Restaurant } from "@/types/restaurant";
import type { RestaurantTable } from "@/types/table";
import type { StaffMember } from "@/types/staff";
import type { InventoryOverview } from "@/types/inventory";
import type { Customer } from "@/types/customer";

/**
 * The landing page of the settings area, as a picture of how the setup stands.
 *
 * The rail beside it reaches every one of these in a click, so this page earns its
 * place by saying what the rail cannot: how each part is doing right now. Each card
 * carries a live figure from its own list - tables and seats, the team, what is
 * running low, the size of the customer book - and flags the one thing worth doing
 * next, and the panel on top says how complete the restaurant's own profile is.
 *
 * Every figure is read from the same endpoints the pages behind it use. One that
 * fails to load simply leaves its card without a figure; this page is a signpost,
 * and a signpost with a missing number is still a signpost.
 *
 * Role is enforced by the layout, which wraps this and every screen in the area.
 */
export default function SettingsPage() {
  const setup = useSetup();

  return (
    <>
      <PageHeader
        title="Settings"
        description="The parts of the restaurant you set up once and revisit occasionally."
      />

      <PageBody>
        <SetupPanel setup={setup} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {SETTINGS_SECTIONS.map((section, sectionIndex) => {
            const tone = SECTION_TONES[sectionIndex % SECTION_TONES.length]!;

            return (
              <section key={section.title} className="flex flex-col gap-2">
                {/* The group, as a coloured band: what kind of thing lives here. */}
                <div
                  className="flex flex-col gap-0.5 rounded-2xl px-4 py-3"
                  style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
                >
                  <h2 className="text-2xs font-semibold tracking-wider uppercase" style={{ color: tone }}>
                    {section.title}
                  </h2>
                  <p className="text-xs text-muted">{section.description}</p>
                </div>

                <ul className="flex flex-col gap-2">
                  {section.links.map((link) => (
                    <li key={link.href} className="flex">
                      <HubCard
                        href={link.href}
                        icon={link.icon}
                        label={link.label}
                        description={link.description}
                        tone={tone}
                        status={statusFor(link.href, setup)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

/** The console's tile colours, one per settings group. */
const SECTION_TONES = ["var(--chart-1)", "var(--chart-3)", "var(--chart-6)"];

/* ------------------------------------------------------------------- data --- */

interface Setup {
  restaurant: Restaurant | null | undefined;
  tables: RestaurantTable[] | null | undefined;
  staff: StaffMember[] | null | undefined;
  inventory: InventoryOverview | null | undefined;
  customers: Customer[] | null | undefined;
}

/**
 * Everything the hub counts, read once.
 *
 * `undefined` while loading, `null` if that one read failed - so a card can tell
 * "still coming" from "not available" and show a placeholder only for the first.
 */
function useSetup(): Setup {
  const [setup, setSetup] = useState<Setup>({
    restaurant: undefined,
    tables: undefined,
    staff: undefined,
    inventory: undefined,
    customers: undefined,
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      getMyRestaurant(),
      listTables(),
      listStaff(),
      listInventory(false),
      listCustomers({ search: "", includeInactive: false }),
    ]).then(([restaurant, tables, staff, inventory, customers]) => {
      if (cancelled) {
        return;
      }

      const value = <T,>(result: PromiseSettledResult<T>) =>
        result.status === "fulfilled" ? result.value : null;

      setSetup({
        restaurant: value(restaurant),
        tables: value(tables),
        staff: value(staff),
        inventory: value(inventory),
        customers: value(customers),
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return setup;
}

/** Profile completeness, counted from the optional fields rather than scored. */
function profileOf(restaurant: Restaurant) {
  const fields = [
    restaurant.addressLine,
    restaurant.city,
    restaurant.country,
    restaurant.contactEmail,
    restaurant.contactPhone,
  ];
  const filled = fields.filter((value) => value !== null && value !== "").length;

  return { filled, total: fields.length };
}

interface CardStatus {
  /** The live figure, or null when there is none to show. */
  figure: string | null;
  /** Something worth doing, said on the card only while it is true. */
  flag: string | null;
  loading: boolean;
}

/** What each card says, from the list behind it. */
function statusFor(href: string, setup: Setup): CardStatus {
  const loading = (value: unknown) => value === undefined;

  switch (href) {
    case "/settings/restaurant": {
      if (!setup.restaurant) {
        return { figure: null, flag: null, loading: loading(setup.restaurant) };
      }
      const { filled, total } = profileOf(setup.restaurant);

      return {
        figure: `${filled} of ${total} details added`,
        flag: filled < total ? "Guests and receipts use these" : null,
        loading: false,
      };
    }

    case "/settings/website":
      if (!setup.restaurant) {
        return { figure: null, flag: null, loading: loading(setup.restaurant) };
      }

      return setup.restaurant.subdomain === null
        ? { figure: "Not published yet", flag: "Pick a design and publish", loading: false }
        : { figure: `Live at ${setup.restaurant.subdomain}`, flag: null, loading: false };

    case "/settings/tables": {
      if (!setup.tables) {
        return { figure: null, flag: null, loading: loading(setup.tables) };
      }
      const active = setup.tables.filter((table) => table.isActive);
      const seats = active.reduce((sum, table) => sum + table.capacity, 0);

      return {
        figure: `${setup.tables.length} ${setup.tables.length === 1 ? "table" : "tables"} · ${seats} seats in service`,
        flag: setup.tables.length === 0 ? "Add tables to start taking orders" : null,
        loading: false,
      };
    }

    case "/settings/staff": {
      if (!setup.staff) {
        return { figure: null, flag: null, loading: loading(setup.staff) };
      }
      const active = setup.staff.filter((member) => member.isActive);

      return {
        figure: `${active.length} active of ${setup.staff.length}`,
        flag: active.length === 0 ? "Nobody can take an order yet" : null,
        loading: false,
      };
    }

    case "/settings/inventory": {
      if (!setup.inventory) {
        return { figure: null, flag: null, loading: loading(setup.inventory) };
      }
      const needing = setup.inventory.lowStockCount + setup.inventory.outOfStockCount;

      return {
        figure: `${setup.inventory.activeCount} ${setup.inventory.activeCount === 1 ? "item" : "items"} on the shelves`,
        flag:
          setup.inventory.negativeCount > 0
            ? `${setup.inventory.negativeCount} below zero`
            : needing > 0
              ? `${needing} low or out`
              : null,
        loading: false,
      };
    }

    case "/settings/customers":
      if (!setup.customers) {
        return { figure: null, flag: null, loading: loading(setup.customers) };
      }

      return {
        figure: `${setup.customers.length} in your book`,
        flag: null,
        loading: false,
      };

    default:
      return { figure: null, flag: null, loading: false };
  }
}

/* --------------------------------------------------------------- the panel --- */

/**
 * How the setup stands, in ink: the restaurant, how complete its profile is, and
 * the single most useful next step - the same "one decision" idea as the estate
 * panel on the platform overview.
 */
function SetupPanel({ setup }: { setup: Setup }) {
  if (setup.restaurant === undefined) {
    return <Skeleton className="h-36 rounded-2xl bg-contrast/80" />;
  }

  if (setup.restaurant === null) {
    return null;
  }

  const { filled, total } = profileOf(setup.restaurant);
  const noTables = setup.tables !== undefined && setup.tables !== null && setup.tables.length === 0;
  const noStaff =
    setup.staff !== undefined && setup.staff !== null && setup.staff.filter((member) => member.isActive).length === 0;

  // Priority order: what stops trading, then what guests see, then the website.
  const next = noTables
    ? { href: "/settings/tables", label: "Add your tables", note: "Nothing can be ordered until a table exists." }
    : noStaff
      ? { href: "/settings/staff", label: "Add your team", note: "Waiters and chefs need accounts to work a service." }
      : filled < total
        ? { href: "/settings/restaurant", label: "Finish the profile", note: "Guests and receipts show your address and contacts." }
        : setup.restaurant.subdomain === null
          ? { href: "/settings/website", label: "Publish your website", note: "Four designs, built from your own menu." }
          : null;

  return (
    <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-contrast p-5 text-contrast-fg sm:flex-row sm:items-center sm:justify-between">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)" }}
      />

      <div className="flex min-w-0 flex-col gap-3">
        <span className="text-2xs font-semibold tracking-wider text-accent uppercase">Your setup</span>
        <h2 className="truncate text-2xl font-semibold tracking-tight">{setup.restaurant.name}</h2>
        <div className="flex max-w-sm flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-contrast-muted">Profile</span>
            <span className="tabular font-semibold">
              {filled} of {total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-contrast-raised">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${(filled / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {next === null ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <CircleCheck className="size-5 text-accent" aria-hidden="true" />
          Everything is set up.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <p className="max-w-xs text-xs text-contrast-muted">{next.note}</p>
          <Link
            href={next.href}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-transform hover:-translate-y-0.5"
          >
            {next.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the card --- */

function HubCard({
  href,
  icon: Icon,
  label,
  description,
  tone,
  status,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  tone: string;
  status: CardStatus;
}) {
  return (
    <Link
      href={href}
      className="group ui-surface flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
          aria-hidden="true"
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-text">{label}</span>
          {status.loading ? (
            <Skeleton className="mt-1 h-3 w-24" />
          ) : status.figure !== null ? (
            <span className="tabular truncate text-xs font-medium text-muted">{status.figure}</span>
          ) : null}
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-text"
          aria-hidden="true"
        />
      </span>

      <span className="text-xs text-muted">{description}</span>

      {status.flag !== null && (
        <span className={cn("flex w-fit items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-2xs font-semibold text-warning")}>
          <TriangleAlert className="size-3" aria-hidden="true" />
          {status.flag}
        </span>
      )}
    </Link>
  );
}
