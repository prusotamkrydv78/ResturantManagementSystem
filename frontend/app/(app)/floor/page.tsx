"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  ChefHat,
  CircleCheck,
  Flame,
  Plus,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useAuth } from "@/features/auth/auth-context";
import { getManagerFloor, getWaiterFloor } from "@/features/floor/api";
import { cn } from "@/lib/utils/cn";
import type { FloorOverview, FloorTable } from "@/types/floor";

/** How often the floor refreshes itself, which also re-ages every label on it. */
const REFRESH_MS = 20_000;

/**
 * The live floor.
 *
 * One card per table, in the order the room is in, answering what is happening at
 * each one. Read only: occupancy is set by placing an order and cleared by settling
 * or cancelling it, and there is deliberately nothing here that sets it by hand.
 *
 * Shared by waiters and managers because they ask the same question of the same room.
 * What differs is what each does next, so only the actions on a card change: a waiter
 * seats guests and adds to orders, a manager takes money.
 */
export default function FloorPage() {
  return (
    <RequireAuth roles={["Staff", "RestaurantManager"]}>
      <FloorOverviewScreen />
    </RequireAuth>
  );
}

function FloorOverviewScreen() {
  const { user } = useAuth();
  const isManager = user?.platformRole === "RestaurantManager";

  const [floor, setFloor] = useState<FloorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = isManager ? await getManagerFloor() : await getWaiterFloor();
        if (!cancelled) {
          setFloor(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the floor.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isManager, reloadKey]);

  // One timer for the whole screen. Refetching also re-ages every elapsed label, so
  // there is no second clock to keep in step.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <PageHeader
        title="Floor"
        description={
          isManager
            ? "Every table and what is happening at it. Occupancy follows the orders."
            : "Every table and what is happening at it. Tap a free table to seat guests."
        }
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Floor" }]}
        actions={
          <div className="flex items-center gap-2">
            {floor !== null && (
              <>
                <Badge tone={floor.availableCount > 0 ? "success" : "neutral"} dot>
                  {floor.availableCount} free
                </Badge>
                <Badge tone={floor.occupiedCount > 0 ? "primary" : "neutral"} dot>
                  {floor.occupiedCount} working
                </Badge>
              </>
            )}
            <Button
              variant="secondary"
              onClick={() => setReloadKey((key) => key + 1)}
              icon={<RefreshCw />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <PageBody className="lg:max-w-none">
        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : floor === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <Surface key={cell} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </Surface>
            ))}
          </div>
        ) : floor.totalCount === 0 ? (
          <Surface>
            <EmptyState
              icon={<Armchair />}
              title="No tables yet"
              description={
                isManager
                  ? "Add tables and they will appear here as soon as they are in service."
                  : "This restaurant has no tables set up yet. Your manager can add them."
              }
              action={
                isManager ? (
                  <LinkButton href="/settings/tables" variant="secondary">
                    Add tables
                  </LinkButton>
                ) : undefined
              }
            />
          </Surface>
        ) : (
          <>
            {/* One line of real numbers, then the room itself. */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted">
              <span>
                <span className="tabular font-semibold text-text">
                  {floor.seatsOccupied}
                </span>
                {" of "}
                <span className="tabular">{floor.seatsInService}</span> seats in use
              </span>
              <span>
                <span className="tabular font-semibold text-text">
                  {floor.openValue.toFixed(2)}
                </span>{" "}
                open on the floor
              </span>
              {floor.readyToSettleCount > 0 && (
                <span className="font-medium text-success">
                  {floor.readyToSettleCount} ready to settle
                </span>
              )}
              {floor.outOfServiceCount > 0 && (
                <span>
                  <span className="tabular">{floor.outOfServiceCount}</span> out of
                  service
                </span>
              )}
              <span className="text-subtle">
                updated {formatTime(floor.generatedAtUtc)}
              </span>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {floor.tables.map((table) => (
                <li key={table.id}>
                  <TableCard table={table} isManager={isManager} />
                </li>
              ))}
            </ul>
          </>
        )}
      </PageBody>
    </>
  );
}

/**
 * One table.
 *
 * The state is carried by the left edge and a badge, and the card only offers what
 * that state actually allows. A free table offers seating, a working table offers the
 * order on it, and a table out of service offers nothing but says why.
 */
