"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, CircleCheck, FileText, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getReportSummary } from "@/features/reports/api";
import { isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { MAX_REPORT_DAYS } from "@/types/report";
import type { ReportOrder, ReportSummary } from "@/types/report";

/**
 * What the restaurant did over a range of days.
 *
 * Figures with the rows behind them, and nothing that pretends to be more than that:
 * no charts, no comparison with last week, no margin. Everything here is counted from
 * orders and payments that already exist, so a number on this page and the same number
 * on the billing screen can never disagree.
 *
 * Money taken and money not taken are kept visually apart, because adding them would
 * be the easiest way to make this screen lie.
 */
export default function ReportsPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <Reports />
    </RequireAuth>
  );
}

function Reports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // The dates the manager typed, held separately from the range actually reported on,
  // so the figures never claim to cover something that has not been fetched.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  // Fetching lives inside the effect and only touches state after awaiting, so the
  // effect never sets state synchronously as it runs. Showing the spinner is the
  // button job, because that is a real user action rather than a render.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getReportSummary(applied.from, applied.to);

        if (!cancelled) {
          setReport(loaded);
          setError(null);
          setNoRestaurant(false);
          // Adopt what the server actually reported on, which fills the inputs in on
          // the first load and corrects them if one date was read as a single day.
          setFrom(loaded.fromLocalDate);
          setTo(loaded.toLocalDate);
        }
      } catch (caught) {
        if (!cancelled) {
          setNoRestaurant(isMissingRestaurant(caught));
          setError(
            isMissingRestaurant(caught)
              ? null
              : caught instanceof Error
                ? caught.message
                : "Unable to load the report.",
          );
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
  }, [applied, reloadKey]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="What the restaurant took, and what it did not. Counted in the restaurant own days."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Reports" }]}
      />

      <PageBody>
        {/* The range. Plain dates, because they are the restaurant days and the server
            reads them in its timezone rather than the browser one. */}
        <Surface>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <Field label="From" htmlFor="from" className="w-40">
              <Input
                id="from"
                type="date"
                value={from}
                max={to === "" ? undefined : to}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field label="To" htmlFor="to" className="w-40">
              <Input
                id="to"
                type="date"
                value={to}
                min={from === "" ? undefined : from}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Button
              onClick={() => {
                setIsLoading(true);
                setApplied({ from, to });
              }}
              disabled={isLoading}
              icon={<Search />}
            >
              {isLoading ? "Loading…" : "Show"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsLoading(true);
                setApplied({ from: "", to: "" });
              }}
              disabled={isLoading}
            >
              Today
            </Button>
            <p className="ml-auto text-2xs text-subtle">
              Up to {MAX_REPORT_DAYS} days at a time.
            </p>
          </div>
        </Surface>

        {noRestaurant ? (
          <NoRestaurantAssigned area="Reports" />
        ) : error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => {
                setIsLoading(true);
                setReloadKey((key) => key + 1);
              }}
            />
          </Surface>
        ) : report === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((cell) => (
              <Surface key={cell} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-16" />
              </Surface>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              {report.dayCount === 1
                ? formatDate(report.fromLocalDate)
                : `${formatDate(report.fromLocalDate)} to ${formatDate(report.toLocalDate)}`}
              {" · "}
              <span className="tabular">{report.dayCount}</span>{" "}
              {report.dayCount === 1 ? "day" : "days"}
            </p>

            {/* Money that arrived, then the counts, then money that did not. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Figure
                label="Collected"
                value={report.paymentTotal.toFixed(2)}
                hint={`${report.paymentCount} ${report.paymentCount === 1 ? "payment" : "payments"}`}
                emphasis
              />
              <Figure
                label="Orders closed"
                value={String(report.completedCount)}
                hint="Paid for and completed"
              />
              <Figure
                label="Average bill"
                value={report.averageOrderValue.toFixed(2)}
                hint={
                  report.paymentCount === 0
                    ? "No payments in this range"
                    : "Collected over payments"
                }
              />
              <Figure
                label="Cancelled"
                value={String(report.cancelledCount)}
                hint={
                  report.cancelledValue > 0
                    ? `${report.cancelledValue.toFixed(2)} not taken`
                    : "Nothing cancelled"
                }
                tone={report.cancelledCount > 0 ? "danger" : "neutral"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* By tender. Every method, always, so a zero reads as a zero. */}
              <Surface>
                <SurfaceHeader
                  title="How it was paid"
                  description="Every method, including the ones nothing came in on"
                />
                <ul className="divide-y divide-border">
                  {report.byMethod.map((row) => (
                    <li
                      key={row.method}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">
                          {row.method}
                        </span>
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
                <div className="flex items-baseline justify-between border-t border-border bg-surface-2 px-4 py-3">
                  <span className="text-sm font-medium text-muted">Total collected</span>
                  <span className="tabular text-lg font-semibold text-text">
                    {report.paymentTotal.toFixed(2)}
                  </span>
                </div>
              </Surface>

              {/* Kept in its own panel rather than beside the takings, so it can never
                  be read as part of them. */}
              <Surface>
                <SurfaceHeader
                  title="Not taken"
                  description="Cancelled orders. Never counted as revenue."
                />
                {report.cancelledCount === 0 ? (
                  <EmptyState
                    icon={<CircleCheck />}
                    title="Nothing cancelled"
                    description="Every order in this range was either paid for or is still open."
                  />
                ) : (
                  <div className="flex flex-col gap-1 px-4 py-4">
                    <span className="tabular text-2xl font-semibold text-danger">
                      {report.cancelledValue.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted">
                      across {report.cancelledCount}{" "}
                      {report.cancelledCount === 1 ? "order" : "orders"} that were
                      called off
                    </span>
                  </div>
                )}
              </Surface>
            </div>

            <OrderList
              title="Completed"
              description="Paid for and closed, newest first"
              orders={report.completed}
              emptyTitle="No orders were closed"
              emptyDescription="Nothing was paid for in this range."
              showReceipt
            />

            <OrderList
              title="Cancelled"
              description="Called off, newest first, with the reason given"
              orders={report.cancelled}
              emptyTitle="No orders were cancelled"
              emptyDescription="Nothing was called off in this range."
            />
          </>
        )}
      </PageBody>
    </>
  );
}

function Figure({
  label,
  value,
  hint,
  emphasis = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <Surface className="flex flex-col gap-1 px-4 py-3.5">
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
      </span>
      <span
        className={cn(
          "tabular font-semibold",
          emphasis ? "text-[1.75rem] leading-9" : "text-2xl leading-8",
          tone === "danger" ? "text-danger" : "text-text",
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted">{hint}</span>
    </Surface>
  );
}

/**
 * The rows behind a figure.
 *
 * Deliberately not a table. These are here to be recognised and opened, not compared
 * column by column, and a completed row carries a way through to its receipt.
 */
function OrderList({
  title,
  description,
  orders,
  emptyTitle,
  emptyDescription,
  showReceipt = false,
}: {
  title: string;
  description: string;
  orders: ReportOrder[];
  emptyTitle: string;
  emptyDescription: string;
  showReceipt?: boolean;
}) {
  return (
    <Surface>
      <SurfaceHeader
        title={title}
        description={description}
        actions={
          orders.length > 0 ? (
            <span className="tabular text-sm text-muted">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </span>
          ) : undefined
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-text">
                  {order.tableName}
                  <span className="tabular ml-1.5 text-2xs font-normal text-subtle">
                    order #{order.orderNumber}
                  </span>
                </span>
                <span className="text-2xs text-muted">
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
                  {formatDateTime(order.closedAtUtc)}
                  {order.method !== null && ` · ${order.method}`}
                </span>
                {order.reason !== null && (
                  <span className="text-2xs text-muted italic">{order.reason}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "tabular text-sm font-semibold",
                    order.method === null
                      ? "text-muted line-through"
                      : "text-text",
                  )}
                >
                  {order.amount.toFixed(2)}
                </span>
                {order.method === null ? (
                  <Badge tone="danger" dot>
                    <Ban className="size-3" aria-hidden="true" />
                    Cancelled
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    Paid
                  </Badge>
                )}
                {showReceipt && (
                  <Link
                    href={`/billing/${order.id}/receipt`}
                    className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline"
                  >
                    <Receipt className="size-3.5" aria-hidden="true" />
                    Receipt
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/** A yyyy-MM-dd date as a person reads it, without shifting it into another day. */
function formatDate(localDate: string): string {
  const parts = localDate.split("-").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return localDate;
  }

  // Built as a local date rather than parsed as an instant: these are the restaurant
  // own calendar days, and running them through a timezone would move them.
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
