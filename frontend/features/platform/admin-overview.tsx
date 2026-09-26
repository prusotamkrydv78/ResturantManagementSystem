"use client";

import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  ClipboardList,
  Flame,
  RefreshCw,
  Store,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Ticker } from "@/components/ui/ticker";
import {
  HourCard,
  LeaderboardCard,
  RecentDaysCard,
  TenderCard,
} from "@/features/analytics/charts";
import { money } from "@/features/analytics/format";
import { useManagers, usePlatformPulse, useRestaurants } from "@/queries/admin";
import { errorMessage } from "@/lib/query/errors";
import { nepalHourOf } from "@/lib/time/nepal";
import { sinceLabel, timeOf, useNow } from "@/lib/time/since";
import { cn } from "@/lib/utils/cn";
import type { PlatformPulse } from "@/types/platform";
import type { RestaurantSummary } from "@/types/restaurant";

/**
 * The platform owner's home: is the estate taking money, and where should I act?
 *
 * THE LAYOUT
 *
 * Read top to bottom in the order the questions come:
 *
 *   1. Today, in four tiles. The money is the lime one - the single figure an owner
 *      looks for first - and the other three say whether anybody is actually eating.
 *   2. The week, beside the estate's health: how trading is going, and whether every
 *      restaurant is able to trade at all.
 *   3. When today happened, beside how people paid.
 *   4. What needs a look, beside who is carrying the day.
 *
 * Every figure and every rule for what counts as "needs a look" is the one this
 * screen already had; the redesign is the composition, not the arithmetic.
 */
