"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChartNoAxesColumn,
  Download,
  Minus,
  Search,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { getPlatformReport } from "@/features/platform/api";
import { ReportRangeCard, TenderCard, WeekdayCard } from "@/features/analytics/charts";
import { money as amount } from "@/features/analytics/format";
import { cn } from "@/lib/utils/cn";
import type { PlatformReport, PlatformRestaurantRow } from "@/types/platform";

/**
 * What every restaurant took, for a platform administrator.
 *
 * The manager report at /reports answers one restaurant. This answers the estate, and
 * it is a separate screen rather than the same one behaving differently, because the
 * two questions are genuinely different: a manager wants the rows behind their own
 * figures, an administrator wants to know which restaurants are trading at all.
 *
 * The screen is built around one idea the old version was missing entirely. A report
 * over a range is not a total; it is a shape. Every band below cuts the same set of
 * settled orders a different way - along time, along the week, along tender, along
 * restaurant, along the reasons money never arrived - and every one of them adds back
 * up to the headline, because they are all read out of one window.
 *
 * The figure worth explaining, and explained on screen: nothing here is stored or
 * rolled up. Every number is computed from the orders and payments themselves at the
 * moment of asking, which is the only way this report and each restaurant billing
 * screen are guaranteed to agree.
 */
export default function PlatformReportsPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <PlatformReports />
    </RequireAuth>
  );
}

