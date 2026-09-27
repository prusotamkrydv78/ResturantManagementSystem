"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  motion,
  MotionConfig,
} from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  Ban,
  ChefHat,
  CircleCheck,
  ClipboardList,
  Flame,
  Plus,
  ReceiptText,
  Store,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/features/auth/auth-context";
import { isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { getMyRestaurant } from "@/features/restaurants/api";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getManagerDashboard } from "@/features/dashboard/api";
import { SuperAdminOverview } from "@/features/platform/admin-overview";
import { Ticker } from "@/components/ui/ticker";
import { StatTile } from "@/components/ui/stat-tile";
import { money } from "@/features/analytics/format";
import { nepalHourOf } from "@/lib/time/nepal";
import { sinceLabel, useNow } from "@/lib/time/since";
import {
  HourCard,
  RecentDaysCard,
  TenderCard,
} from "@/features/analytics/charts";
import { listKitchenTickets } from "@/features/kitchen/api";
import { getWaiterContext, listOpenOrders } from "@/features/orders/api";
import type { Restaurant } from "@/types/restaurant";
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
/* Restaurant Manager                                                         */
/* -------------------------------------------------------------------------- */

/** Everything on the overview enters the same way, so it enters as one thing. */
const RISE = {
  hidden: { opacity: 0, y: 12 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** How many activity rows the overview shows; the rest live in billing history. */
const ACTIVITY_LIMIT = 8;

/**
 * The manager operational overview.
 *
 * Answers one question: what is happening in this restaurant right now. Every figure
 * is derived by the server from orders, tables, kitchen tickets and payments that
 * already exist, so nothing here is stored, estimated or invented.
 *
 * Read top to bottom in the order a manager needs it during service:
 *
 * 1. Four tiles - the money, and the three counts that are acted on (open orders,
 *    the kitchen, free tables), each the door to the screen that acts on it.
 * 2. Anything that needs attention, as one compact strip, only while it is true.
 * 3. The room and what has just happened in it.
 * 4. History - the recent days, how today was paid, and today by the hour - below
 *    the live picture rather than above it.
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
    return <ManagerOverviewSkeleton />;
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
  const ahead = yesterday.takings > 0 && today.paymentTotal >= yesterday.takings;
  // Progress toward yesterday's finished day, not a percentage change: at ten in
  // the morning "down 80%" is true and useless.
  const share =
    yesterday.takings > 0 ? Math.round((today.paymentTotal / yesterday.takings) * 100) : null;

  return (
    <MotionConfig reducedMotion="user">
      {/* 1. The money, and the three counts a manager acts on. */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={RISE} className="flex">
          <StatTile
            featured
            className="w-full"
            icon={Wallet}
            label={readiness.canTakeOrders ? "Taken today" : "Taken today · not ready to trade"}
            value={
              <>
                <span className="mr-1 text-lg font-medium opacity-70">NPR</span>
                <Ticker value={today.paymentTotal} decimals={2} />
              </>
            }
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
              today.paymentCount === 0
                ? "Nothing settled yet today"
                : `${today.paymentCount} ${today.paymentCount === 1 ? "bill" : "bills"} settled${today.cancelledCount > 0 ? ` · ${today.cancelledCount} cancelled` : ""}`
            }
          />
        </motion.div>

        <motion.div variants={RISE} className="flex">
          <StatTile
            className="w-full"
            icon={ClipboardList}
            tone="indigo"
            label="Open orders"
            value={<Ticker value={orders.openCount} />}
            footnote={
              orders.readyToSettleCount > 0 ? (
                <span className="font-semibold text-success">
                  {orders.readyToSettleCount} ready to settle
                </span>
              ) : orders.openCount === 0 ? (
                "No table is ordering"
              ) : (
                "None ready to settle yet"
              )
            }
            href="/billing"
          />
        </motion.div>

        <motion.div variants={RISE} className="flex">
          <StatTile
            className="w-full"
            icon={Flame}
            tone="peach"
            label="In the kitchen"
            value={<Ticker value={kitchenLoad} />}
            footnote={
              kitchen.oldestPendingAtUtc !== null ? (
                <span className="font-semibold text-warning">
                  Oldest waiting {sinceLabel(kitchen.oldestPendingAtUtc, now)}
                </span>
              ) : kitchenLoad === 0 ? (
                "Nothing on the rail"
              ) : (
                `${kitchen.preparingCount} cooking · ${kitchen.pendingCount} waiting`
              )
            }
            href="/kitchen"
          />
        </motion.div>

        <motion.div variants={RISE} className="flex">
          <StatTile
            className="w-full"
            icon={Armchair}
            tone="sky"
            label="Tables free"
            value={
              <>
                <Ticker value={floor.availableCount} />
                <span className="ml-1 text-lg font-medium text-subtle">/ {floor.inServiceCount}</span>
              </>
            }
            footnote={`${floor.seatsInService} seats in service`}
            href="/floor"
          />
        </motion.div>
      </motion.div>

      {/* 2. Anything actually demanding attention, said plainly and only when true. */}
      <ManagerAlerts orders={orders} kitchen={kitchen} readiness={readiness} floor={floor} now={now} />

      {/* 3. What has just happened, beside the room it happened in. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityCard activity={activity} />
        </div>
        <FloorPanel floor={floor} />
      </div>

      {/* 4. History: the recent days and how today was paid, then today by the hour. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentDaysCard days={days} />
        </div>
        <TenderCard byMethod={today.byMethod} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className={isComplete ? "xl:col-span-3" : "xl:col-span-2"}>
          <HourCard hours={hours} currentHour={nepalHourOf(dashboard.generatedAtUtc)} />
        </div>
        {!isComplete && <ProfileNudge filled={filled} total={optional.length} />}
      </div>

      <p className="px-1 text-2xs text-subtle">
        {restaurant.name} · since {formatDayStart(today.startedAtUtc)} · read at{" "}
        {formatTime(dashboard.generatedAtUtc)}
      </p>
    </MotionConfig>
  );
}

/** The shape of the finished overview, so nothing jumps when the figures arrive. */
function ManagerOverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-32 rounded-2xl bg-accent/60" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl bg-panel" />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </>
  );
}

