"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  Flame,
  History,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listBillingOrders } from "@/features/billing/api";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { cn } from "@/lib/utils/cn";
import type { BillingOrderSummary } from "@/types/billing";

/**
 * The billing queue.
 *
 * Built for the counter rather than for administration: the manager is looking for
 * the table that wants to pay, so an order is one card carrying the amount, the
 * kitchen state and whether it can be settled. Orders ready to close are marked as
 * such, and the ones still waiting on the kitchen say so on their face rather than
 * simply refusing later.
 */
export default function BillingPage() {
  return (
    <RequireAuth roles={["RestaurantManager", "Staff"]} staffRoles={["Waiter"]}>
      <Billing />
    </RequireAuth>
  );
}

function Billing() {
  const [orders, setOrders] = useState<BillingOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // The list of what can be settled changes without this screen doing anything: a
  // waiter sends the last ticket, the kitchen finishes it, somebody settles a bill on
  // another till. All three used to need a reload to see.
  useRealtimeEvent("orderPlaced", reload);
  useRealtimeEvent("ticketQueued", reload);
  useRealtimeEvent("ticketReady", reload);
  useRealtimeEvent("ticketRecalled", reload);
  useRealtimeEvent("ticketServed", reload);
  useRealtimeEvent("billRequested", reload);
  useRealtimeEvent("orderSettled", reload);
  useRealtimeEvent("orderCancelled", reload);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Recently settled orders come back too, so the manager can confirm the
        // last few without leaving the screen.
        const loaded = await listBillingOrders(true);
        if (!cancelled) {
          setOrders(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load orders.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const open = orders?.filter((order) => order.status === "Open") ?? [];
  const settled = orders?.filter((order) => order.status === "Completed") ?? [];
  const ready = open.filter((order) => order.canSettle);
  // What the floor is actually owed, which is the total and not the food. The
  // subtotal understates every open bill by the tax and the service charge.
  const outstanding = open.reduce((sum, order) => sum + order.amountOutstanding, 0);
  const asking = open.filter((order) => order.billRequestedAtUtc !== null).length;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Settle a table and close its order. Recording a payment does not connect to any payment provider."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Billing" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* First, because a table that has asked to pay is a person waiting rather
                than a bill that happens to be settleable. */}
            {asking > 0 && (
              <Badge tone="warning" dot>
                {asking} asking to pay
              </Badge>
            )}
            <Badge tone={ready.length > 0 ? "success" : "neutral"} dot>
              {ready.length} ready to settle
            </Badge>
            <Badge tone="neutral">
              <span className="tabular">{outstanding.toFixed(2)}</span> outstanding
            </Badge>
            <LinkButton
              href="/billing/history"
              variant="secondary"
              icon={<History />}
            >
              History
            </LinkButton>
          </div>
        }
      />

      <PageBody>
        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : orders === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Surface key={row} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-36" />
              </Surface>
            ))}
          </div>
        ) : (
          <>
            {open.length === 0 ? (
              <Surface>
                <EmptyState
                  icon={<ReceiptText />}
                  title="Nothing to settle"
                  description="Open orders appear here as waiters take them. Once the kitchen finishes, you can close them."
                  action={
                    <LinkButton
                      href="/billing/history"
                      variant="secondary"
                      icon={<History />}
                    >
                      See order history
                    </LinkButton>
                  }
                />
              </Surface>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {open.map((order) => (
                  <li key={order.id}>
                    <OrderCard order={order} />
                  </li>
                ))}
              </ul>
            )}

            {settled.length > 0 && (
              <Surface>
                <SurfaceHeader
                  title="Just settled"
                  description="The most recent payments, kept for confirmation"
                  actions={
                    <Link
                      href="/billing/history"
                      className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
                    >
                      Full history
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  }
                />
                <ul className="divide-y divide-border">
                  {settled.map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-text">
                          {order.tableName}
                          <span className="tabular ml-1.5 text-2xs text-subtle">
                            #{order.orderNumber}
                          </span>
                        </span>
                        <span className="text-2xs text-muted">
                          {order.payments.length === 0
                            ? "Closed"
                            : order.payments.length === 1
                              ? `${order.payments[0]!.method} · ${order.payments[0]!.recordedByName}`
                              : `Split over ${order.payments.length} payments`}
                          {order.completedAtUtc !== null &&
                            ` · ${formatTime(order.completedAtUtc)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-sm font-semibold text-text">
                          {(order.payments.length === 0
                            ? order.total
                            : order.amountPaid
                          ).toFixed(2)}
                        </span>
                        <Badge tone="success" dot>
                          Paid
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

/**
 * One open order.
 *
 * The amount is the largest thing on the card, because that is what the manager is
 * about to take. The kitchen state sits directly under it, since it is the only
 * thing that decides whether this card is actionable at all.
 */
function OrderCard({ order }: { order: BillingOrderSummary }) {
  const waiting = order.unfinishedKitchenTicketCount;

  return (
    <Link
      href={`/billing/${order.id}`}
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border bg-surface p-4 transition-colors",
        order.billRequestedAtUtc !== null
          ? "border-warning-border hover:bg-warning-soft"
          : order.canSettle
            ? "border-success-border hover:bg-success-soft"
            : "border-border hover:border-primary-border hover:bg-primary-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold text-text">{order.tableName}</span>
          <span className="tabular text-2xs text-subtle">
            Order #{order.orderNumber}
          </span>
        </div>
        {/*
          Three states, not two. An order nobody sent to the kitchen and an order the
          kitchen is still cooking both fail to be settleable, but they need different
          people to act: the first needs a waiter, the second needs time.
        */}
        {order.billRequestedAtUtc !== null ? (
          <Badge tone="warning" dot>
            Asking to pay
          </Badge>
        ) : order.canSettle ? (
          <Badge tone="success" dot>
            Ready to settle
          </Badge>
        ) : order.unsentItemCount > 0 ? (
          <Badge tone="danger" dot>
            Not sent to kitchen
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            In the kitchen
          </Badge>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="tabular text-2xl leading-7 font-semibold text-text">
            {order.subtotal.toFixed(2)}
          </span>
          <span className="text-2xs text-muted">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
            {formatAge(order.createdAtUtc)}
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden="true" />
      </div>

      {/* Said plainly on the card, so nothing is greyed out without a reason. */}
      <span className="flex items-center gap-1.5 border-t border-border pt-2 text-2xs">
        {waiting > 0 ? (
          <>
            <Flame className="size-3 shrink-0 text-warning" aria-hidden="true" />
            <span className="text-muted">
              {waiting} {waiting === 1 ? "ticket" : "tickets"} still cooking
            </span>
          </>
        ) : order.unsentItemCount > 0 ? (
          <>
            <Flame className="size-3 shrink-0 text-danger" aria-hidden="true" />
            <span className="text-danger">
              {order.unsentItemCount}{" "}
              {order.unsentItemCount === 1 ? "item" : "items"} still with the waiter
            </span>
          </>
        ) : order.kitchenTicketCount === 0 ? (
          <>
            <Wallet className="size-3 shrink-0 text-subtle" aria-hidden="true" />
            <span className="text-muted">Nothing went to the kitchen</span>
          </>
        ) : (
          <>
            <CircleCheck className="size-3 shrink-0 text-success" aria-hidden="true" />
            <span className="text-muted">
              All {order.kitchenTicketCount}{" "}
              {order.kitchenTicketCount === 1 ? "ticket" : "tickets"} ready
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** How long the table has been open, which is what a manager reads. */
function formatAge(isoString: string): string {
  const placed = new Date(isoString);

  if (Number.isNaN(placed.getTime())) {
    return "—";
  }

  const minutes = Math.max(0, Math.round((Date.now() - placed.getTime()) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m ago`;
}