function PlatformReports() {
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Range>(() => presetRange("30d"));
  const [preset, setPreset] = useState<PresetKey | "custom">("30d");
  const [from, setFrom] = useState(() => presetRange("30d").from);
  const [to, setTo] = useState(() => presetRange("30d").to);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("takings");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPlatformReport(applied);

        if (!cancelled) {
          setReport(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the report.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [applied, reloadKey]);

  function apply(next: Range, key: PresetKey | "custom") {
    setFrom(next.from);
    setTo(next.to);
    setPreset(key);
    setApplied(next);
    setReport(null);
  }

  const rows = useMemo(() => {
    if (report === null) {
      return [];
    }

    const term = search.trim().toLowerCase();
    const matched =
      term === ""
        ? report.restaurants
        : report.restaurants.filter((row) =>
            [row.name, row.slug, row.managerName ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(term),
          );

    return [...matched].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "bills":
          return b.completedCount - a.completedCount || b.paymentTotal - a.paymentTotal;
        case "average":
          return b.averageOrderValue - a.averageOrderValue;
        case "movement":
          return movementOf(b) - movementOf(a);
        default:
          return b.paymentTotal - a.paymentTotal || a.name.localeCompare(b.name);
      }
    });
  }, [report, search, sort]);

  return (
    <>
      <PageHeader
        title="Platform reports"
        description="What every restaurant took, cut along time, tender and restaurant. One service day boundary for the whole estate, so these totals are the sum of what each manager sees."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Reports" }]}
        actions={
          report !== null ? (
            <Button
              variant="secondary"
              icon={<Download />}
              onClick={() => downloadCsv(report)}
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        {/* The range, and what it is being read against.

            Presets first, dates second. The old version opened on a single day and
            offered two date pickers, which made "how did last week go" a typing
            exercise; almost nobody asks a report for an arbitrary window before they
            have asked it for the obvious ones. */}
        <Surface>
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((option) => (
                <RangeChip
                  key={option.key}
                  active={preset === option.key}
                  onClick={() => apply(presetRange(option.key), option.key)}
                >
                  {option.label}
                </RangeChip>
              ))}
            </div>

            <form
              className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                apply({ from, to }, "custom");
              }}
            >
              <Field htmlFor="from" label="From" className="w-40">
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Field>

              <Field htmlFor="to" label="To" className="w-40">
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Field>

              <Button type="submit" variant="secondary">
                Apply
              </Button>

              {report !== null && (
                <p className="ml-auto text-right text-xs text-muted">
                  <span className="block text-sm text-text">
                    {report.fromLocalDate === report.toLocalDate
                      ? report.fromLocalDate
                      : `${report.fromLocalDate} → ${report.toLocalDate}`}{" "}
                    <span className="text-muted">
                      ({report.dayCount} {report.dayCount === 1 ? "day" : "days"})
                    </span>
                  </span>
                  against {report.previous.fromLocalDate} →{" "}
                  {report.previous.toLocalDate}
                </p>
              )}
            </form>
          </div>
        </Surface>

        {error !== null && (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        )}

        {report === null && error === null && (
          <Surface>
            <TableSkeleton rows={5} columns={6} />
          </Surface>
        )}

        {report !== null && (
          <>
            {/* Four figures, each with the direction it moved.

                A number with nothing behind it is not information. Every headline here
                carries the same figure for the period of equal length immediately
                before, so "collected 412,000" becomes "collected 412,000, up eight per
                cent", which is the sentence somebody actually repeats. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Collected"
                value={amount(report.paymentTotal)}
                previous={report.previous.paymentTotal}
                current={report.paymentTotal}
                hint={`${report.paymentCount} ${report.paymentCount === 1 ? "bill" : "bills"} from ${report.completedCount} ${report.completedCount === 1 ? "order" : "orders"} closed`}
              />
              <Stat
                label="Average bill"
                value={amount(report.averageOrderValue)}
                previous={report.previous.averageOrderValue}
                current={report.averageOrderValue}
                hint="Across every restaurant"
              />
              <Stat
                label="Trading"
                value={`${report.tradingCount} of ${report.restaurantCount}`}
                hint="Took at least one payment"
              />
              <Stat
                label="Not taken"
                value={amount(report.cancelledValue)}
                previous={report.previous.cancelledValue}
                current={report.cancelledValue}
                invert
                hint={`${report.cancelledCount} cancelled, never revenue`}
                tone="warning"
              />
            </div>

            {report.withoutManagerCount > 0 && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {report.withoutManagerCount}{" "}
                  {report.withoutManagerCount === 1
                    ? "restaurant has"
                    : "restaurants have"}{" "}
                  no manager assigned, so{" "}
                  {report.withoutManagerCount === 1 ? "it" : "they"} cannot trade at
                  all. Assign one under Managers.
                </span>
              </p>
            )}

            {/* The spine. */}
            <ReportRangeCard days={report.days} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <WeekdayCard byWeekday={report.byWeekday} />
              </div>
              <TenderCard byMethod={report.byMethod} />
            </div>

            {/* Where the money did not come from.

                The product has recorded a reason on every cancellation since it could
                cancel anything, and has never shown one anywhere. Sorted by value
                rather than by count: ten tables walking out costs less than one
                banquet called off, and this page is about money. */}
            {report.cancellations.length > 0 && (
              <Surface>
                <SurfaceHeader
                  title="Why orders were called off"
                  description={`${amount(report.cancelledValue)} never arrived, across ${report.cancelledCount} ${report.cancelledCount === 1 ? "order" : "orders"}. Heaviest first.`}
                />
                <TableWrap>
                  <Table className="min-w-[28rem]">
                    <thead>
                      <tr>
                        <Th>Reason</Th>
                        <Th className="text-right">Orders</Th>
                        <Th className="text-right">Value</Th>
                        <Th className="w-40">Share</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cancellations.map((row) => (
                        <Tr key={row.reason}>
                          <Td className="font-medium text-text">{row.reason}</Td>
                          <Td className="tabular text-right text-muted">{row.count}</Td>
                          <Td className="tabular text-right">{amount(row.value)}</Td>
                          <Td>
                            <ShareBar
                              share={
                                report.cancelledValue === 0
                                  ? 0
                                  : row.value / report.cancelledValue
                              }
                              tone="warning"
                            />
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Surface>
            )}

            <Surface>
              <SurfaceHeader
                title="By restaurant"
                description={
                  report.restaurantsTotal > report.restaurantCount
                    ? `Showing ${report.restaurantCount} of ${report.restaurantsTotal} restaurants.`
                    : "Every restaurant on the platform, and how it moved against the period before."
                }
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                        aria-hidden="true"
                      />
                      <Input
                        id="report-search"
                        type="search"
                        placeholder="Search"
                        className="w-44 pl-8"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        aria-label="Search restaurants in this report"
                      />
                    </div>
                  </div>
                }
              />

              {report.restaurants.length === 0 ? (
                <EmptyState
                  icon={<Store />}
                  title="No restaurants yet"
                  description="Create one under Restaurants, then assign it a manager."
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<Search />}
                  title="No restaurants match"
                  description="Try a different search term."
                  action={
                    <Button variant="secondary" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <TableWrap>
                  <Table className="min-w-[56rem]">
                    <thead>
                      <tr>
                        <SortHeader
                          column="name"
                          sort={sort}
                          onSort={setSort}
                          align="left"
                        >
                          Restaurant
                        </SortHeader>
                        <Th>Manager</Th>
                        <SortHeader column="bills" sort={sort} onSort={setSort}>
                          Closed
                        </SortHeader>
                        <Th className="text-right">Cancelled</Th>
                        <SortHeader column="average" sort={sort} onSort={setSort}>
                          Average
                        </SortHeader>
                        <SortHeader column="movement" sort={sort} onSort={setSort}>
                          Movement
                        </SortHeader>
                        <SortHeader column="takings" sort={sort} onSort={setSort}>
                          Collected
                        </SortHeader>
                        <Th className="w-32">Share</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <Tr key={row.id}>
                          <Td>
                            <Link
                              href={`/admin/restaurants/${row.id}`}
                              className="rounded font-medium text-text hover:text-primary hover:underline"
                            >
                              {row.name}
                            </Link>
                            <p className="font-mono text-2xs text-subtle">{row.slug}</p>
                          </Td>
                          <Td className="text-muted">
                            {row.managerName ?? <Badge tone="warning">Unassigned</Badge>}
                          </Td>
                          <Td className="tabular text-right text-muted">
                            {row.completedCount}
                          </Td>
                          <Td className="tabular text-right text-muted">
                            {row.cancelledCount === 0 ? "—" : row.cancelledCount}
                          </Td>
                          <Td className="tabular text-right text-muted">
                            {amount(row.averageOrderValue)}
                          </Td>
                          <Td className="text-right">
                            <Movement
                              current={row.paymentTotal}
                              previous={row.previousPaymentTotal}
                            />
                          </Td>
                          <Td className="tabular text-right font-medium text-text">
                            {amount(row.paymentTotal)}
                          </Td>
                          <Td>
                            <ShareBar
                              share={
                                report.paymentTotal === 0
                                  ? 0
                                  : row.paymentTotal / report.paymentTotal
                              }
                              tone="primary"
                            />
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Surface>

            <p className="flex items-start gap-2 text-xs text-subtle">
              <ChartNoAxesColumn
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Nothing here is stored or rolled up. Every figure is computed from the
                orders and payments themselves when you ask for it, which is the only
                way this report and each restaurant billing screen are guaranteed to
                agree. An order counts on the day it was settled or called off, not the
                day it was opened.
              </span>
            </p>
          </>
        )}
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The range                                                                  */
/* -------------------------------------------------------------------------- */

interface Range {
  from: string;
  to: string;
}

type PresetKey = "today" | "7d" | "30d" | "month" | "lastMonth";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

/**
 * The dates a preset resolves to.
 *
 * Worked out against the Nepal service day rather than the reader's clock, because
 * that is the boundary the server counts against. An administrator opening this from
 * another country and one from Kathmandu should be asking for the same days.
 */
function presetRange(key: PresetKey): Range {
  const today = nepalToday();

  switch (key) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "7d":
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case "month":
      return {
        from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
        to: iso(today),
      };
    case "lastMonth": {
      const first = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));

      return { from: iso(first), to: iso(last) };
    }
    default:
      return { from: iso(addDays(today, -29)), to: iso(today) };
  }
}

