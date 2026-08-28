"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listOpenOrders } from "@/features/orders/api";
import type { OrderSummary } from "@/types/order";

/**
 * Open orders for the restaurant.
 *
 * Built for picking work up quickly rather than for administration: each order is
 * one large tap target showing the table, the number, what it is worth and how long
 * it has been open. Restaurant-wide, because cover is shared on a floor.
 */
export default function OrdersPage() {
  return (
    <RequireAuth roles={["Staff"]}>
      <Orders />
    </RequireAuth>
  );
}

function Orders() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listOpenOrders();
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

  const total = orders?.reduce((sum, order) => sum + order.subtotal, 0) ?? 0;
  const waiting =
    orders?.filter((order) => order.unsubmittedItemCount > 0).length ?? 0;

  return (
    <>
      <PageHeader
        title="Open orders"
        description="Tables with an order running. Tap one to add to it, change it, or send it to the kitchen."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Orders" }]}
        actions={
          <LinkButton href="/orders/new" icon={<Plus />}>
            New order
          </LinkButton>
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
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <Surface key={row} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-40" />
              </Surface>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<ClipboardList />}
              title="Nothing running"
              description="There are no open orders right now. Start one when a table is ready."
              action={
                <LinkButton href="/orders/new" icon={<Plus />}>
                  New order
                </LinkButton>
              }
            />
          </Surface>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted">
                {orders.length} {orders.length === 1 ? "order" : "orders"} open
                {waiting > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-warning">
                      {waiting} to send
                    </span>
                  </>
                )}
              </p>
              <p className="text-sm text-muted">
                <span className="tabular font-semibold text-text">
                  {total.toFixed(2)}
                </span>{" "}
                on the floor
              </p>
            </div>

            {/* Cards rather than table rows: a waiter is scanning for a table
                name on a phone, not comparing columns. */}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary-border hover:bg-primary-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-lg font-semibold text-text">
                          {order.tableName}
                        </span>
                        <span className="tabular text-2xs text-subtle">
                          Order #{order.orderNumber}
                        </span>
                      </div>
                      {/* The order status and the kitchen are two different
                          things: sending food out does not move an order off
                          Open, so the state badge stays and the kitchen gets
                          its own. */}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone="primary" dot>
                          {order.status}
                        </Badge>
                        {order.unsubmittedItemCount > 0 && (
                          <Badge tone="warning" dot>
                            {order.unsubmittedItemCount} to send
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="tabular text-xl font-semibold text-text">
                          {order.subtotal.toFixed(2)}
                        </span>
                        <span className="text-2xs text-muted">
                          {order.itemCount}{" "}
                          {order.itemCount === 1 ? "item" : "items"} ·{" "}
                          {formatAge(order.createdAtUtc)}
                        </span>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-subtle"
                        aria-hidden="true"
                      />
                    </div>

                    <span className="truncate border-t border-border pt-2 text-2xs text-subtle">
                      Taken by {order.createdByName}
                      {order.kitchenTicketCount > 0 && (
                        <>
                          {" · "}
                          {order.kitchenTicketCount}{" "}
                          {order.kitchenTicketCount === 1 ? "KOT" : "KOTs"} sent
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </PageBody>
    </>
  );
}

/** How long an order has been open, which is what a waiter actually reads. */
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
