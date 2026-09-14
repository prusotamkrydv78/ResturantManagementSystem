"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  animate,
  motion,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  Armchair,
  Ban,
  CalendarDays,
  ChartNoAxesColumn,
  ChefHat,
  CircleCheck,
  ClipboardList,
  Flame,
  Plus,
  ReceiptText,
  RefreshCw,
  Settings,
  Star,
  Store,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-context";
import { isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { listManagers } from "@/features/managers/api";
import { getMyRestaurant, listRestaurants } from "@/features/restaurants/api";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getManagerDashboard } from "@/features/dashboard/api";
import { getPlatformPulse } from "@/features/platform/api";
import { sinceLabel, timeOf, useNow } from "@/lib/time/since";
import {
  HourCard,
  LeaderboardCard,
  RecentDaysCard,
  TenderCard,
} from "@/features/analytics/charts";
import { listKitchenTickets } from "@/features/kitchen/api";
import { getWaiterContext, listOpenOrders } from "@/features/orders/api";
import type { Manager } from "@/types/manager";
import type { PlatformPulse } from "@/types/platform";
import type { Restaurant, RestaurantSummary } from "@/types/restaurant";
import type {
  ActivityEntry,
  ActivityKind,
  Floor,
  KitchenLoad,
  ManagerDashboard,
  OrderActivity,
  Readiness,
} from "@/types/dashboard";
import type { KitchenTicket } from "@/types/kitchen";
import type { OrderSummary, WaiterContext } from "@/types/order";

/**
 * Role-aware landing page.
 *
 * Every number here is derived from data the API actually returns. Nothing is
 * invented: there are no orders, revenue or customer figures in the system yet,
 * so none are shown.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={descriptionFor(user?.platformRole)}
      />
      <PageBody>
        {user?.platformRole === "SuperAdmin" && <SuperAdminOverview />}
        {user?.platformRole === "RestaurantManager" && <ManagerOverview />}
        {user?.platformRole === "Staff" && <StaffWorkspace role={user.staffRole} />}
        {user?.platformRole === "User" && <NoAccessOverview />}
      </PageBody>
    </>
  );
}

function descriptionFor(role: string | undefined): string {
  switch (role) {
    case "SuperAdmin":
      return "Platform overview. Create restaurants and assign their managers.";
    case "RestaurantManager":
      return "What is happening in your restaurant right now.";
    case "Staff":
      return "Your shift workspace.";
    default:
      return "Your account is active.";
  }
}

/* -------------------------------------------------------------------------- */
/* Super Admin                                                                */
/* -------------------------------------------------------------------------- */