export function SuperAdminOverview() {
  // Three cached queries, live every thirty seconds while this screen is open and
  // refreshed when the tab comes back into view - a second admin can assign a
  // manager while this sits open. Coming back to the overview renders at once from
  // the cache instead of starting again from a skeleton.
  //
  // Trading is its own query and allowed to fail on its own. It is the one read here
  // that touches every order and payment on the platform, so if it ever gets slow
  // or falls over, the estate still draws and the admin can still act.
  const restaurantsQuery = useRestaurants({ live: true });
  const managersQuery = useManagers({}, { live: true });
  const pulseQuery = usePlatformPulse({ live: true });
  const now = useNow();

  const restaurants = restaurantsQuery.data ?? null;
  const managers = managersQuery.data ?? null;
  const pulse = pulseQuery.data ?? null;

  const error = errorMessage(
    restaurantsQuery.error ?? managersQuery.error,
    "Unable to load the overview.",
  );
  const pulseError = errorMessage(pulseQuery.error, "Unable to read today's trading.");

  const reload = () => {
    void restaurantsQuery.refetch();
    void managersQuery.refetch();
    void pulseQuery.refetch();
  };

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} onRetry={reload} />
      </Surface>
    );
  }

  const totalCount = restaurants?.length ?? 0;
  const freeManagers = managers?.filter((manager) => !manager.isAssigned) ?? [];
  const readyCount =
    restaurants?.filter((r) => r.managerId !== null && r.isActive).length ?? 0;
  const suspendedCount = restaurants?.filter((r) => !r.isActive).length ?? 0;
  // Active rooms with nobody running them. A suspended room without a manager counts
  // as suspended, so the three buckets always add up to the whole estate.
  const awaitingCount =
    restaurants?.filter((r) => r.managerId === null && r.isActive).length ?? 0;

  // An empty platform has nothing to trade and nothing to be healthy about.
  if (restaurants !== null && totalCount === 0) {
    return <FirstRun />;
  }

  const flagGroups = buildFlags(restaurants ?? [], pulse, now);
  const flagged = flagGroups.reduce((sum, group) => sum + group.rows.length, 0);

  const trading = (pulse?.restaurants ?? [])
    .filter((row) => row.ordersToday > 0 || row.openOrders > 0)
    .sort(
      (a, b) =>
        b.takingsToday - a.takingsToday ||
        b.ordersToday - a.ordersToday ||
        a.name.localeCompare(b.name),
    );

  return (
    <MotionConfig reducedMotion="user">
      {/* 1. Today */}
      {pulseError !== null ? (
        <Surface className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
            Today&rsquo;s trading could not be read. {pulseError}
          </p>
          <Button variant="secondary" size="sm" onClick={reload}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Try again
          </Button>
        </Surface>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
        >
          {pulse === null ? (
            <>
              <TileSkeleton accent />
              <TileSkeleton />
              <TileSkeleton />
              <TileSkeleton />
            </>
          ) : (
            <>
              <motion.div variants={RISE} className="flex">
                <HeroTile pulse={pulse} />
              </motion.div>
              <motion.div variants={RISE} className="flex">
                <StatTile
                  className="w-full"
                  icon={ClipboardList}
                  tone="indigo"
                  label="Orders today"
                  value={<Ticker value={pulse.today.ordersPlaced} />}
                  footnote={
                    pulse.today.ordersPlaced === 0
                      ? "Nothing ordered yet"
                      : `${pulse.today.completed} settled${pulse.today.cancelled > 0 ? ` · ${pulse.today.cancelled} cancelled` : ""}`
                  }
                  href="/admin/reports"
                />
              </motion.div>
              <motion.div variants={RISE} className="flex">
                <StatTile
                  className="w-full"
                  icon={Flame}
                  tone="peach"
                  label="Open right now"
                  value={<Ticker value={pulse.openOrders} />}
                  footnote={
                    pulse.platesAtPass === 0 ? (
                      "No plates waiting at the pass"
                    ) : (
                      <span className={pulse.platesAtPass >= BUSY_PASS ? "font-semibold text-warning" : ""}>
                        {pulse.platesAtPass} {pulse.platesAtPass === 1 ? "plate" : "plates"} waiting at the pass
                      </span>
                    )
                  }
                />
              </motion.div>
              <motion.div variants={RISE} className="flex">
                <StatTile
                  className="w-full"
                  icon={Store}
                  tone="sky"
                  label="Trading today"
                  value={
                    <>
                      <Ticker value={pulse.tradingToday} />
                      <span className="ml-1 text-lg font-medium text-subtle">/ {totalCount}</span>
                    </>
                  }
                  footnote={
                    pulse.tradingToday === 0
                      ? "No restaurant has taken an order"
                      : `${pulse.tradingToday === 1 ? "restaurant has" : "restaurants have"} taken an order`
                  }
                  href="/admin/restaurants"
                />
              </motion.div>
            </>
          )}
        </motion.div>
      )}

      {/* 2. The week, beside the estate */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {pulse === null ? <ChartSkeleton /> : <RecentDaysCard days={pulse.days} />}
        </div>
        <EstatePanel
          loading={restaurants === null || managers === null}
          total={totalCount}
          ready={readyCount}
          awaiting={awaitingCount}
          suspended={suspendedCount}
          managers={managers?.length ?? 0}
          freeManagers={freeManagers.length}
        />
      </div>

      {/* 3. When today happened, and how it was paid */}
      {pulse !== null && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <HourCard hours={pulse.hours} currentHour={nepalHourOf(pulse.serverUtcNow)} />
          </div>
          <TenderCard byMethod={pulse.byMethodToday} />
        </div>
      )}

      {/* 4. What needs a look, and who is carrying the day */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className={cn(pulse !== null ? "xl:col-span-2" : "xl:col-span-3")}>
          <NeedsALook groups={flagGroups} flagged={flagged} pulseKnown={pulse !== null} />
        </div>
        {pulse !== null && <LeaderboardCard rows={pulse.restaurants} />}
      </div>

      {pulse !== null && trading.length > 0 && (
        <TradingTable rows={trading} total={totalCount} tradingToday={pulse.tradingToday} now={now} />
      )}
    </MotionConfig>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

/** How many plates waiting at one pass is worth colouring: about two tables' food. */
const BUSY_PASS = 6;

const RISE = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

/**
 * The money, in lime.
 *
 * Compared with yesterday as progress toward a finished day rather than as a
 * percentage change. At ten in the morning the whole platform is "down 80% on
 * yesterday", which is true, useless, and teaches an owner to ignore the number; how
 * much of yesterday's total today has already reached is the honest version of the
 * same comparison.
 */
function HeroTile({ pulse }: { pulse: PlatformPulse }) {
  const { today, yesterday } = pulse;
  const ahead = yesterday.takings > 0 && today.takings >= yesterday.takings;
  const share =
    yesterday.takings > 0 ? Math.round((today.takings / yesterday.takings) * 100) : null;

  return (
    <StatTile
      featured
      className="w-full"
      icon={Wallet}
      label="Taken today"
      value={<Ticker value={today.takings} decimals={2} />}
      delta={
        ahead ? (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent-fg">
            <ArrowUpRight className="size-3" aria-hidden="true" />
            Past yesterday
          </span>
        ) : share !== null ? (
          <span className="text-xs font-semibold text-accent-fg">{share}% of yesterday</span>
        ) : undefined
      }
      footnote={
        yesterday.takings > 0
          ? `Yesterday ${money(yesterday.takings, 2)}`
          : "Nothing was taken yesterday"
      }
    />
  );
}

/** One figure on a white tile, optionally a door to where it is acted on. */
function TileSkeleton({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-36 flex-col gap-3 rounded-2xl p-3.5",
        accent ? "bg-accent/60" : "ui-surface border border-border bg-surface",
      )}
    >
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-auto h-9 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Surface className="flex h-full min-h-80 flex-col gap-3 p-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-44" />
      <Skeleton className="mt-4 flex-1" />
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Estate health                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Whether every restaurant is able to trade, on lavender.
 *
 * The ring carries the split and the sentence underneath says what to do about it.
 * The four counts at the bottom are each a door to the list that acts on them.
 */
function EstatePanel({
  loading,
  total,
  ready,
  awaiting,
  suspended,
  managers,
  freeManagers,
}: {
  loading: boolean;
  total: number;
  ready: number;
  awaiting: number;
  suspended: number;
  managers: number;
  freeManagers: number;
}) {
  if (loading) {
    return (
      <div className="flex min-h-72 flex-col gap-3 rounded-2xl bg-panel p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mx-auto mt-2 size-36 rounded-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  // The one decision this panel exists to produce, in priority order: staff the
  // unstaffed, review the suspended, otherwise read the reports.
  const action =
    awaiting > 0
      ? freeManagers > 0
        ? { href: "/admin/restaurants", label: "Assign a manager" }
        : { href: "/admin/managers", label: "Create a manager" }
      : suspended > 0
        ? { href: "/admin/restaurants", label: "Review suspended" }
        : { href: "/admin/reports", label: "Open reports" };

  const verdict =
    awaiting > 0
      ? `${awaiting} ${awaiting === 1 ? "restaurant cannot" : "restaurants cannot"} trade without a manager. ${
          freeManagers > 0
            ? `${freeManagers} ${freeManagers === 1 ? "manager is" : "managers are"} free.`
            : "No managers are free."
        }`
      : suspended > 0
        ? `${suspended} ${suspended === 1 ? "restaurant is" : "restaurants are"} suspended and taking no orders.`
        : "Every restaurant has a manager and is in service.";

  return (
    <div className="flex flex-col rounded-2xl bg-panel p-4 text-panel-fg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Estate health</h2>
          <p className="text-xs opacity-70">Who is able to trade right now</p>
        </div>
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-(--surface-shadow) transition-colors hover:bg-ink hover:text-surface"
        >
          {action.label}
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {/* The ring beside its verdict, and the counts in one row beneath: the
          panel sets the height of the week chart next to it, so every line it
          stacks is a line of empty chart. */}
      <div className="flex flex-1 items-center gap-4 py-3">
        <EstateRing ready={ready} awaiting={awaiting} suspended={suspended} total={total} />
        <p className="text-sm leading-snug font-medium opacity-90">{verdict}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        <EstateCount label="Restaurants" value={total} href="/admin/restaurants" dot="var(--primary)" />
        <EstateCount
          label="Need a manager"
          value={awaiting}
          href="/admin/restaurants"
          dot="var(--chart-3)"
          flag={awaiting > 0}
        />
        <EstateCount label="Managers" value={managers} href="/admin/managers" dot="var(--chart-6)" />
        <EstateCount
          label="Suspended"
          value={suspended}
          href="/admin/restaurants"
          dot="var(--danger)"
          flag={suspended > 0}
        />
      </div>
    </div>
  );
}

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
  const RADIUS = 58;
  const STROKE = 14;
  const circumference = 2 * Math.PI * RADIUS;
  const safeTotal = Math.max(total, 1);

  const segments = [
    { key: "ready", value: ready, colour: "var(--primary)" },
    { key: "awaiting", value: awaiting, colour: "var(--chart-3)" },
    { key: "suspended", value: suspended, colour: "var(--danger)" },
  ].filter((segment) => segment.value > 0);

  // A small gap between arcs, so two segments read as two rather than one colour
  // shading into another. None when one bucket holds the whole estate.
  const gap = segments.length > 1 ? 6 : 0;

  let before = 0;

  return (
    <div className="relative size-28 shrink-0">
      <svg
        viewBox="0 0 140 140"
        className="size-full -rotate-90"
        role="img"
        aria-label={`${ready} ready, ${awaiting} need a manager, ${suspended} suspended`}
      >
        <circle
          cx={70}
          cy={70}
          r={RADIUS}
          fill="none"
          stroke="var(--surface)"
          strokeOpacity={0.7}
          strokeWidth={STROKE}
        />
        {segments.map((segment) => {
          const length = (segment.value / safeTotal) * circumference;
          const offset = -(before / safeTotal) * circumference;

          before += segment.value;

          return (
            <motion.circle
              key={segment.key}
              cx={70}
              cy={70}
              r={RADIUS}
              fill="none"
              stroke={segment.colour}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(length - gap, 0)} ${circumference}`}
              strokeDashoffset={offset}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold tracking-tight">
          {total === 0 ? "—" : `${Math.round((ready / safeTotal) * 100)}%`}
        </span>
        <span className="text-2xs font-medium opacity-70">ready</span>
      </span>
    </div>
  );
}

function EstateCount({
  label,
  value,
  href,
  dot,
  flag = false,
}: {
  label: string;
  value: number;
  href: string;
  dot: string;
  flag?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-0.5 rounded-xl bg-surface/70 px-2.5 py-2 transition-colors hover:bg-surface"
    >
      <span className="flex items-center gap-1.5 text-2xs font-medium text-muted">
        <span className="size-2 rounded-full" style={{ background: dot }} aria-hidden="true" />
        {label}
      </span>
      <span
        className={cn(
          "tabular text-base leading-tight font-semibold",
          flag ? "text-warning" : "text-text",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Needs a look                                                               */
/* -------------------------------------------------------------------------- */

/** One restaurant in the attention list, whichever group it came from. */
interface Flag {
  id: string;
  name: string;
  slug: string;
  tone: "danger" | "warning" | "neutral";
  badge: string | null;
  meta: string | null;
}

interface FlagGroup {
  title: string;
  note: string;
  rows: Flag[];
}

/**
 * The three kinds of restaurant worth opening, worst first.
 *
 * Orders left open from before today; restaurants that cannot trade at all; and
 * restaurants that could trade and have not. The third is the one only this screen
 * can see: a manager whose QR codes stopped working sees an empty screen and
 * believes it.
 */
function buildFlags(
  restaurants: RestaurantSummary[],
  pulse: PlatformPulse | null,
  now: number | null,
): FlagGroup[] {
  const rows = pulse?.restaurants ?? [];

  const strays = rows.filter((row) => row.openOrders > 0 && row.ordersToday === 0);

  const blocked = [...restaurants]
    .filter((r) => r.managerId === null || !r.isActive)
    .sort(
      (a, b) =>
        Number(a.managerId !== null) - Number(b.managerId !== null) ||
        timeOf(b.createdAtUtc) - timeOf(a.createdAtUtc),
    );

  const quiet = rows
    .filter(
      (row) => row.isActive && row.hasManager && row.ordersToday === 0 && row.openOrders === 0,
    )
    .sort((a, b) => timeOf(a.lastOrderAtUtc ?? "") - timeOf(b.lastOrderAtUtc ?? ""));

  return [
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
      rows: blocked.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
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
        meta: row.lastOrderAtUtc === null ? null : `last order ${sinceLabel(row.lastOrderAtUtc, now)}`,
      })),
    },
  ].filter((group) => group.rows.length > 0);
}

function NeedsALook({
  groups,
  flagged,
  pulseKnown,
}: {
  groups: FlagGroup[];
  flagged: number;
  pulseKnown: boolean;
}) {
  return (
    <Surface className="flex h-full flex-col">
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
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-ink hover:text-surface"
          >
            All restaurants
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        }
      />

      {flagged === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-text">All clear</p>
          <p className="max-w-xs text-xs text-muted">
            {pulseKnown
              ? "Every restaurant has a manager, is in service, and has traded today."
              : "Every restaurant has a manager and is in service."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-2 pt-1 pb-2">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="flex items-baseline gap-2 px-2 pb-1">
                <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                  {group.title}
                </span>
                <span className="text-2xs text-subtle">{group.note}</span>
              </p>
              <ul className="flex flex-col gap-1">
                {group.rows.map((row) => (
                  <FlagRow key={`${group.title}-${row.id}`} row={row} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}

const FLAG_CHIPS: Record<Flag["tone"], string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-panel text-panel-fg",
};

function FlagRow({ row }: { row: Flag }) {
  return (
    <li>
      <Link
        href={`/admin/restaurants/${row.id}`}
        className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
            FLAG_CHIPS[row.tone],
          )}
        >
          {row.name.trim().charAt(0).toUpperCase() || "?"}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-text">{row.name}</span>
          <span className="truncate text-xs text-muted">
            {row.meta ?? row.slug}
          </span>
        </span>

        {row.badge !== null && (
          <Badge tone={row.tone} dot>
            {row.badge}
          </Badge>
        )}
        <ArrowRight
          className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Trading today                                                              */
/* -------------------------------------------------------------------------- */

/** The table an owner watches during a service: every room that is busy now. */
function TradingTable({
  rows,
  total,
  tradingToday,
  now,
}: {
  rows: PlatformPulse["restaurants"];
  total: number;
  tradingToday: number;
  now: number | null;
}) {
  return (
    <Surface>
      <SurfaceHeader
        title="Trading today"
        description={`${tradingToday} of ${total} ${total === 1 ? "restaurant has" : "restaurants have"} opened an order today.`}
        actions={
          <LinkButton href="/admin/reports" variant="secondary" size="sm">
            Full report
          </LinkButton>
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
              <Th className="text-right">At the pass</Th>
              <Th className="text-right">Last order</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link href={`/admin/restaurants/${row.id}`} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-panel text-sm font-semibold text-panel-fg"
                    >
                      {row.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span className="font-semibold text-text hover:underline">{row.name}</span>
                  </Link>
                </Td>
                <Td className="tabular text-right">{row.ordersToday}</Td>
                <Td className="tabular text-right font-semibold">{money(row.takingsToday, 2)}</Td>
                <Td className="tabular text-right">
                  {row.openOrders === 0 ? <span className="text-subtle">—</span> : row.openOrders}
                </Td>
                <Td className="tabular text-right">
                  {row.platesAtPass === 0 ? (
                    <span className="text-subtle">—</span>
                  ) : (
                    <span className={row.platesAtPass >= BUSY_PASS ? "font-semibold text-warning" : ""}>
                      {row.platesAtPass}
                    </span>
                  )}
                </Td>
                <Td className="text-right text-xs text-muted">{sinceLabel(row.lastOrderAtUtc, now)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* First run                                                                  */
/* -------------------------------------------------------------------------- */

/** An empty platform gets the two steps to its first order, and nothing else. */
function FirstRun() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-accent p-8 text-accent-fg">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/30"
      />
      <div className="relative flex max-w-xl flex-col gap-3">
        <span className="text-xs font-semibold tracking-wider uppercase opacity-70">
          Get the platform trading
        </span>
        <h2 className="text-3xl font-semibold tracking-tight">
          Two steps to the first order
        </h2>
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-fg text-xs font-semibold text-accent">
              1
            </span>
            Create a restaurant - its name and address.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-fg/15 text-xs font-semibold">
              2
            </span>
            Give it a manager, who then sets up the menu, tables and staff.
          </li>
        </ol>
        <div className="mt-3">
          <LinkButton href="/admin/restaurants/new">Create the first restaurant</LinkButton>
        </div>
      </div>
    </div>
  );
}