/** UTC+05:45, the one boundary every daily figure in this product is counted against. */
const NEPAL_OFFSET_MINUTES = 345;

function nepalToday(): Date {
  const shifted = new Date(Date.now() + NEPAL_OFFSET_MINUTES * 60_000);

  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One preset, as a chip. */
function RangeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary-border bg-primary-soft text-primary"
          : "border-border text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* The table                                                                  */
/* -------------------------------------------------------------------------- */

type SortKey = "takings" | "bills" | "average" | "movement" | "name";

/** How far a restaurant moved, as a share of where it was. */
function movementOf(row: PlatformRestaurantRow): number {
  return row.previousPaymentTotal === 0
    ? row.paymentTotal > 0
      ? Number.POSITIVE_INFINITY
      : 0
    : (row.paymentTotal - row.previousPaymentTotal) / row.previousPaymentTotal;
}

/** A column heading that sorts by itself. */
function SortHeader({
  column,
  sort,
  onSort,
  align = "right",
  children,
}: {
  column: SortKey;
  sort: SortKey;
  onSort: (next: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const active = sort === column;

  return (
    <Th className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-text",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active && "text-text",
        )}
      >
        {children}
        <ArrowDown
          className={cn("size-3 transition-opacity", active ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
      </button>
    </Th>
  );
}

/**
 * How one figure moved against the same figure last period.
 *
 * A restaurant that took nothing before and something now is not "up infinity per
 * cent" - it is new, and says so. Everything else gets a percentage, because a
 * percentage is what somebody compares between two rows of different sizes.
 */
function Movement({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return <span className="text-subtle">—</span>;
  }

  if (previous === 0) {
    return (
      <Badge tone="success" dot>
        New
      </Badge>
    );
  }

  const change = (current - previous) / previous;
  const flat = Math.abs(change) < 0.005;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-sm",
        flat ? "text-muted" : change > 0 ? "text-success" : "text-danger",
      )}
    >
      {flat ? (
        <Minus className="size-3" aria-hidden="true" />
      ) : change > 0 ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" aria-hidden="true" />
      )}
      {flat ? "flat" : `${Math.abs(Math.round(change * 100))}%`}
    </span>
  );
}