function SuperAdminOverview() {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[] | null>(null);
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);
  const [pulseError, setPulseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedRestaurants, loadedManagers] = await Promise.all([
          listRestaurants(),
          listManagers(),
        ]);
        if (!cancelled) {
          setRestaurants(loadedRestaurants);
          setManagers(loadedManagers);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the overview.",
          );
        }
      }
    }

    // Trading is fetched on its own and allowed to fail on its own. It is the
    // one call on this screen that reads every order and payment on the
    // platform, so if it ever gets slow or falls over, the estate below still
    // draws and the admin can still do the work this page exists for.
    async function loadPulse() {
      try {
        const loaded = await getPlatformPulse();
        if (!cancelled) {
          setPulse(loaded);
          setPulseError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setPulseError(
            caught instanceof Error
              ? caught.message
              : "Unable to read today's trading.",
          );
        }
      }
    }

    void load();
    void loadPulse();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Provisioning is quiet until it is not: a second admin can assign a manager
  // while this screen sits open, leaving the "needs a manager" banner stale.
  // The same thirty-second beat the manager overview uses, plus a refresh when
  // the tab comes back into view.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), 30_000);
    const onFocus = () => setReloadKey((key) => key + 1);

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Surface>
    );
  }

  const unassigned = restaurants?.filter((r) => r.managerId === null) ?? [];
  const freeManagers = managers?.filter((m) => !m.isAssigned) ?? [];
  // Ready to trade means exactly two things: somebody runs it and it is in
  // service. The estate bar reads these three buckets and nothing else, so its
  // segments, its legend and its verdict can never disagree.
  const readyCount =
    restaurants?.filter((r) => r.managerId !== null && r.isActive).length ?? 0;
  const suspendedCount = restaurants?.filter((r) => !r.isActive).length ?? 0;
  // The staffable slice of unassigned: active rooms with nobody running them.
  // A suspended room without a manager belongs to the suspended bucket in the
  // bar below, so the segments always add up to the whole estate.
  const awaitingCount =
    restaurants?.filter((r) => r.managerId === null && r.isActive).length ?? 0;
  const totalCount = restaurants?.length ?? 0;
  // Everything that needs an admin, unassigned first. Suspension outranks
  // assignment in the sort for the same reason it does on the badge: a
  // suspended room is not trading at all, whoever runs it.
  const attention = [...(restaurants ?? [])]
    .filter((r) => r.managerId === null || !r.isActive)
    .sort(
      (a, b) =>
        Number(a.managerId !== null) - Number(b.managerId !== null) ||
        timeOf(b.createdAtUtc) - timeOf(a.createdAtUtc),
    );
  const setupComplete =
    restaurants !== null && restaurants.length > 0 && unassigned.length === 0;

  const rows = pulse?.restaurants ?? [];

  // Trading, busiest first. A room with an order still running belongs here
  // even if it has taken nothing yet today: the money has not arrived, but
  // somebody is sitting at a table.
  const trading = rows
    .filter((row) => row.ordersToday > 0 || row.openOrders > 0)
    .sort(
      (a, b) =>
        b.takingsToday - a.takingsToday ||
        b.ordersToday - a.ordersToday ||
        a.name.localeCompare(b.name),
    );

  // Open orders on a day that saw no orders: a table somebody walked away from
  // and nobody closed. It holds the table, it sits in that manager's billing
  // list indefinitely, and the manager is the least likely person to notice,
  // because their own screens show it as perfectly ordinary work in progress.
  const strays = rows.filter((row) => row.openOrders > 0 && row.ordersToday === 0);

  // Staffed, switched on, and not one order all day. Either the room is shut or
  // the install is broken, and this is the only screen in the product where the
  // difference can be seen at all: the manager of a restaurant that is quiet
  // because its QR codes stopped working sees an empty screen and believes it.
  const quiet = rows
    .filter(
      (row) =>
        row.isActive && row.hasManager && row.ordersToday === 0 && row.openOrders === 0,
    )
    .sort((a, b) => timeOf(a.lastOrderAtUtc ?? "") - timeOf(b.lastOrderAtUtc ?? ""));

  // The three groups, worst first, flattened to one shape so the list does not
  // have to know which query a row came from.
  const flagGroups: FlagGroup[] = [
    {
      title: "Orders left open",
      note: "running since before today",
      rows: strays.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        tone: "danger" as const,
        badge: `${row.openOrders} open`,
        meta: `last order ${sinceLabel(row.lastOrderAtUtc, now)}`,
      })),
    },
    {
      title: "Cannot trade",
      note: "suspended, or nobody running it",
      rows: attention.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        // Suspension outranks assignment here as it does on the restaurants
        // page: a suspended room is not trading at all, whoever runs it.
        tone: (restaurant.isActive ? "warning" : "danger") as "warning" | "danger",
        badge: restaurant.isActive ? "Unassigned" : "Suspended",
        meta: restaurant.managerName,
      })),
    },
    {
      title: "Quiet today",
      note: "staffed and in service, nothing ordered",
      rows: quiet.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        tone: "neutral" as const,
        badge: row.lastOrderAtUtc === null ? "Never traded" : null,
        meta:
          row.lastOrderAtUtc === null
            ? null
            : `last order ${sinceLabel(row.lastOrderAtUtc, now)}`,
      })),
    },
  ].filter((group) => group.rows.length > 0);

  const flagged = flagGroups.reduce((sum, group) => sum + group.rows.length, 0);

  // The one decision this screen exists to produce, in priority order:
  // staff the unstaffed, review the suspended, otherwise read the reports.
  const heroAction =
    awaitingCount > 0 ? (
      freeManagers.length > 0 ? (
        <LinkButton href="/admin/restaurants" size="sm">
          Assign now
        </LinkButton>
      ) : (
        <LinkButton href="/admin/managers" size="sm">
          Create manager
        </LinkButton>
      )
    ) : suspendedCount > 0 ? (
      <LinkButton href="/admin/restaurants" variant="secondary" size="sm">
        Review restaurants
      </LinkButton>
    ) : totalCount > 0 ? (
      <LinkButton href="/admin/reports" variant="secondary" size="sm">
        View reports
      </LinkButton>
    ) : null;

  const verdictParts: string[] = [];

  if (awaitingCount > 0) {
    verdictParts.push(
      `${awaitingCount} ${awaitingCount === 1 ? "restaurant" : "restaurants"} cannot trade without a manager. ${
        freeManagers.length > 0
          ? `${freeManagers.length} ${freeManagers.length === 1 ? "manager is" : "managers are"} free.`
          : "No managers are free."
      }`,
    );
  }

  if (suspendedCount > 0) {
    verdictParts.push(
      `${suspendedCount} ${suspendedCount === 1 ? "restaurant is" : "restaurants are"} suspended and taking no orders.`,
    );
  }

  if (verdictParts.length === 0 && totalCount > 0) {
    verdictParts.push("Every restaurant has a manager and is in service.");
  }

  const heroVerdict = verdictParts.join(" ");

  const provisioning = !setupComplete && restaurants !== null && (
    <Surface>
      <SurfaceHeader
        title="Get the platform trading"
        description="Two steps before a restaurant can take its first order."
      />
      <ol className="flex flex-col divide-y divide-border">
        <li className="flex flex-wrap items-center gap-3 px-4 py-3">
          <StepMark done={restaurants.length > 0} index={1} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Create a restaurant</p>
            <p className="text-xs text-muted">Name and slug — the manager comes next.</p>
          </div>
          {restaurants.length === 0 && (
            <LinkButton href="/admin/restaurants/new" variant="secondary" size="sm">
              New restaurant
            </LinkButton>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-3 px-4 py-3">
          <StepMark done={restaurants.length > 0 && unassigned.length === 0} index={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Assign a manager</p>
            <p className="text-xs text-muted">
              {restaurants.length === 0
                ? "Available once the first restaurant exists."
                : unassigned.length === 0
                  ? "Every restaurant has someone running it."
                  : `${unassigned.length} ${unassigned.length === 1 ? "restaurant is" : "restaurants are"} waiting for someone to run them.`}
            </p>
          </div>
          {restaurants.length > 0 && unassigned.length > 0 && (
            <LinkButton href="/admin/restaurants" variant="secondary" size="sm">
              Assign now
            </LinkButton>
          )}
        </li>
      </ol>
    </Surface>
  );

  return (
    <>
      {/* An empty platform has nothing to trade and nothing to be healthy
          about, so it gets the checklist and only the checklist. Everything
          below is written for an estate that already exists. */}
      {totalCount === 0 && provisioning}

      {/* Today, first, once there is anything to sell.

          The checklist used to open this screen and kept opening it long after
          it read "all done", which is the wrong question by the second week.
          After setup, the question an operator has every morning is whether the
          platform is taking money, so that is what the top of the page answers
          now, and the checklist drops below it. */}
      {totalCount > 0 && (
        <TradingToday
          pulse={pulse}
          error={pulseError}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {totalCount > 0 && provisioning}

      {/* The charts.
 
          Today and the days either side of it, and nothing further back. This
          page and the platform report had grown into two answers to the same
          question - both drew a fortnight, both split it by restaurant, and
          neither was the obvious place to look. They are split by what a reader
          is doing instead: this is the live screen, so it answers how the week
          is going, when today actually happened, how the money arrived and who
          is carrying it. Anything with a date range on it belongs to the
          report, which can compare that range with the one before it. */}
      {pulse !== null && totalCount > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RecentDaysCard days={pulse.days} />
          </div>
          <TenderCard byMethod={pulse.byMethodToday} />
        </div>
      )}

      {pulse !== null && totalCount > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <HourCard hours={pulse.hours} currentHour={nepalHourOf(pulse.serverUtcNow)} />
          </div>
          <LeaderboardCard rows={pulse.restaurants} />
        </div>
      )}

      {/* The estate, as one panel.

          This used to be a full-width bar with three dots under it, followed by
          a row of four cards carrying one number each. On a platform with one
          restaurant that is five boxes to say "one restaurant, one manager",
          and the whitespace made the page look like it had failed to load.
          Same figures, a quarter of the room: the ring carries the split, and
          the counts run along the bottom as a strip rather than as cards. */}
      {restaurants !== null && totalCount > 0 && (
        <Surface className="flex flex-col">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4 p-4">
            <EstateRing
              ready={readyCount}
              awaiting={awaitingCount}
              suspended={suspendedCount}
              total={totalCount}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                Estate health
              </span>
              <p className="tabular text-xl leading-tight font-semibold text-text">
                {readyCount} of {totalCount} ready to trade
              </p>
              <p className="text-xs text-muted">{heroVerdict}</p>

              {/* Every bucket listed even at zero, so a zero reads as a zero
                  rather than a gap — the rule the reports tables follow. */}
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <Legend tone="success">{readyCount} ready</Legend>
                <Legend tone="warning">{awaitingCount} need a manager</Legend>
                <Legend tone="danger">{suspendedCount} suspended</Legend>
              </div>
            </div>

            {heroAction !== null && <div className="shrink-0">{heroAction}</div>}
          </div>

          {/* Four counts, four destinations. A figure an admin cannot act on is
              decoration, so each tile is the whole hit area. */}
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0">
            <EstateTile
              label="Restaurants"
              value={restaurants.length}
              href="/admin/restaurants"
            />
            <EstateTile
              label="Awaiting a manager"
              value={unassigned.length}
              tone={unassigned.length > 0 ? "warning" : "neutral"}
              href="/admin/restaurants"
            />
            <EstateTile
              label="Managers"
              value={managers?.length}
              isLoading={managers === null}
              href="/admin/managers"
            />
            <EstateTile
              label="Managers free"
              value={freeManagers.length}
              tone={freeManagers.length > 0 ? "warning" : "neutral"}
              isLoading={managers === null}
              href="/admin/managers"
            />
          </div>
        </Surface>
      )}

      {/* Trading now. The table an operator watches during a service. */}
      {pulse !== null && trading.length > 0 && (
        <Surface>
          <SurfaceHeader
            title="Trading today"
            description={`${pulse.tradingToday} of ${totalCount} ${totalCount === 1 ? "restaurant has" : "restaurants have"} opened an order today.`}
            actions={
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
              >
                Full report
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <TableWrap>
            <Table>
              <thead>
                <Tr>
                  <Th>Restaurant</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Takings</Th>
                  <Th className="text-right">Open</Th>
                  <Th className="text-right">At pass</Th>
                  <Th className="text-right">Last order</Th>
                </Tr>
              </thead>
              <tbody>
                {trading.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="font-medium text-text">{row.name}</span>
                      <span className="block font-mono text-2xs text-subtle">
                        {row.slug}
                      </span>
                    </Td>
                    <Td className="tabular text-right">{row.ordersToday}</Td>
                    <Td className="tabular text-right">{row.takingsToday.toFixed(2)}</Td>
                    <Td className="tabular text-right">
                      {row.openOrders === 0 ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        row.openOrders
                      )}
                    </Td>
                    {/* Plates cooked and not carried out. A number that stays
                        high while orders keep arriving is a room where food is
                        going cold under the lamp, and nobody outside that
                        kitchen can currently see it happening. */}
                    <Td className="tabular text-right">
                      {row.platesAtPass === 0 ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <span
                          className={
                            row.platesAtPass >= BUSY_PASS ? "font-semibold text-warning" : ""
                          }
                        >
                          {row.platesAtPass}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right text-xs text-muted">
                      {sinceLabel(row.lastOrderAtUtc, now)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Surface>
      )}

      {/* One card, three groups, worst first.

          These were three cards, and on a healthy platform two of them were
          empty and the third held a single line — three headers and three
          borders to say one thing. Whether a room is suspended, holding a
          stray order or simply quiet, the reader's next move is the same, so
          they queue in one list under headings instead of in three panels. */}
      {restaurants !== null && (
        <Surface>
          <SurfaceHeader
            title="Needs a look"
            description={
              flagged === 0
                ? "Nothing is stuck, unassigned or silent."
                : `${flagged} ${flagged === 1 ? "restaurant" : "restaurants"} worth opening, worst first.`
            }
            actions={
              <Link
                href="/admin/restaurants"
                className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
              >
                Open restaurants
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />

          {flagged === 0 ? (
            <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted">
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
              {/* The trading half of this claim comes from the pulse, so it is only
                  made once the pulse has actually answered. An all-clear that turns
                  out to have been a loading state is worse than no all-clear. */}
              {pulse === null
                ? "Every restaurant has a manager and is in service."
                : "Every restaurant has a manager, is in service, and has traded today."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {flagGroups.map((group) => (
                <li key={group.title}>
                  <p className="flex items-baseline gap-2 bg-surface-2 px-4 py-1.5">
                    <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                      {group.title}
                    </span>
                    <span className="text-2xs text-subtle">— {group.note}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {group.rows.map((row) => (
                      <FlagRow key={`${group.title}-${row.id}`} row={row} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      )}
    </>
  );
}

/**
 * The estate split, as a ring.
 *
 * A ring rather than the bar that used to sit here, for one reason that is only
 * obvious on a real platform: a bar has to be as wide as its card, and the card is as
 * wide as the page. Three numbers stretched across a widescreen monitor read as a
 * loading state. A ring is the same information at a size that matches how much of it
 * there is, and it leaves the row beside it for the sentence that says what to do.
 */
function EstateRing({
  ready,
  awaiting,
  suspended,
  total,
}: {
  ready: number;
  awaiting: number;
  suspended: number;
  total: number;
}) {
  const RADIUS = 26;
  const circumference = 2 * Math.PI * RADIUS;
  const safeTotal = Math.max(total, 1);

  const segments = [
    { key: "ready", value: ready, colour: "var(--success)" },
    { key: "awaiting", value: awaiting, colour: "var(--warning)" },
    { key: "suspended", value: suspended, colour: "var(--danger)" },
  ];

  // Each arc starts where the ones before it ended. Summed rather than accumulated in
  // a running variable, because three additions cost nothing and a loop that mutates
  // as it maps is the kind of thing that quietly breaks when somebody reorders it.
  const arcs = segments.map((segment, index) => ({
    ...segment,
    before: segments
      .slice(0, index)
      .reduce((sum, earlier) => sum + earlier.value, 0),
  }));

  return (
    <div className="relative size-16 shrink-0">
      <svg
        viewBox="0 0 64 64"
        className="size-full -rotate-90"
        role="img"
        aria-label={`${ready} ready, ${awaiting} need a manager, ${suspended} suspended`}
      >
        <circle
          cx={32}
          cy={32}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={8}
        />
        {arcs
          .filter((arc) => arc.value > 0)
          .map((arc) => {
            const length = (arc.value / safeTotal) * circumference;

            return (
              <circle
                key={arc.key}
                cx={32}
                cy={32}
                r={RADIUS}
                fill="none"
                stroke={arc.colour}
                strokeWidth={8}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-(arc.before / safeTotal) * circumference}
              />
            );
          })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-sm font-semibold text-text">
          {total === 0 ? "—" : `${Math.round((ready / safeTotal) * 100)}%`}
        </span>
      </span>
    </div>
  );
}

/** A dot and a count, in the ring's own colours. */
function Legend({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", LEGEND_DOTS[tone])}
      />
      {children}
    </span>
  );
}

const LEGEND_DOTS: Record<"success" | "warning" | "danger", string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * One count in the strip along the bottom of the estate panel.
 *
 * Smaller type than the cards it replaced, on purpose. These are counts of things
 * that exist, not figures anybody is watching move; the money at the top of the page
 * is what deserves to be read from across a room.
 */
function EstateTile({
  label,
  value,
  tone = "neutral",
  isLoading,
  href,
}: {
  label: string;
  value: number | undefined;
  tone?: "neutral" | "warning";
  isLoading?: boolean;
  href: string;
}) {
  const loading = isLoading ?? value === undefined;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <span className="flex items-center gap-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
        <ArrowRight
          className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </span>
      {loading ? (
        <Skeleton className="my-0.5 h-6 w-8" />
      ) : (
        <span
          className={cn(
            "tabular text-xl font-semibold",
            tone === "warning" && (value ?? 0) > 0 ? "text-warning" : "text-text",
          )}
        >
          {value}
        </span>
      )}
    </Link>
  );
}

/** One restaurant in the needs-a-look list, whichever group it came from. */
interface Flag {
  id: string;
  name: string;
  slug: string;
  tone: "danger" | "warning" | "neutral";
  badge: string | null;
  meta: string | null;
}

/** One heading and the rows under it. */
interface FlagGroup {
  title: string;
  note: string;
  rows: Flag[];
}

const FLAG_CHIPS: Record<Flag["tone"], string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-3 text-muted",
};

const FLAG_BADGES: Record<Flag["tone"], "danger" | "warning" | "neutral"> = {
  danger: "danger",
  warning: "warning",
  neutral: "neutral",
};

/**
 * One row, and the whole row is the link.
 *
 * The rows this replaced were text on the left and text on the right with a lot of
 * nothing in between, which at this width read as two unrelated columns. The initial
 * chip gives the eye something to travel down, carries the severity as colour, and
 * costs no data the row did not already have.
 */
function FlagRow({ row }: { row: Flag }) {
  return (
    <li>
      <Link
        href="/admin/restaurants"
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
            FLAG_CHIPS[row.tone],
          )}
        >
          {row.name.trim().charAt(0).toUpperCase() || "?"}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-text">{row.name}</span>
          <span className="truncate font-mono text-2xs text-subtle">{row.slug}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {row.meta !== null && (
            <span className="hidden text-xs text-muted sm:inline">{row.meta}</span>
          )}
          {row.badge !== null && (
            <Badge tone={FLAG_BADGES[row.tone]} dot>
              {row.badge}
            </Badge>
          )}
          <ArrowRight
            className="size-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * The hour it is in Nepal, from the clock the server sent.
 *
 * Read off the server rather than the browser deliberately: an admin looking at this
 * from another country still needs the column that is lit to be the hour the
 * restaurants are living in, not the hour their own laptop thinks it is.
 */
function nepalHourOf(serverUtcNow: string): number {
  const parsed = new Date(serverUtcNow).getTime();

  if (Number.isNaN(parsed)) {
    return -1;
  }

  return new Date(parsed + NEPAL_OFFSET_MINUTES * 60_000).getUTCHours();
}

/** UTC+05:45. The one boundary every daily figure in this product is counted against. */
const NEPAL_OFFSET_MINUTES = 345;

/**
 * How many plates waiting at one pass is worth colouring.
 *
 * Six is roughly two tables' worth of food sitting under the lamp. Below that a
 * kitchen is simply a step ahead of its waiters, which is the point of a pass.
 */
const BUSY_PASS = 6;

/**
 * What the platform took today, and what is happening on it right now.
 *
 * Two kinds of figure sit side by side here that a dashboard would normally
 * keep apart: money, which is a day's worth of history, and the count of open
 * orders and plates at the pass, which is a photograph of this minute. They
 * belong together because the question is one question. Takings alone cannot
 * tell a closed restaurant from a broken one; open orders alone cannot tell a
 * busy service from a pile of orders nobody ever closed.
 */
function TradingToday({
  pulse,
  error,
  onRetry,
}: {
  pulse: PlatformPulse | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (error !== null) {
    return (
      <Surface className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          Today&rsquo;s trading could not be read. {error}
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </Button>
      </Surface>
    );
  }

  if (pulse === null) {
    return (
      <Surface className="flex flex-col gap-3 p-4 sm:p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-3 w-56" />
      </Surface>
    );
  }

  const { today, yesterday } = pulse;

  // Deliberately not a percentage against yesterday.
  //
  // At ten in the morning the whole platform is "down 80% on yesterday", which
  // is true, useless, and would teach an operator to ignore the number by the
  // end of the first week. Yesterday is shown as what it actually is — a
  // finished day, a line to get past — and only gets called out once today has
  // cleared it.
  const peak = Math.max(today.takings, yesterday.takings, 1);
  const ahead = yesterday.takings > 0 && today.takings >= yesterday.takings;

  return (
    <MotionConfig reducedMotion="user">
      {/* The card arrives rather than appearing.

          This is the first thing on the screen and it is the last thing to have
          data: the estate below is two quick reads, the takings are every order
          and payment on the platform. Cutting straight from a skeleton to a
          finished figure made the whole page feel like it had jumped. The
          stagger is small - a twentieth of a second between pieces - and its
          only job is to make the arrival read as one movement rather than four
          separate flashes. */}
      <motion.div
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        <Surface className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <motion.div variants={RISE} className="flex min-w-0 flex-col gap-1">
              <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                Taken today
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="tabular text-[2rem] leading-10 font-semibold text-text">
                  <Ticker value={today.takings} decimals={2} />
                </p>
                {ahead && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.65, duration: 0.3 }}
                  >
                    <Badge tone="success" dot>
                      Past yesterday
                    </Badge>
                  </motion.span>
                )}
              </div>
              <p className="text-xs text-muted">
                {today.ordersPlaced === 0
                  ? "No orders placed yet today."
                  : `${today.ordersPlaced} ${today.ordersPlaced === 1 ? "order" : "orders"} placed · ${today.completed} settled${today.cancelled > 0 ? ` · ${today.cancelled} cancelled` : ""}${today.averageOrderValue > 0 ? ` · ${today.averageOrderValue.toFixed(2)} average bill` : ""}`}
              </p>
            </motion.div>

            {/* Right now, not today. Three counts that say whether anybody is
                actually eating, which no amount of money taken can answer. */}
            <motion.div variants={RISE} className="flex shrink-0 items-start gap-5">
              <LiveCount icon={Store} value={pulse.tradingToday} label="trading" />
              <LiveCount
                icon={ClipboardList}
                value={pulse.openOrders}
                label="open orders"
              />
              <LiveCount
                icon={Flame}
                value={pulse.platesAtPass}
                label="at the pass"
                tone={pulse.platesAtPass > 0 ? "warning" : "neutral"}
              />
            </motion.div>
          </div>

          {/* Today against a finished day, as two bars on one scale. Bars are
              enough: the point is the gap between them, and the exact figures
              are already written alongside. */}
          <motion.div variants={RISE} className="mt-4 flex flex-col gap-1.5">
            <CompareBar
              label="Today"
              amount={today.takings}
              share={today.takings / peak}
              tone="primary"
            />
            <CompareBar
              label="Yesterday"
              amount={yesterday.takings}
              share={yesterday.takings / peak}
              tone="muted"
              delay={0.12}
            />
          </motion.div>

          <motion.p variants={RISE} className="mt-2.5 text-2xs text-subtle">
            Service day {pulse.localDate} · read at {formatTime(pulse.serverUtcNow)}
 · yesterday is a whole day, today is still running
          </motion.p>
        </Surface>
      </motion.div>
    </MotionConfig>
  );
}

/** Everything in the hero enters the same way, so it enters as one thing. */
const RISE = {
  hidden: { opacity: 0, y: 10 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * A figure that counts up to itself.
 *
 * Not decoration: the number it lands on is the only one on this screen an operator
 * will look for first, and watching it run gives the eye somewhere to be while the
 * rest of the card settles. It also makes a change visible - when the poll comes back
 * thirty seconds later with a bigger figure, the count runs the difference rather
 * than swapping one number for another where nobody was looking.
 *
 * Driven by a motion value rather than by state, so the ninety frames it takes are
 * ninety canvas-free paints and not ninety React renders.
 */
function Ticker({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduced = useReducedMotion();
  const count = useMotionValue(0);
  const text = useTransform(count, (running) =>
    running.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );

  useEffect(() => {
    if (reduced === true) {
      count.set(value);

      return;
    }

    const run = animate(count, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => run.stop();
  }, [count, reduced, value]);

  return <motion.span>{text}</motion.span>;
}

/**
 * One live count in the strip: a number, what it counts, and an icon.
 *
 * Optionally the way to the screen that acts on it. A figure telling a manager that
 * four orders are open is only half an answer; the other half is the billing screen,
 * and making the figure itself the door there saves a trip through the sidebar.
 */
function LiveCount({
  icon: Icon,
  value,
  label,
  tone = "neutral",
  href,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: "neutral" | "warning";
  href?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "tabular flex items-center gap-1.5 text-xl font-semibold",
          tone === "warning" ? "text-warning" : "text-text",
        )}
      >
        <Icon className="size-4 text-subtle" aria-hidden="true" />
        <Ticker value={value} />
      </span>
      <span className="text-2xs whitespace-nowrap text-muted">{label}</span>
    </>
  );

  return href === undefined ? (
    <div className="flex flex-col items-end gap-0.5">{content}</div>
  ) : (
    <Link
      href={href}
      className="flex flex-col items-end gap-0.5 rounded transition-colors hover:[&_span]:text-primary"
    >
      {content}
    </Link>
  );
}

/** One labelled bar in the today-against-yesterday comparison. */
function CompareBar({
  label,
  amount,
  share,
  tone,
  delay = 0,
}: {
  label: string;
  amount: number;
  share: number;
  tone: "primary" | "muted";
  /** Yesterday follows today, so the two bars read in the order they are named. */
  delay?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        {/* Grown rather than drawn at full width. The CSS transition that used to
            be here never fired: the bar's first paint was already its final
            width, and there is nothing for a transition to run from. */}
        <motion.span
          className={cn(
            "block h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-border",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
          transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      <span className="tabular w-24 shrink-0 text-right text-xs text-muted">
        <Ticker value={amount} decimals={2} />
      </span>
    </div>
  );
}

/** Done step gets a tick, pending step its number. */
function StepMark({ done, index }: { done: boolean; index: number }) {
  return done ? (
    <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-2xs font-semibold text-muted"
    >
      {index}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  isLoading,
  href,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  tone?: "neutral" | "warning";
  isLoading?: boolean;
  /** When set, the whole card links there. Only the warning stats use this. */
  href?: string;
}) {
  const loading = isLoading ?? value === undefined;

  const content = (
    <>
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
      </span>
      {loading ? (
        <Skeleton className="my-0.5 h-7 w-10" />
      ) : (
        <span
          className={`tabular text-[1.75rem] leading-9 font-semibold ${
            tone === "warning" && (value ?? 0) > 0 ? "text-warning" : "text-text"
          }`}
        >
          {value}
        </span>
      )}
      <span className="text-xs text-muted">{hint}</span>
    </>
  );

  return href === undefined ? (
    <Surface className="flex flex-col gap-1 px-4 py-3.5">{content}</Surface>
  ) : (
    <Link href={href} className="group block">
      <Surface className="flex h-full flex-col gap-1 px-4 py-3.5 transition-colors group-hover:border-primary-border">
        {content}
      </Surface>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Restaurant Manager                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The manager operational overview.
 *
 * Answers one question: what is happening in this restaurant right now. Every figure
 * is derived by the server from orders, tables, kitchen tickets and payments that
 * already exist, so nothing here is stored, estimated or invented.
 *
 * Scoped to today and to now on purpose. There is no date range, no comparison with
 * yesterday and no chart: those belong to a reporting system this product has not
 * built, and a dashboard that pretends to have one is worse than a plain one.
 *
 * The restaurant profile fields that used to sit here have moved out rather than
 * been removed. They are static, they are already on the restaurant page, and they
 * were pushing live operations below the fold.
 */
function ManagerOverview() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [dashboard, setDashboard] = useState<ManagerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedRestaurant, loadedDashboard] = await Promise.all([
          getMyRestaurant(),
          getManagerDashboard(),
        ]);
        if (!cancelled) {
          setRestaurant(loadedRestaurant);
          setDashboard(loadedDashboard);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          // A manager with no restaurant yet is a real state, not a failure: an
          // admin can create the account and assign the restaurant later. Reported
          // as an error it looked broken, and offered a retry that could never work.
          if (isMissingRestaurant(caught)) {
            setError(null);
          } else {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load your restaurant.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // A quiet refresh on a timer, because this is a screen a manager leaves open
  // during service. Plus one when the tab comes back: a laptop shut at the end of
  // a lunch and opened at dinner should not show lunch.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), 30_000);
    const onFocus = () => setReloadKey((key) => key + 1);

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (isLoading) {
    return (
      <>
        <Surface className="flex flex-col gap-3 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-3 w-64" />
        </Surface>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Surface className="h-64 xl:col-span-2" />
          <Surface className="h-64" />
        </div>
      </>
    );
  }

  if (error !== null) {
    return (
      <Surface>
        <ErrorState
          message={error}
          onRetry={() => {
            setIsLoading(true);
            setReloadKey((key) => key + 1);
          }}
        />
      </Surface>
    );
  }

  if (restaurant === null || dashboard === null) {
    return <NoRestaurantAssigned />;
  }

  const { orders, floor, kitchen, today, yesterday, days, hours, readiness, activity } =
    dashboard;

  // Profile completeness is counted from the optional fields, so the prompt to
  // finish setup reflects the record rather than a made-up score.
  const optional = [
    restaurant.addressLine,
    restaurant.city,
    restaurant.country,
    restaurant.contactEmail,
    restaurant.contactPhone,
  ];
  const filled = optional.filter((value) => value !== null && value !== "").length;
  const isComplete = filled === optional.length;

  const kitchenLoad = kitchen.pendingCount + kitchen.preparingCount;
  const peak = Math.max(today.paymentTotal, yesterday.takings, 1);
  const ahead = yesterday.takings > 0 && today.paymentTotal >= yesterday.takings;

  return (
    <MotionConfig reducedMotion="user">
      {/* Taken today, and what is happening on the floor while it is being taken.

          The card this replaced led with the restaurant's name, a badge and a
          setup prompt. Useful on the first morning; furniture by the second week.
          What a manager opens this screen for is the money and the room, so that
          is what the top of it answers now. */}
      <motion.div
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        <Surface className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <motion.div variants={RISE} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 text-2xs font-semibold tracking-wider text-subtle uppercase">
                Taken today
                {!readiness.canTakeOrders && (
                  <Badge tone="warning" dot>
                    Not ready to trade
                  </Badge>
                )}
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="tabular text-[2rem] leading-10 font-semibold text-text">
                  <Ticker value={today.paymentTotal} decimals={2} />
                </p>
                {ahead && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.65, duration: 0.3 }}
                  >
                    <Badge tone="success" dot>
                      Past yesterday
                    </Badge>
                  </motion.span>
                )}
              </div>
              <p className="text-xs text-muted">
                {today.paymentCount === 0
                  ? "Nothing settled yet today."
                  : `${today.paymentCount} ${today.paymentCount === 1 ? "bill" : "bills"} settled · ${today.completedCount} ${today.completedCount === 1 ? "order" : "orders"} closed${today.cancelledCount > 0 ? ` · ${today.cancelledCount} cancelled` : ""}`}
              </p>
            </motion.div>

            {/* The room, right now. Three counts a manager acts on rather than
                admires, and each one is the way to the screen that acts on it. */}
            <motion.div variants={RISE} className="flex shrink-0 items-start gap-5">
              <LiveCount
                icon={ClipboardList}
                value={orders.openCount}
                label="open orders"
                href="/billing"
              />
              <LiveCount
                icon={Flame}
                value={kitchenLoad}
                label="in the kitchen"
                tone={kitchen.pendingCount > 0 ? "warning" : "neutral"}
                href="/kitchen"
              />
              <LiveCount
                icon={Armchair}
                value={floor.availableCount}
                label="tables free"
                href="/floor"
              />
            </motion.div>
          </div>

          <motion.div variants={RISE} className="mt-4 flex flex-col gap-1.5">
            <CompareBar
              label="Today"
              amount={today.paymentTotal}
              share={today.paymentTotal / peak}
              tone="primary"
            />
            <CompareBar
              label="Yesterday"
              amount={yesterday.takings}
              share={yesterday.takings / peak}
              tone="muted"
              delay={0.12}
            />
          </motion.div>

          <motion.p variants={RISE} className="mt-2.5 text-2xs text-subtle">
            {restaurant.name} · since {formatDayStart(today.startedAtUtc)} · read at{" "}
            {formatTime(dashboard.generatedAtUtc)}
          </motion.p>
        </Surface>
      </motion.div>

      {/* Anything actually demanding attention, said plainly and only when true. */}
      <ManagerAlerts
        orders={orders}
        kitchen={kitchen}
        readiness={readiness}
        floor={floor}
        now={now}
      />

      <ManagerQuickNav />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentDaysCard days={days} />
        </div>
        <TenderCard byMethod={today.byMethod} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HourCard hours={hours} currentHour={nepalHourOf(dashboard.generatedAtUtc)} />
        </div>

        {/* The floor as a shape rather than a number. Occupancy is the one figure
            on this screen a manager can see out of the window, so drawing it is
            what makes the rest of the screen trustworthy. */}
        <Surface className="flex h-full flex-col">
          <SurfaceHeader
            title="The floor"
            description={`${floor.occupiedCount} of ${floor.inServiceCount} in service occupied.`}
            actions={
              <Link
                href="/floor"
                className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
              >
                Open floor
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <div className="flex flex-1 flex-col justify-center gap-4 p-4">
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`${floor.occupiedCount} occupied, ${floor.availableCount} free, ${floor.outOfServiceCount} out of service`}
            >
              {floor.occupiedCount > 0 && (
                <motion.span
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(floor.occupiedCount / Math.max(floor.totalCount, 1)) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {floor.availableCount > 0 && (
                <motion.span
                  className="h-full bg-success"
                  initial={{ width: 0 }}
                  animate={{ width: `${(floor.availableCount / Math.max(floor.totalCount, 1)) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {floor.outOfServiceCount > 0 && (
                <motion.span
                  className="h-full bg-border"
                  initial={{ width: 0 }}
                  animate={{ width: `${(floor.outOfServiceCount / Math.max(floor.totalCount, 1)) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <Legend tone="success">{floor.availableCount} free</Legend>
              <Legend tone="warning">{floor.occupiedCount} occupied</Legend>
              <Legend tone="danger">{floor.outOfServiceCount} out of service</Legend>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
              <div className="flex flex-col gap-0.5">
                <span className="tabular text-xl font-semibold text-text">
                  {floor.seatsInService}
                </span>
                <span className="text-2xs text-muted">seats in service</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    "tabular text-xl font-semibold",
                    orders.readyToSettleCount > 0 ? "text-success" : "text-text",
                  )}
                >
                  {orders.readyToSettleCount}
                </span>
                <span className="text-2xs text-muted">ready to settle</span>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      {/* What has actually happened, in order. */}
      <Surface>
        <SurfaceHeader
          title="Activity"
          description={
            activity.length === 0 ? "Nothing yet today" : "Most recent first, today only"
          }
          actions={
            <Link
              href="/billing/history"
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
            >
              Billing history
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        />

        {activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Nothing has happened yet today. Orders, kitchen tickets and payments appear
            here as they happen.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((entry, position) => (
              <li key={`${entry.orderId}-${entry.kind}-${position}`}>
                <ActivityRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* Setup nudge, last, and only until it is done. */}
      {!isComplete && (
        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ClipboardList
                className="mt-0.5 size-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium text-text">
                  Finish your restaurant profile
                </p>
                <p className="text-xs text-muted">
                  {filled} of {optional.length} contact and location details added.
                </p>
              </div>
            </div>
            <LinkButton href="/settings/restaurant" variant="secondary" size="sm">
              Complete profile
            </LinkButton>
          </div>
        </Surface>
      )}
    </MotionConfig>
  );
}

/**
 * The rest of the product, one press away.
 *
 * Deliberately only the destinations nothing else on this screen already offers. The
 * three counts in the headline are themselves links to billing, the kitchen and the
 * floor, and repeating those here would make the row twice as long and no faster -
 * a launcher that lists everything is a second sidebar, and there is already a
 * sidebar.
 *
 * What is left is the work a manager does *between* services rather than during one:
 * checking tonight's bookings, pulling a dish that has run out, reading what guests
 * said, and the week's figures. Every one of those is currently two moves - open the
 * sidebar, find the row - and all of them start here.
 */
function ManagerQuickNav() {
  return (
    <Surface>
      {/* Scrolls rather than wraps on a narrow screen. A manager holding a tablet in
          one hand gets one row they can push along, not a block that reflows into
          three and pushes the charts off the bottom. */}
      <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "group flex min-w-[7.5rem] flex-1 shrink-0 flex-col gap-1.5 rounded-md border border-border px-3 py-2.5",
              "transition-colors hover:border-primary-border hover:bg-primary-soft",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <link.icon
                className="size-4 text-subtle transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
              <ArrowRight
                className="size-3 text-subtle opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-text transition-colors group-hover:text-primary">
                {link.label}
              </span>
              <span className="text-2xs whitespace-nowrap text-subtle">{link.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </Surface>
  );
}

/** Where the row goes, and what each one is for. */
const QUICK_LINKS: {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/pass",
    label: "Pass",
    hint: "Plates waiting",
    icon: ReceiptText,
  },
  {
    href: "/reservations",
    label: "Reservations",
    hint: "Who is booked in",
    icon: CalendarDays,
  },
  {
    href: "/menu",
    label: "Menu",
    hint: "Pull or price a dish",
    icon: UtensilsCrossed,
  },
  {
    href: "/reviews",
    label: "Reviews",
    hint: "What guests said",
    icon: Star,
  },
  {
    href: "/reports",
    label: "Reports",
    hint: "Any range of days",
    icon: ChartNoAxesColumn,
  },
  {
    href: "/settings/restaurant",
    label: "Settings",
    hint: "Tables, staff, stock",
    icon: Settings,
  },
];

/**
 * The things worth interrupting a manager for, and nothing else.
 *
 * Each one is a sentence with a way to act on it, shown only while it is true. The
 * screen is quiet when the restaurant is fine, which is what makes it worth reading
 * when it is not.
 */
function ManagerAlerts({
  orders,
  kitchen,
  readiness,
  floor,
  now,
}: {
  orders: OrderActivity;
  kitchen: KitchenLoad;
  readiness: Readiness;
  floor: Floor;
  now: number | null;
}) {
  const alerts: {
    key: string;
    tone: "warning" | "danger" | "success";
    text: string;
    href: string;
    action: string;
  }[] = [];

  if (!readiness.canTakeOrders) {
    alerts.push({
      key: "not-ready",
      tone: "danger",
      text:
        floor.inServiceCount === 0
          ? "No table is in service, so nobody can open an order."
          : "Nothing on the menu is available, so an order cannot have anything added to it.",
      href: floor.inServiceCount === 0 ? "/settings/tables" : "/menu",
      action: floor.inServiceCount === 0 ? "Open tables" : "Open menu",
    });
  }

  if (kitchen.oldestPendingAtUtc !== null) {
    const waited = sinceLabel(kitchen.oldestPendingAtUtc, now);

    alerts.push({
      key: "kitchen-waiting",
      tone: "warning",
      text: `A ticket has been waiting to be started for ${waited}.`,
      href: "/kitchen",
      action: "Open kitchen",
    });
  }

  if (orders.readyToSettleCount > 0) {
    alerts.push({
      key: "ready",
      tone: "success",
      text: `${orders.readyToSettleCount} ${orders.readyToSettleCount === 1 ? "order is" : "orders are"} finished in the kitchen and can be settled.`,
      href: "/billing",
      action: "Open billing",
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <Surface
          key={alert.key}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5",
            alert.tone === "danger"
              ? "border-danger-border bg-danger-soft"
              : alert.tone === "warning"
                ? "border-warning-border bg-warning-soft"
                : "border-success-border bg-success-soft",
          )}
        >
          <p
            className={cn(
              "flex min-w-0 items-start gap-2 text-sm",
              alert.tone === "danger"
                ? "text-danger"
                : alert.tone === "warning"
                  ? "text-warning"
                  : "text-success",
            )}
          >
            {alert.tone === "success" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            {alert.text}
          </p>
          <LinkButton href={alert.href} variant="secondary" size="sm">
            {alert.action}
          </LinkButton>
        </Surface>
      ))}
    </div>
  );
}

/** How each kind of event is presented: its icon, its tone, and what it is called. */
const ACTIVITY_LOOKS: Record<
  ActivityKind,
  { icon: LucideIcon; tone: string; label: string }
> = {
  OrderPlaced: { icon: ClipboardList, tone: "text-primary", label: "Order opened" },
  SentToKitchen: { icon: ChefHat, tone: "text-primary", label: "Sent to kitchen" },
  KitchenStarted: { icon: Flame, tone: "text-warning", label: "Cooking started" },
  KitchenReady: { icon: CircleCheck, tone: "text-success", label: "Ready at the pass" },
  OrderCompleted: { icon: ReceiptText, tone: "text-success", label: "Paid and closed" },
  OrderCancelled: { icon: Ban, tone: "text-danger", label: "Cancelled" },
};

/**
 * One thing that happened.
 *
 * The wording is composed here from the facts the server sent, rather than the
 * server sending a sentence: copy belongs on this side, and the same entry then
 * reads correctly wherever it is shown.
 */
function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const look = ACTIVITY_LOOKS[entry.kind];
  const Icon = look.icon;

  return (
    <Link
      href={`/billing/${entry.orderId}`}
      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-3"
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", look.tone)}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-text">
          <span className="font-medium">{look.label}</span>
          <span className="text-muted">
            {" · "}
            {entry.tableName}
            {entry.ticketNumber !== null && ` · KOT #${entry.ticketNumber}`}
          </span>
        </span>

        <span className="text-2xs text-subtle">
          <span className="tabular">order #{entry.orderNumber}</span>
          {entry.method !== null && ` · ${entry.method}`}
          {entry.reason !== null && ` · ${entry.reason}`}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {entry.amount !== null && (
          <span
            className={cn(
              "tabular text-sm font-semibold",
              entry.kind === "OrderCancelled"
                ? "text-muted line-through"
                : "text-text",
            )}
          >
            {entry.amount.toFixed(2)}
          </span>
        )}
        <span className="tabular text-2xs whitespace-nowrap text-subtle">
          {formatTime(entry.atUtc)}
        </span>
      </div>
    </Link>
  );
}

/** The day boundary, named the way a person would say it. */
function formatDayStart(isoString: string): string {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return "today";
  }

  return parsed.toLocaleString(undefined, {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */
/* Unprivileged account                                                       */
/* -------------------------------------------------------------------------- */

function NoAccessOverview() {
  return (
    <Surface>
      <EmptyState
        icon={<Store />}
        title="No workspace yet"
        description="This account is not linked to a restaurant. A platform admin assigns restaurant access."
      />
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Staff have a login but no operational features yet. This states that plainly
 * rather than showing an empty page or hinting at tools that do not exist.
 */
/**
 * Staff branch on what they do on the floor, not on their platform role.
 *
 * Anything other than a waiter or a chef reaches the fallback. Cashier was removed,
 * but a record written by an older build can still carry it, and inventing a screen
 * for a role this build does not know would be pretending.
 */
function StaffWorkspace({ role }: { role: string | null | undefined }) {
  switch (role) {
    case "Waiter":
      return <WaiterOverview />;
    case "Chef":
      return <ChefOverview />;
    default:
      return <StaffOverview />;
  }
}

/**
 * The chef entry point.
 *
 * Two counts and the way to the rail. No average preparation time, no covers
 * cooked, no performance figures: nothing in the system measures any of that, and a
 * made-up number on a dashboard is worse than an empty one.
 */
function ChefOverview() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listKitchenTickets();
        if (!cancelled) {
          setTickets(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the kitchen.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Surface>
    );
  }

  const preparing = tickets?.filter((ticket) => ticket.status === "Preparing") ?? [];
  const pending = tickets?.filter((ticket) => ticket.status === "Pending") ?? [];
  const oldest = pending[0] ?? preparing[0];

  return (
    <>
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary-soft text-primary"
              aria-hidden="true"
            >
              <ChefHat className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-xl font-semibold text-text">The kitchen</h2>
              <p className="text-xs text-muted">
                {tickets === null
                  ? "Loading…"
                  : tickets.length === 0
                    ? "Nothing on the rail right now."
                    : `${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"} to work through`}
              </p>
            </div>
          </div>

          <LinkButton href="/kitchen" icon={<Flame />}>
            Open the kitchen
          </LinkButton>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat
          label="On the stove"
          value={preparing.length}
          hint="Started and not yet at the pass"
          isLoading={tickets === null}
        />
        <Stat
          label="Waiting"
          value={pending.length}
          hint="Sent through, nobody on them yet"
          tone="warning"
          isLoading={tickets === null}
        />
      </div>

      {oldest !== undefined && (
        <Surface>
          <SurfaceHeader
            title="Up next"
            description={
              pending.length > 0
                ? "Waiting longest"
                : "Already on the stove"
            }
            actions={
              <Link
                href="/kitchen"
                className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
              >
                Open the kitchen
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="tabular text-lg font-semibold text-text">
              KOT #{oldest.ticketNumber}
            </span>
            <span className="text-sm text-muted">
              {oldest.tableName} · {oldest.itemCount}{" "}
              {oldest.itemCount === 1 ? "item" : "items"} · sent{" "}
              {formatTime(oldest.createdAtUtc)}
            </span>
          </div>
        </Surface>
      )}
    </>
  );
}

function StaffOverview() {
  return (
    <Surface>
      <EmptyState
        icon={<Store />}
        title="Nothing to do here yet"
        description="Your account is set up and active, but no role with its own screens has been assigned to it. Ask your manager to set you up as a waiter or a chef."
      />
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Waiter                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The waiter operational entry point.
 *
 * Everything here is a real count or a real order. No revenue, covers, kitchen
 * statistics or customer figures: none of those exist to report on.
 */
function WaiterOverview() {
  const [context, setContext] = useState<WaiterContext | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedContext, loadedOrders] = await Promise.all([
          getWaiterContext(),
          listOpenOrders(5),
        ]);
        if (!cancelled) {
          setContext(loadedContext);
          setOrders(loadedOrders);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load your workspace.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Surface>
    );
  }

  const canTakeOrders =
    context !== null &&
    context.activeTableCount > 0 &&
    context.availableItemCount > 0;

  // Orders carrying items nobody has sent to the kitchen yet. The one thing on
  // this screen that is genuinely waiting on the waiter.
  const awaitingKitchen =
    orders?.filter((order) => order.unsubmittedItemCount > 0).length ?? 0;

  return (
    <>
      {/* Restaurant identity and the one action that matters. */}
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary-soft text-primary"
              aria-hidden="true"
            >
              <Store className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              {context === null ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <h2 className="text-xl font-semibold text-text">
                  {context.restaurantName}
                </h2>
              )}
              <p className="text-xs text-muted">
                {context === null
                  ? "Loading…"
                  : `${context.activeTableCount} ${context.activeTableCount === 1 ? "table" : "tables"} in service · ${context.availableItemCount} ${context.availableItemCount === 1 ? "item" : "items"} on the menu`}
              </p>
            </div>
          </div>

          {canTakeOrders ? (
            <LinkButton href="/orders/new" icon={<Plus />}>
              New order
            </LinkButton>
          ) : (
            <Button disabled icon={<Plus />}>
              New order
            </Button>
          )}
        </div>
      </Surface>

      {/* Say plainly why ordering is unavailable rather than a dead button. */}
      {context !== null && !canTakeOrders && (
        <Surface className="border-warning-border bg-warning-soft">
          <div className="flex items-start gap-2.5 px-4 py-3">
            <ClipboardList
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-base font-medium text-text">
                Orders cannot be taken yet
              </p>
              <p className="text-xs text-muted">
                {context.activeTableCount === 0
                  ? "No tables are in service. Your manager can reopen one."
                  : "Nothing is on the menu. Your manager can add items."}
              </p>
            </div>
          </div>
        </Surface>
      )}

      <Surface>
        <SurfaceHeader
          title="Open orders"
          description={
            awaitingKitchen > 0
              ? `${awaitingKitchen} of these still has items to send to the kitchen`
              : "Tables with an order running"
          }
          actions={
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        />

        {orders === null ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Nothing running"
            description="Open orders will appear here."
            action={
              canTakeOrders ? (
                <LinkButton href="/orders/new" icon={<Plus />}>
                  Take an order
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Table</Th>
                  <Th className="text-right">Items</Th>
                  <Th className="text-right">Kitchen</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Placed</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link
                        href={"/orders/" + order.id}
                        className="tabular font-medium text-primary hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-muted">{order.tableName}</Td>
                    <Td className="text-right text-muted tabular">{order.itemCount}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {order.unsubmittedItemCount > 0 ? (
                        <span className="tabular font-medium text-warning">
                          {order.unsubmittedItemCount} to send
                        </span>
                      ) : (
                        <span className="text-subtle">all sent</span>
                      )}
                    </Td>
                    <Td className="text-right text-text tabular">
                      {order.subtotal.toFixed(2)}
                    </Td>
                    <Td className="text-right whitespace-nowrap text-muted">
                      {formatTime(order.createdAtUtc)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Surface>
    </>
  );
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