/**
 * The things worth interrupting a manager for, and nothing else.
 *
 * One strip rather than a card per alert: three full-width tinted cards at once took
 * over the top of the screen. Each row is a sentence with a way to act on it, shown
 * only while it is true, so the screen is quiet when the restaurant is fine.
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
    alerts.push({
      key: "kitchen-waiting",
      tone: "warning",
      text: `A ticket has been waiting to be started for ${sinceLabel(kitchen.oldestPendingAtUtc, now)}.`,
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
    <Surface className="divide-y divide-border">
      {alerts.map((alert) => (
        <div key={alert.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl",
              ALERT_CHIPS[alert.tone],
            )}
            aria-hidden="true"
          >
            {alert.tone === "success" ? (
              <CircleCheck className="size-4" />
            ) : (
              <TriangleAlert className="size-4" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-text">{alert.text}</p>
          <Link
            href={alert.href}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-ink hover:text-surface"
          >
            {alert.action}
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      ))}
    </Surface>
  );
}

const ALERT_CHIPS: Record<"warning" | "danger" | "success", string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
};

/**
 * The floor as a shape rather than a number, on the lavender panel.
 *
 * The bar and the legend under it read the same colours from one table - they used
 * to disagree, with the legend naming amber and red for segments drawn indigo and grey.
 */
const FLOOR_PARTS = [
  { key: "occupied", label: "occupied", colour: "var(--chart-1)" },
  { key: "free", label: "free", colour: "var(--success)" },
  { key: "out", label: "out of service", colour: "var(--border-strong)" },
] as const;