function TableCard({
  table,
  isManager,
}: {
  table: FloorTable;
  isManager: boolean;
}) {
  const isWorking = table.openOrders.length > 0;
  const primary = table.openOrders[0];

  // Both facts are shown as the server sent them. When they disagree, the card says
  // so rather than guessing which is right: nothing here writes occupancy, so the
  // honest thing is to surface it for someone who can look.
  const isPhantom = table.status === "Occupied" && !isWorking && table.isActive;

  return (
    <Surface
      className={cn(
        "flex h-full flex-col border-l-4",
        !table.isActive
          ? "border-l-border-strong opacity-70"
          : table.canSettle
            ? "border-l-success"
            : isWorking
              ? "border-l-primary"
              : "border-l-border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold text-text">{table.name}</span>
          <span className="flex items-center gap-1 text-2xs text-subtle">
            <Users className="size-3" aria-hidden="true" />
            {table.capacity} {table.capacity === 1 ? "seat" : "seats"}
            {table.seatedSinceUtc !== null && ` · ${formatAge(table.seatedSinceUtc)}`}
          </span>
        </div>

        {!table.isActive ? (
          <Badge tone="neutral">Out of service</Badge>
        ) : table.canSettle ? (
          <Badge tone="success" dot>
            Ready to settle
          </Badge>
        ) : isWorking ? (
          <Badge tone="primary" dot>
            {table.status}
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Free
          </Badge>
        )}
      </div>

      {/* What is on the table */}
      {isWorking ? (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="tabular text-xl leading-7 font-semibold text-text">
                {table.openValue.toFixed(2)}
              </span>
              <span className="text-2xs text-muted">
                {table.openItemCount}{" "}
                {table.openItemCount === 1 ? "item" : "items"}
                {table.openOrders.length === 1
                  ? ` · order #${primary!.orderNumber}`
                  : ` · ${table.openOrders.length} orders`}
              </span>
            </div>
          </div>

          {/* Kitchen chips, only for what is actually there. */}
          <div className="flex flex-wrap gap-1.5">
            {table.preparingTicketCount > 0 && (
              <Chip tone="warning" icon={<Flame className="size-3" />}>
                {table.preparingTicketCount} cooking
              </Chip>
            )}
            {table.pendingTicketCount > 0 && (
              <Chip tone="primary" icon={<ChefHat className="size-3" />}>
                {table.pendingTicketCount} waiting
              </Chip>
            )}
            {table.readyTicketCount > 0 && (
              <Chip tone="success" icon={<CircleCheck className="size-3" />}>
                {table.readyTicketCount} ready
              </Chip>
            )}
            {table.unsubmittedItemCount > 0 && (
              <Chip tone="neutral" icon={<Plus className="size-3" />}>
                {table.unsubmittedItemCount} not sent
              </Chip>
            )}
          </div>

          <span className="truncate text-2xs text-subtle">
            Taken by {primary!.placedByName}
          </span>
        </div>
      ) : (
        <div className="flex flex-1 items-center border-t border-border px-4 py-3">
          <p className="text-sm text-muted">
            {!table.isActive
              ? "Not in service, so no order can be placed on it."
              : "Nothing running. Ready for guests."}
          </p>
        </div>
      )}

      {isPhantom && (
        <div className="flex items-start gap-2 border-t border-warning-border bg-warning-soft px-4 py-2.5">
          <TriangleAlert
            className="mt-0.5 size-3.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="text-2xs text-muted">
            Marked occupied with no open order on it. Nothing on this screen changes
            table state, so this needs looking at.
          </p>
        </div>
      )}

      {/* Only what this state allows. */}
      <div className="mt-auto flex flex-col gap-2 border-t border-border bg-surface-2 p-3">
        {isWorking ? (
          table.openOrders.length === 1 ? (
            <LinkButton
              href={
                isManager ? `/billing/${primary!.id}` : `/orders/${primary!.id}`
              }
              variant={table.canSettle && isManager ? "primary" : "secondary"}
              className="w-full"
              icon={isManager ? <ReceiptText /> : undefined}
            >
              {isManager
                ? table.canSettle
                  ? "Settle the bill"
                  : "View the bill"
                : "Open the order"}
            </LinkButton>
          ) : (
            // More than one order on a table is legitimate, so each is listed rather
            // than one being picked for the manager.
            <ul className="flex flex-col gap-1.5">
              {table.openOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={isManager ? `/billing/${order.id}` : `/orders/${order.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-primary-border hover:bg-primary-soft"
                  >
                    <span className="tabular font-medium text-text">
                      #{order.orderNumber}
                    </span>
                    <span className="flex items-center gap-2">
                      {order.canComplete && (
                        <span className="text-2xs font-medium text-success">
                          ready
                        </span>
                      )}
                      <span className="tabular font-semibold text-text">
                        {order.subtotal.toFixed(2)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : table.isActive && !isManager ? (
          <LinkButton href="/orders/new" className="w-full" icon={<Plus />}>
            Seat guests
          </LinkButton>
        ) : (
          <Button variant="secondary" disabled className="w-full">
            {table.isActive ? "Nothing to do" : "Out of service"}
          </Button>
        )}
      </div>
    </Surface>
  );
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: "neutral" | "primary" | "success" | "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-surface-3 text-muted",
    primary: "border-primary-border bg-primary-soft text-primary",
    success: "border-success-border bg-success-soft text-success",
    warning: "border-warning-border bg-warning-soft text-warning",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** How long the table has been working, which is what staff actually read. */
function formatAge(isoString: string): string {
  const seated = new Date(isoString);

  if (Number.isNaN(seated.getTime())) {
    return "—";
  }

  const minutes = Math.max(0, Math.round((Date.now() - seated.getTime()) / 60000));

  if (minutes < 1) {
    return "just seated";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m`;
}
