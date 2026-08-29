"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Ban,
  ChefHat,
  CircleCheck,
  ClipboardList,
  Flame,
  Plus,
  ReceiptText,
  RefreshCw,
  Store,
  TriangleAlert,
  UserPlus,
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
import { listKitchenTickets } from "@/features/kitchen/api";
import { getWaiterContext, listOpenOrders } from "@/features/orders/api";
import type { Manager } from "@/types/manager";
import type { Restaurant, RestaurantSummary } from "@/types/restaurant";
import type { ActivityEntry, ActivityKind, ManagerDashboard } from "@/types/dashboard";
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
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const unassigned = restaurants?.filter((r) => r.managerId === null) ?? [];
  const freeManagers = managers?.filter((m) => !m.isAssigned) ?? [];
  const recent = [...(restaurants ?? [])]
    .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
    .slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Restaurants"
          value={restaurants?.length}
          hint="On the platform"
        />
        <Stat
          label="Awaiting a manager"
          value={unassigned.length}
          hint="Created but unassigned"
          tone={unassigned.length > 0 ? "warning" : "neutral"}
          isLoading={restaurants === null}
        />
        <Stat
          label="Managers"
          value={managers?.length}
          hint="Restaurant manager accounts"
        />
        <Stat
          label="Managers free"
          value={freeManagers.length}
          hint="Not running a restaurant"
          tone={freeManagers.length > 0 ? "warning" : "neutral"}
          isLoading={managers === null}
        />
      </div>

      {unassigned.length > 0 && (
        <Surface className="border-warning-border bg-warning-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <UserPlus
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base font-medium text-text">
                  {unassigned.length === 1
                    ? "1 restaurant needs a manager"
                    : `${unassigned.length} restaurants need a manager`}
                </p>
                <p className="text-xs text-muted">
                  A restaurant cannot be run until a manager is assigned.
                </p>
              </div>
            </div>
            <LinkButton href="/admin/restaurants" variant="secondary" size="sm">
              Assign now
            </LinkButton>
          </div>
        </Surface>
      )}

      <Surface>
        <SurfaceHeader
          title="Recent restaurants"
          description="Newest first"
          actions={
            <Link
              href="/admin/restaurants"
              className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        />

        {restaurants === null ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<Store />}
            title="No restaurants yet"
            description="Create the first restaurant, then assign someone to manage it."
            action={
              <LinkButton href="/admin/restaurants" icon={<Plus />}>
                New restaurant
              </LinkButton>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Restaurant</Th>
                  <Th>Location</Th>
                  <Th>Manager</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((restaurant) => (
                  <Tr key={restaurant.id}>
                    <Td>
                      <span className="font-medium text-text">{restaurant.name}</span>
                      <span className="block font-mono text-2xs text-subtle">
                        {restaurant.slug}
                      </span>
                    </Td>
                    <Td className="text-muted">{restaurant.city ?? "—"}</Td>
                    <Td>
{restaurant.managerId === null ? (
                        <Badge tone="warning" dot>
                          Unassigned
                        </Badge>
                      ) : (
                        <span className="text-muted">{restaurant.managerName}</span>
                      )}
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

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  isLoading,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  tone?: "neutral" | "warning";
  isLoading?: boolean;
}) {
  const loading = isLoading ?? value === undefined;

  return (
    <Surface className="flex flex-col gap-1 px-4 py-3.5">
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
    </Surface>
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
  // during service. No socket and nothing pushed: one request, on the same interval
  // the kitchen rail uses.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), 30_000);

    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <>
        <Surface className="flex flex-col gap-3 p-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </Surface>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((cell) => (
            <Surface key={cell} className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-12" />
            </Surface>
          ))}
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

  const { orders, floor, kitchen, today, readiness, activity } = dashboard;

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

  return (
    <>
      {/* Restaurant identity, and how fresh these numbers are */}
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
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-text">{restaurant.name}</h2>
                <Badge tone={readiness.canTakeOrders ? "success" : "warning"} dot>
                  {readiness.canTakeOrders ? "Trading" : "Not ready"}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {floor.occupiedCount} of {floor.inServiceCount}{" "}
                {floor.inServiceCount === 1 ? "table" : "tables"} occupied · updated{" "}
                {formatTime(dashboard.generatedAtUtc)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReloadKey((key) => key + 1)}
              icon={<RefreshCw />}
            >
              Refresh
            </Button>
            <LinkButton href="/settings/restaurant" variant="ghost" size="sm">
              Manage restaurant
            </LinkButton>
          </div>
        </div>
      </Surface>

      {/* Right now. Four numbers a manager acts on, not four they admire. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Open orders"
          value={orders.openCount}
          hint={
            orders.openCount === 0
              ? "Nothing running"
              : `${orders.openValue.toFixed(2)} outstanding`
          }
        />
        <Stat
          label="Ready to settle"
          value={orders.readyToSettleCount}
          hint={
            orders.readyToSettleCount === 0
              ? "Nothing waiting on you"
              : "Kitchen done, awaiting payment"
          }
          tone={orders.readyToSettleCount > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="In the kitchen"
          value={kitchenLoad}
          hint={
            kitchenLoad === 0
              ? "Rail is clear"
              : `${kitchen.preparingCount} cooking · ${kitchen.pendingCount} waiting`
          }
          tone={kitchen.pendingCount > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Tables free"
          value={floor.availableCount}
          hint={`${floor.occupiedCount} occupied · ${floor.seatsInService} ${floor.seatsInService === 1 ? "seat" : "seats"} in service`}
        />
      </div>

      {/* Anything actually demanding attention, said plainly and only when true. */}
      {!readiness.canTakeOrders && (
        <Surface className="border-warning-border bg-warning-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base font-medium text-text">
                  Waiters cannot take orders
                </p>
                <p className="text-xs text-muted">
                  {floor.inServiceCount === 0
                    ? "No table is in service. Put at least one back in service to start trading."
                    : "Nothing on the menu is available to order. Make at least one item available."}
                </p>
              </div>
            </div>
            <LinkButton
              href={floor.inServiceCount === 0 ? "/settings/tables" : "/menu"}
              variant="secondary"
              size="sm"
            >
              {floor.inServiceCount === 0 ? "Tables" : "Menu"}
            </LinkButton>
          </div>
        </Surface>
      )}

      {orders.readyToSettleCount > 0 && (
        <Surface className="border-success-border bg-success-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ReceiptText
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base font-medium text-text">
                  {orders.readyToSettleCount === 1
                    ? "A table is ready to settle"
                    : `${orders.readyToSettleCount} tables are ready to settle`}
                </p>
                <p className="text-xs text-muted">
                  The kitchen has finished{" "}
                  {orders.readyToSettleCount === 1 ? "this order" : "these orders"}, so
                  the {orders.readyToSettleCount === 1 ? "table" : "tables"} can be
                  paid for and released.
                </p>
              </div>
            </div>
            <LinkButton href="/billing" size="sm">
              Go to billing
            </LinkButton>
          </div>
        </Surface>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Today. Counts and sums for the shift, and nothing that implies a trend. */}
        <div className="flex flex-col gap-4">
          <Surface>
            <SurfaceHeader
              title="Today"
              description={`Since ${formatDayStart(today.startedAtUtc)}`}
              actions={
                <Link
                  href="/billing/history"
                  className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
                >
                  History
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              }
            />

            <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-4">
              <div className="flex flex-col">
                <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                  Taken today
                </span>
                <span className="text-xs text-muted">
                  {today.paymentCount}{" "}
                  {today.paymentCount === 1 ? "payment" : "payments"} recorded
                </span>
              </div>
              <span className="tabular text-3xl leading-9 font-semibold text-text">
                {today.paymentTotal.toFixed(2)}
              </span>
            </div>

            {/* Every method, always, so a zero reads as a zero rather than a gap. */}
            <ul className="divide-y divide-border">
              {today.byMethod.map((row) => (
                <li
                  key={row.method}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{row.method}</span>
                    <span className="tabular text-2xs text-subtle">
                      {row.count} {row.count === 1 ? "bill" : "bills"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tabular text-sm font-semibold",
                      row.total > 0 ? "text-text" : "text-subtle",
                    )}
                  >
                    {row.total.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="flex flex-col gap-0.5 px-4 py-3">
                <span className="tabular text-xl font-semibold text-text">
                  {today.completedCount}
                </span>
                <span className="text-2xs text-muted">
                  {today.completedCount === 1 ? "order closed" : "orders closed"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-4 py-3">
                <span
                  className={cn(
                    "tabular text-xl font-semibold",
                    today.cancelledCount > 0 ? "text-danger" : "text-text",
                  )}
                >
                  {today.cancelledCount}
                </span>
                <span className="text-2xs text-muted">
                  {today.cancelledCount === 1 ? "order cancelled" : "orders cancelled"}
                  {today.cancelledValue > 0 && (
                    <>
                      {" · "}
                      <span className="tabular">
                        {today.cancelledValue.toFixed(2)}
                      </span>{" "}
                      not taken
                    </>
                  )}
                </span>
              </div>
            </div>
          </Surface>

          {/* Setup nudge, kept below live operations rather than above it. */}
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
                      {filled} of {optional.length} contact and location details
                      added.
                    </p>
                  </div>
                </div>
                <LinkButton href="/settings/restaurant" variant="secondary" size="sm">
                  Complete profile
                </LinkButton>
              </div>
            </Surface>
          )}
        </div>

        {/* What has actually happened, in order. */}
        <Surface>
          <SurfaceHeader
            title="Activity"
            description={
              activity.length === 0
                ? "Nothing yet today"
                : "Most recent first, today only"
            }
          />

          {activity.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nothing has happened yet today. Orders, kitchen tickets and payments
              appear here as they happen.
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
      </div>
    </>
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
