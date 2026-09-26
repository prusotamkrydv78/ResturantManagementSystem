"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  motion,
  MotionConfig,
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
import { getMyRestaurant } from "@/features/restaurants/api";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getManagerDashboard } from "@/features/dashboard/api";
import { SuperAdminOverview } from "@/features/platform/admin-overview";
import { Ticker } from "@/components/ui/ticker";
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
/* Super Admin                                                                */
/* -------------------------------------------------------------------------- */

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

/** One restaurant in the needs-a-look list, whichever group it came from. */
/** One heading and the rows under it. */
/** UTC+05:45. The one boundary every daily figure in this product is counted against. */
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
