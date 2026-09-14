"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Armchair,
  Boxes,
  ChefHat,
  ClipboardList,
  Flame,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { getPlatformRestaurant } from "@/features/platform/api";
import { RecentDaysCard, TenderCard } from "@/features/analytics/charts";
import { sinceLabel, useNow } from "@/lib/time/since";
import { cn } from "@/lib/utils/cn";
import type {
  PlatformRestaurantDetail,
  PlatformRestaurantOrder,
} from "@/types/platform";

/**
 * One restaurant, whole, for a platform administrator.
 *
 * The estate list answers which restaurants need attention. This answers the next
 * question, which it could not: what is actually going on inside one of them. Money,
 * floor, kitchen, roster, set-up and settings on a single screen, because the person
 * reading it has no other way to see any of it — every other module in the product
 * scopes its reads to the caller's own restaurant, and a platform administrator owns
 * none.
 *
 * It is read-only on purpose. Editing a restaurant, assigning its manager and
 * suspending it all live on the list, where the confirmation dialogs already are;
 * duplicating them here would mean two places to keep correct and two places to get
 * an irreversible action wrong.
 */
export default function PlatformRestaurantPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <PlatformRestaurant />
    </RequireAuth>
  );
}

function PlatformRestaurant() {
  // Read from the hook rather than from the page props, the way every other detail
  // screen in this product does. The identifier is only ever a lookup key here: the
  // API resolves the restaurant from it and authorises the caller separately.
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<PlatformRestaurantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPlatformRestaurant(id);
        if (!cancelled) {
          setDetail(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the restaurant.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // A restaurant page opened during a service is a page somebody is watching. The
  // same thirty-second beat the other platform screens use, plus a refresh when the
  // tab comes back, so the floor below is never quietly stale.
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
      <>
        <PageHeader
          title="Restaurant"
          crumbs={[
            { label: "Platform", href: "/dashboard" },
            { label: "Restaurants", href: "/admin/restaurants" },
            { label: "Restaurant" },
          ]}
        />
        <PageBody>
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  if (detail === null) {
    return (
      <>
        <PageHeader
          title="Loading…"
          crumbs={[
            { label: "Platform", href: "/dashboard" },
            { label: "Restaurants", href: "/admin/restaurants" },
          ]}
        />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3 w-64" />
          </Surface>
          <Surface className="h-64" />
        </PageBody>
      </>
    );
  }

  const { today, yesterday, setup, reviews } = detail;
  const peak = Math.max(today.takings, yesterday.takings, 1);

  return (
    <>
      <PageHeader
        title={detail.name}
        description={
          [detail.addressLine, detail.city, detail.country]
            .filter((part) => part !== null && part !== "")
            .join(", ") || "No address on file."
        }
        crumbs={[
          { label: "Platform", href: "/dashboard" },
          { label: "Restaurants", href: "/admin/restaurants" },
          { label: detail.name },
        ]}
        actions={
          <LinkButton href="/admin/restaurants" variant="secondary">
            Back to restaurants
          </LinkButton>
        }
      />

      <PageBody>
        {/* Identity first, and the one fact that outranks everything else on the
            page: whether this restaurant can trade at all. A suspended room with a
            beautiful fortnight behind it is still a room taking no orders now. */}
        <Surface className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-subtle">{detail.slug}</span>
              {detail.isActive ? (
                <Badge tone="success" dot>
                  In service
                </Badge>
              ) : (
                <Badge tone="danger" dot>
                  Suspended
                </Badge>
              )}
              {detail.manager === null && (
                <Badge tone="warning" dot>
                  No manager
                </Badge>
              )}
              {setup.sitePublished && <Badge tone="neutral">Site live</Badge>}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {detail.manager !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <ChefHat className="size-3.5 text-subtle" aria-hidden="true" />
                  {detail.manager.fullName}
                </span>
              )}
              {detail.contactEmail !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-subtle" aria-hidden="true" />
                  {detail.contactEmail}
                </span>
              )}
              {detail.contactPhone !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-subtle" aria-hidden="true" />
                  {detail.contactPhone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-subtle" aria-hidden="true" />
                On the platform since {formatDate(detail.createdAtUtc)}
              </span>
              {/* When its settings were last touched. Worth a line on a page somebody
                  opens because something looks wrong: a restaurant whose rates or slug
                  changed this morning is a different kind of problem from one nobody
                  has edited in a year. */}
              {detail.updatedAtUtc !== detail.createdAtUtc && (
                <span className="inline-flex items-center gap-1.5">
                  <Pencil className="size-3.5 text-subtle" aria-hidden="true" />
                  Settings changed {formatDate(detail.updatedAtUtc)}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
              Last order
            </span>
            <span className="text-sm font-medium text-text">
              {sinceLabel(detail.lastOrderAtUtc, now)}
            </span>
          </div>
        </Surface>

        {/* Today, with the floor beside it. */}
        <Surface className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                Taken today
              </span>
              <p className="tabular text-[2rem] leading-10 font-semibold text-text">
                {money(today.takings, 2)}
              </p>
              <p className="text-xs text-muted">
                {today.ordersPlaced === 0
                  ? "No orders placed yet today."
                  : `${today.ordersPlaced} ${today.ordersPlaced === 1 ? "order" : "orders"} placed · ${today.completed} settled${today.cancelled > 0 ? ` · ${today.cancelled} cancelled` : ""}${today.averageOrderValue > 0 ? ` · ${money(today.averageOrderValue, 2)} average bill` : ""}`}
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-5">
              <Counter
                icon={ClipboardList}
                value={detail.openOrders}
                label="open orders"
              />
              <Counter
                icon={Flame}
                value={detail.platesAtPass}
                label="at the pass"
                tone={detail.platesAtPass > 0 ? "warning" : "neutral"}
              />
              <Counter
                icon={Star}
                value={reviews.averageRating ?? 0}
                label={
                  reviews.count === 0
                    ? "no reviews"
                    : `from ${reviews.count} ${reviews.count === 1 ? "review" : "reviews"}`
                }
                decimals={1}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <Bar
              label="Today"
              amount={today.takings}
              share={today.takings / peak}
              tone="primary"
            />
            <Bar
              label="Yesterday"
              amount={yesterday.takings}
              share={yesterday.takings / peak}
              tone="muted"
            />
          </div>

          <p className="mt-2.5 text-2xs text-subtle">
            Service day {detail.localDate} · read at {formatTime(detail.serverUtcNow)}
          </p>
        </Surface>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RecentDaysCard days={detail.days} />
          </div>
          <TenderCard byMethod={detail.byMethod} />
        </div>

        {/* What has actually been configured.

            Nine counts nobody can see anywhere else, and the answer to most support
            calls. A restaurant with forty dishes and no table taking orders looks
            perfectly healthy from the estate list and cannot take a single guest. */}
        <Surface className="flex flex-col">
          <SurfaceHeader
            title="Set-up"
            description="What exists inside this restaurant, and how much of it is switched on."
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
            <SetupTile
              icon={Armchair}
              label="Tables"
              value={setup.tables}
              note={
                setup.tables === 0
                  ? "None yet"
                  : setup.tablesTakingOrders === 0
                    ? "None taking orders"
                    : `${setup.tablesTakingOrders} taking orders`
              }
              alarm={setup.tables === 0 || setup.tablesTakingOrders === 0}
            />
            <SetupTile
              icon={UtensilsCrossed}
              label="Dishes"
              value={setup.menuItems}
              note={
                setup.menuItems === 0
                  ? "Menu is empty"
                  : `${setup.menuItemsActive} available`
              }
              alarm={setup.menuItems === 0 || setup.menuItemsActive === 0}
            />
            <SetupTile
              icon={ClipboardList}
              label="Categories"
              value={setup.menuCategories}
              note="On the menu"
            />
            <SetupTile
              icon={ChefHat}
              label="Staff"
              value={setup.staff}
              note={setup.staff === 0 ? "Nobody hired" : "Accounts"}
              alarm={setup.staff === 0}
            />
            <SetupTile
              icon={Boxes}
              label="Stock lines"
              value={setup.inventoryItems}
              note="Tracked"
            />
          </div>
        </Surface>

        {/* The floor, right now. Oldest first: the order that has been open longest
            is the one somebody needs to walk over and look at. */}
        <Surface className="flex flex-col">
          <SurfaceHeader
            title="On the floor now"
            description={
              detail.running.length === 0
                ? "Nothing is running."
                : `${detail.running.length} ${detail.running.length === 1 ? "order is" : "orders are"} open, longest first.`
            }
          />
          {detail.running.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">
              Every table is clear. Orders opened from now on will appear here.
            </p>
          ) : (
            <OrderTable orders={detail.running} now={now} showWaiting />
          )}
        </Surface>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* The roster. Read-only here: the manager of this restaurant hires and
              suspends, and a platform administrator watching over their shoulder
              should not have a second set of controls for it. */}
          <Surface className="flex h-full flex-col xl:col-span-1">
            <SurfaceHeader
              title="People"
              description={
                detail.manager === null
                  ? "Nobody is running this restaurant."
                  : `Run by ${detail.manager.fullName}.`
              }
            />
            <ul className="divide-y divide-border">
              {detail.manager !== null && (
                <PersonRow
                  name={detail.manager.fullName}
                  email={detail.manager.email}
                  role="Manager"
                  tone="primary"
                  isActive={detail.manager.isActive}
                />
              )}
              {detail.staff.map((person) => (
                <PersonRow
                  key={person.id}
                  name={person.fullName}
                  email={person.email}
                  role={person.role}
                  tone="neutral"
                  isActive={person.isActive}
                />
              ))}
              {detail.manager === null && detail.staff.length === 0 && (
                <li className="px-4 py-5 text-sm text-muted">
                  No accounts attached to this restaurant yet.
                </li>
              )}
            </ul>
          </Surface>

          {/* The last few to close. Not the ledger — the report is the ledger — but
              enough to see the shape of a service that has just finished. */}
          <Surface className="flex h-full flex-col xl:col-span-2">
            <SurfaceHeader
              title="Recently closed"
              description="The last orders to be settled or called off."
              actions={
                <Link
                  href="/admin/reports"
                  className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
                >
                  Full report
                </Link>
              }
            />
            {detail.recent.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">
                Nothing has been settled here yet.
              </p>
            ) : (
              <OrderTable orders={detail.recent} now={now} />
            )}
          </Surface>
        </div>
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/** Orders, running or closed, in one table. */
function OrderTable({
  orders,
  now,
  showWaiting = false,
}: {
  orders: PlatformRestaurantOrder[];
  now: number | null;
  /** Only the running list has anything waiting under the lamp. */
  showWaiting?: boolean;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Table</Th>
            <Th className="text-right">Items</Th>
            {showWaiting && <Th className="text-right">At pass</Th>}
            <Th className="text-right">Total</Th>
            <Th className="text-right">{showWaiting ? "Open for" : "Closed"}</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <Tr key={order.id}>
              <Td>
                <span className="tabular font-medium text-text">
                  #{order.orderNumber}
                </span>
                {!showWaiting && order.status === "Cancelled" && (
                  <Badge tone="danger" className="ml-2">
                    Cancelled
                  </Badge>
                )}
              </Td>
              <Td className="text-muted">{order.tableName}</Td>
              <Td className="tabular text-right text-muted">{order.itemCount}</Td>
              {showWaiting && (
                <Td className="tabular text-right">
                  {order.waitingAtPass === 0 ? (
                    <span className="text-subtle">—</span>
                  ) : (
                    <span className="font-medium text-warning">
                      {order.waitingAtPass}
                    </span>
                  )}
                </Td>
              )}
              <Td className="tabular text-right font-medium text-text">
                {money(order.total, 2)}
              </Td>
              <Td className="text-right whitespace-nowrap text-xs text-muted">
                {sinceLabel(
                  showWaiting ? order.createdAtUtc : order.closedAtUtc,
                  now,
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

/** One account attached to the restaurant. */
function PersonRow({
  name,
  email,
  role,
  tone,
  isActive,
}: {
  name: string;
  email: string;
  role: string;
  tone: "primary" | "neutral";
  isActive: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
          tone === "primary"
            ? "bg-primary-soft text-primary"
            : "bg-surface-3 text-muted",
        )}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-text">{name}</span>
        <span className="truncate text-2xs text-subtle">{email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {!isActive && (
          <Badge tone="danger" dot>
            Suspended
          </Badge>
        )}
        <span className="text-xs text-muted">{role}</span>
      </span>
    </li>
  );
}

/** One count in the set-up strip, with the thing it is short of said out loud. */
function SetupTile({
  icon: Icon,
  label,
  value,
  note,
  alarm = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  note: string;
  /** True when this count is the reason the restaurant cannot serve anybody. */
  alarm?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <span className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-subtle uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span
        className={cn(
          "tabular text-xl font-semibold",
          alarm ? "text-warning" : "text-text",
        )}
      >
        {value}
      </span>
      <span className={cn("text-xs", alarm ? "text-warning" : "text-muted")}>
        {note}
      </span>
    </div>
  );
}

/** A number with what it counts underneath it. */
function Counter({
  icon: Icon,
  value,
  label,
  tone = "neutral",
  decimals = 0,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: "neutral" | "warning";
  decimals?: number;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "tabular flex items-center gap-1.5 text-xl font-semibold",
          tone === "warning" ? "text-warning" : "text-text",
        )}
      >
        <Icon className="size-4 text-subtle" aria-hidden="true" />
        {money(value, decimals)}
      </span>
      <span className="text-2xs whitespace-nowrap text-muted">{label}</span>
    </div>
  );
}

/** Today against yesterday, on one scale. */
function Bar({
  label,
  amount,
  share,
  tone,
}: {
  label: string;
  amount: number;
  share: number;
  tone: "primary" | "muted";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-border",
          )}
          style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
        />
      </span>
      <span className="tabular w-24 shrink-0 text-right text-xs text-muted">
        {money(amount, 2)}
      </span>
    </div>
  );
}

function money(amount: number, decimals: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
