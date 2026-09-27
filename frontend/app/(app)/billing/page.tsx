"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  Flame,
  Hand,
  History,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { StatTile } from "@/components/ui/stat-tile";
import { money } from "@/features/analytics/format";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useQueryClient } from "@tanstack/react-query";
import { managerKeys, useBillingOrders } from "@/queries/manager";
import { useRealtimeEvent, useRealtimeResync } from "@/lib/realtime/realtime-context";
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
  // From the shared cache, so billing opens at once with the orders last seen and
  // refreshes behind itself. The events below only mark the list stale.
  const ordersQuery = useBillingOrders();
  const client = useQueryClient();
  const orders = ordersQuery.data ?? null;
  const error =
    ordersQuery.data === undefined && ordersQuery.error !== null
      ? ordersQuery.error instanceof Error
        ? ordersQuery.error.message
        : "Unable to load orders."
      : null;
  const reload = useCallback(() => {
    void client.invalidateQueries({ queryKey: managerKeys.billingList() });
  }, [client]);

  // Anything sent while the connection was down is not coming, so re-read on return.
  useRealtimeResync(reload);

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
        actions={
          <div className="flex items-center gap-2">
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
        {/* The money owed, then the three things that decide who to go to first. A
            table that has asked to pay is a person waiting, so it comes before a
            bill that merely could be settled. */}
        {orders !== null && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              featured
              className="col-span-2 xl:col-span-1"
              icon={Wallet}
              label="Outstanding"
              value={
                <>
                  <span className="mr-1 text-lg font-medium opacity-70">NPR</span>
                  {money(outstanding, 2)}
                </>
              }
              footnote={open.length === 0 ? "Every table has paid" : "owed across open orders"}
            />
            <StatTile
              icon={Hand}
              tone="peach"
              label="Asking to pay"
              value={asking}
              footnote={
                asking > 0 ? <span className="font-semibold text-warning">Go to these first</span> : "Nobody waiting"
              }
            />
            <StatTile
              icon={CircleCheck}
              tone="teal"
              label="Ready to settle"
              value={ready.length}
              footnote="kitchen has finished"
            />
            <StatTile
              icon={ReceiptText}
              tone="indigo"
              label="Open orders"
              value={open.length}
              footnote={`${settled.length} settled recently`}
            />
          </div>
        )}

        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={reload}
            />
          </Surface>
        ) : orders === null ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Skeleton className="col-span-2 h-32 rounded-2xl bg-accent/60 xl:col-span-1" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-40 rounded-2xl" />
              ))}
            </div>
          </>
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
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-ink hover:text-surface"
                    >
                      Full history
                      <ChevronRight className="size-3" aria-hidden="true" />
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
                          NPR{" "}
                          {money(order.payments.length === 0 ? order.total : order.amountPaid, 2)}
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
        "ui-surface flex h-full flex-col gap-3 rounded-2xl border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        order.billRequestedAtUtc !== null
          ? "border-warning-border ring-1 ring-warning-border"
          : order.canSettle
            ? "border-success-border ring-1 ring-success-border"
            : "border-border hover:border-ink",
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
          {/* What the table owes - the total, with tax and service - rather than the
              food subtotal, which understated every open bill. */}
          <span className="tabular text-2xl leading-7 font-semibold text-text">
            <span className="mr-1 text-sm font-medium text-subtle">NPR</span>
            {money(order.amountOutstanding, 2)}
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