/** A restaurant's slice of the whole, drawn rather than left to arithmetic. */
function ShareBar({
  share,
  tone,
}: {
  share: number;
  tone: "primary" | "warning";
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
        />
      </span>
      <span className="tabular w-9 shrink-0 text-right text-2xs text-subtle">
        {share === 0 ? "—" : `${Math.round(share * 100)}%`}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The report as a spreadsheet.
 *
 * Both tables in one file, one after the other, rather than two downloads: whoever
 * opens this wants to put the daily series next to the restaurant rows, and a report
 * you cannot get out of the screen is a report somebody retypes.
 *
 * Built here rather than on the server because every figure in it is already on the
 * client, and an endpoint that rendered the same numbers a second time is a second
 * place for them to be wrong.
 */
function downloadCsv(report: PlatformReport) {
  const lines: string[][] = [
    ["Platform report", `${report.fromLocalDate} to ${report.toLocalDate}`],
    ["Compared with", `${report.previous.fromLocalDate} to ${report.previous.toLocalDate}`],
    [],
    ["Day", "Bills", "Takings", "Cancelled", "Cancelled value"],
    ...report.days.map((day) => [
      day.localDate,
      String(day.bills),
      day.takings.toFixed(2),
      String(day.cancelled),
      day.cancelledValue.toFixed(2),
    ]),
    [],
    [
      "Restaurant",
      "Slug",
      "Manager",
      "Closed",
      "Cancelled",
      "Average",
      "Collected",
      "Previous period",
    ],
    ...report.restaurants.map((row) => [
      row.name,
      row.slug,
      row.managerName ?? "",
      String(row.completedCount),
      String(row.cancelledCount),
      row.averageOrderValue.toFixed(2),
      row.paymentTotal.toFixed(2),
      row.previousPaymentTotal.toFixed(2),
    ]),
  ];

  const csv = lines.map((row) => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    // The byte order mark is what makes Excel read this as UTF-8 rather than as the
    // local codepage, which is the difference between a restaurant name and mojibake.
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = `platform-report-${report.fromLocalDate}-to-${report.toLocalDate}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

/** One CSV cell, safe for commas, quotes and newlines inside a restaurant name. */
function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.split('"').join('""')}"` : value;
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  current,
  previous,
  invert = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warning";
  /** Given together, these draw the movement against the period before. */
  current?: number;
  previous?: number;
  /** True where going up is bad news, as it is for cancellations. */
  invert?: boolean;
}) {
  return (
    <Surface className="flex flex-col gap-0.5 px-4 py-3">
      <p className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-baseline gap-2">
        <p
          className={cn(
            "tabular text-2xl font-semibold",
            tone === "warning" ? "text-warning" : "text-text",
          )}
        >
          {value}
        </p>
        {current !== undefined && previous !== undefined && (
          <Delta current={current} previous={previous} invert={invert} />
        )}
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </Surface>
  );
}

/** The headline version of Movement: smaller, and it knows which way is good. */
function Delta({
  current,
  previous,
  invert,
}: {
  current: number;
  previous: number;
  invert: boolean;
}) {
  if (previous === 0 || current === previous) {
    return null;
  }

  const change = (current - previous) / previous;
  const good = invert ? change < 0 : change > 0;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-medium",
        good ? "text-success" : "text-danger",
      )}
    >
      {change > 0 ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" aria-hidden="true" />
      )}
      {Math.abs(Math.round(change * 100))}%
    </span>
  );
}