function FloorPanel({ floor }: { floor: Floor }) {
  const counts = {
    occupied: floor.occupiedCount,
    free: floor.availableCount,
    out: floor.outOfServiceCount,
  };
  const total = Math.max(floor.totalCount, 1);
  const occupancy =
    floor.inServiceCount > 0 ? Math.round((floor.occupiedCount / floor.inServiceCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-panel p-4 text-panel-fg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold tracking-tight">The floor</h2>
          <p className="text-xs opacity-70">
            {floor.occupiedCount} of {floor.inServiceCount} tables in service occupied
          </p>
        </div>
        <Link
          href="/floor"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-(--surface-shadow) transition-colors hover:bg-ink hover:text-surface"
        >
          Open floor
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        <p className="tabular text-5xl font-semibold tracking-tight">
          {occupancy}
          <span className="text-2xl opacity-60">%</span>
        </p>

        <div
          className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface/60"
          role="img"
          aria-label={`${floor.occupiedCount} occupied, ${floor.availableCount} free, ${floor.outOfServiceCount} out of service`}
        >
          {FLOOR_PARTS.map((part, index) =>
            counts[part.key] > 0 ? (
              <motion.span
                key={part.key}
                className="h-full rounded-full"
                style={{ background: part.colour }}
                initial={{ width: 0 }}
                animate={{ width: `${(counts[part.key] / total) * 100}%` }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null,
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {FLOOR_PARTS.map((part) => (
            <span key={part.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: part.colour }} />
              <span className="tabular font-semibold">{counts[part.key]}</span>
              <span className="opacity-70">{part.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-3 text-text">
          <span className="tabular text-xl font-semibold">{floor.seatsInService}</span>
          <span className="text-2xs text-muted">seats in service</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-3 text-text">
          <span className="tabular text-xl font-semibold">{floor.totalCount}</span>
          <span className="text-2xs text-muted">tables in all</span>
        </div>
      </div>
    </div>
  );
}

/** How each kind of event is presented: its icon, its chip, and what it is called. */
const ACTIVITY_LOOKS: Record<ActivityKind, { icon: LucideIcon; chip: string; label: string }> = {
  OrderPlaced: { icon: ClipboardList, chip: "bg-primary-soft text-primary", label: "Order opened" },
  SentToKitchen: { icon: ChefHat, chip: "bg-primary-soft text-primary", label: "Sent to kitchen" },
  KitchenStarted: { icon: Flame, chip: "bg-warning-soft text-warning", label: "Cooking started" },
  KitchenReady: { icon: CircleCheck, chip: "bg-success-soft text-success", label: "Ready at the pass" },
  OrderCompleted: { icon: ReceiptText, chip: "bg-accent text-accent-fg", label: "Paid and closed" },
  OrderCancelled: { icon: Ban, chip: "bg-danger-soft text-danger", label: "Cancelled" },
};

/** Today's latest events, capped; the full record is billing history. */
function ActivityCard({ activity }: { activity: ActivityEntry[] }) {
  const shown = activity.slice(0, ACTIVITY_LIMIT);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Activity"
        description={
          activity.length === 0
            ? "Nothing yet today"
            : activity.length > ACTIVITY_LIMIT
              ? `Latest ${ACTIVITY_LIMIT} of ${activity.length} today`
              : "Most recent first, today only"
        }
        actions={
          <Link
            href="/billing/history"
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-ink hover:text-surface"
          >
            Billing history
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        }
      />

      {activity.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted">
          Orders, kitchen tickets and payments appear here as they happen.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {shown.map((entry, position) => (
            <li key={`${entry.orderId}-${entry.kind}-${position}`}>
              <ActivityRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

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
      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", look.chip)} aria-hidden="true">
        <Icon className="size-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text">
          <span className="font-semibold">{look.label}</span>
          <span className="text-muted">
            {" · "}
            {entry.tableName}
            {entry.ticketNumber !== null && ` · KOT #${entry.ticketNumber}`}
          </span>
        </span>
        <span className="truncate text-2xs text-subtle">
          <span className="tabular">order #{entry.orderNumber}</span>
          {entry.method !== null && ` · ${entry.method}`}
          {entry.reason !== null && ` · ${entry.reason}`}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {entry.amount !== null && (
          <span
            className={cn(
              "tabular text-sm font-semibold",
              entry.kind === "OrderCancelled" ? "text-muted line-through" : "text-text",
            )}
          >
            NPR {money(entry.amount, 2)}
          </span>
        )}
        <span className="tabular text-2xs whitespace-nowrap text-subtle">{formatTime(entry.atUtc)}</span>
      </span>
    </Link>
  );
}

/** The setup prompt, in ink, only until the profile is done. */
function ProfileNudge({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl bg-contrast p-4 text-contrast-fg">
      <div className="flex flex-col gap-1">
        <span className="text-2xs font-semibold tracking-wider text-accent uppercase">Setup</span>
        <h2 className="text-lg font-semibold tracking-tight">Finish your restaurant profile</h2>
        <p className="text-xs text-contrast-muted">
          {filled} of {total} contact and location details added. Guests and receipts use them.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-contrast-raised">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${(filled / total) * 100}%` }} />
        </div>
        <Link
          href="/settings/restaurant"
          className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition-transform hover:-translate-y-0.5"
        >
          Complete profile
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
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
