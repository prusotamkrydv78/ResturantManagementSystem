"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CircleCheck, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listOrderHistory } from "@/features/billing/api";
import { cn } from "@/lib/utils/cn";
import type { OrderHistoryEntry } from "@/types/billing";
import type { OrderStatus } from "@/types/order";

/** The outcomes an order can end on, plus the unfiltered view. */
type Filter = "All" | Exclude<OrderStatus, "Open">;

const FILTERS: readonly Filter[] = ["All", "Completed", "Cancelled"];

/**
 * What happened to orders that have ended.
 *
 * A record, not a report. One row per order with its outcome and the reason behind
 * it, so a manager can answer "why did table four pay nothing on Tuesday". There
 * are deliberately no totals, groupings, averages or charts here: nothing has been
 * built that could compute them honestly, and a history list quietly growing into
 * an analytics screen is how that starts.
 */
export default function OrderHistoryPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <OrderHistory />
    </RequireAuth>
  );
}

function OrderHistory() {
  const [entries, setEntries] = useState<OrderHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listOrderHistory(
          filter === "All" ? undefined : filter,
        );
        if (!cancelled) {
          setEntries(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the history.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  return (
    <>
      <PageHeader
        title="Order history"
        description="Orders that have ended, newest first. Nothing here can be changed."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Billing", href: "/billing" },
          { label: "History" },
        ]}
        actions={
          <LinkButton href="/billing" variant="secondary" icon={<ArrowLeft />}>
            Billing
          </LinkButton>
        }
      />

      <PageBody>
        {/* Three states rather than a search form. The question a manager brings to
            this screen is almost always which of the two endings they want. */}
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((option) => {
            const isActive = option === filter;

            return (
              <button
                key={option}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  setFilter(option);
                  setEntries(null);
                }}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted hover:bg-surface-3 hover:text-text",
                )}
              >
                {option === "All" ? "Everything" : option}
              </button>
            );
          })}
        </div>

        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : entries === null ? (
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-2/5" />
          </Surface>
        ) : entries.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<History />}
              title="Nothing here yet"
              description={
                filter === "Cancelled"
                  ? "No orders have been cancelled."
                  : filter === "Completed"
                    ? "No orders have been paid for and closed yet."
                    : "Orders appear here once they are settled or cancelled."
              }
            />
          </Surface>
        ) : (
          <>
            <p className="text-sm text-muted">
              {entries.length} {entries.length === 1 ? "order" : "orders"}
            </p>

            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <HistoryRow entry={entry} />
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
 * One ended order.
 *
 * The outcome is carried by an edge colour and a badge rather than by the amount,
 * because a cancelled order still has a total and reading it as takings would be
 * wrong. Cancelled rows show the reason on their face: it is the whole point of
 * keeping them.
 */
function HistoryRow({ entry }: { entry: OrderHistoryEntry }) {
  const isCancelled = entry.status === "Cancelled";

  return (
    <Link
      href={`/billing/${entry.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-l-4 bg-surface p-4 transition-colors",
        "border-border hover:border-primary-border hover:bg-primary-soft",
        isCancelled ? "border-l-danger" : "border-l-success",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-medium text-text">
            {entry.tableName}
            <span className="tabular ml-1.5 text-2xs font-normal text-subtle">
              order #{entry.orderNumber}
            </span>
          </span>
          <span className="text-2xs text-muted">
            {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
            {entry.kitchenTicketCount > 0 &&
              ` · ${entry.kitchenTicketCount} ${entry.kitchenTicketCount === 1 ? "KOT" : "KOTs"}`}{" "}
            · taken by {entry.placedByName} · closed{" "}
            {formatDateTime(entry.closedAtUtc)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-col items-end">
            <span
              className={cn(
                "tabular text-lg font-semibold",
                isCancelled ? "text-muted line-through" : "text-text",
              )}
            >
              {(entry.payment?.amount ?? entry.subtotal).toFixed(2)}
            </span>
            {entry.payment !== null && (
              <span className="text-2xs text-subtle">
                {entry.payment.method} · {entry.payment.recordedByName}
              </span>
            )}
          </div>

          {isCancelled ? (
            <Badge tone="danger" dot>
              <Ban className="size-3" aria-hidden="true" />
              Cancelled
            </Badge>
          ) : (
            <Badge tone="success" dot>
              <CircleCheck className="size-3" aria-hidden="true" />
              Paid
            </Badge>
          )}
        </div>
      </div>

      {entry.cancellation !== null && (
        <p className="border-t border-border pt-2 text-xs text-muted">
          <span className="font-medium text-text">Reason:</span>{" "}
          {entry.cancellation.reason}
          <span className="text-subtle">
            {" — "}
            {entry.cancellation.cancelledByName}
          </span>
        </p>
      )}
    </Link>
  );
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
