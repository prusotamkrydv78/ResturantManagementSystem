"use client";

import { useEffect, useState } from "react";
import { ChartNoAxesColumn, Store, TriangleAlert } from "lucide-react";
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
import type { PlatformReport } from "@/types/platform";

/**
 * What every restaurant took, for a platform administrator.
 *
 * The manager report at /reports answers one restaurant. This answers the estate, and it
 * is a separate screen rather than the same one behaving differently, because the two
 * questions are genuinely different: a manager wants the rows behind their own figures,
 * an administrator wants to know which restaurants are trading at all.
 *
 * The figure worth explaining on screen, and explained on screen: each restaurant range
 * is read in its own timezone and service day, so this total is the sum of exactly what
 * each manager sees. Two rows can therefore cover slightly different absolute windows.
 * The alternative was one absolute window for everybody, which produces a headline that
 * disagrees with every manager in the estate.
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <>
      <PageHeader
        title="Platform reports"
        description="What every restaurant took. Each one is read in its own calendar, so these totals are the sum of what each manager sees on their own report."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Reports" }]}
        actions={
          report !== null ? (
            <Badge tone="neutral">
              {report.dayCount} {report.dayCount === 1 ? "day" : "days"}
            </Badge>
          ) : undefined
        }
      />

      <PageBody>
        <Surface>
          <form
            className="flex flex-wrap items-end gap-3 px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied({ from, to });
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

            {(applied.from !== "" || applied.to !== "") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setApplied({ from: "", to: "" });
                }}
              >
                Back to today
              </Button>
            )}

            <p className="ml-auto text-sm text-muted">
              {report === null
                ? "Loading…"
                : report.fromLocalDate === report.toLocalDate
                  ? report.fromLocalDate
                  : `${report.fromLocalDate} to ${report.toLocalDate}`}
            </p>
          </form>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Collected"
                value={report.paymentTotal.toFixed(2)}
                hint={`${report.paymentCount} ${report.paymentCount === 1 ? "bill" : "bills"} settled`}
              />
              <Stat
                label="Average bill"
                value={report.averageOrderValue.toFixed(2)}
                hint="Across every restaurant"
              />
              <Stat
                label="Trading"
                value={`${report.tradingCount} of ${report.restaurantCount}`}
                hint="Took at least one payment"
              />
              <Stat
                label="Not taken"
                value={report.cancelledValue.toFixed(2)}
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
                  {report.withoutManagerCount === 1 ? "restaurant has" : "restaurants have"}{" "}
                  no manager assigned, so {report.withoutManagerCount === 1 ? "it" : "they"}{" "}
                  cannot trade at all. Assign one under Managers.
                </span>
              </p>
            )}

            <Surface>
              <SurfaceHeader
                title="How it was paid"
                description="Across the whole platform. Every method is listed, even at zero."
              />
              <TableWrap>
                <Table className="min-w-[24rem]">
                  <thead>
                    <tr>
                      <Th>Method</Th>
                      <Th className="text-right">Bills</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byMethod.map((row) => (
                      <Tr key={row.method}>
                        <Td className="font-medium text-text">{row.method}</Td>
                        <Td className="text-right tabular text-muted">{row.count}</Td>
                        <Td className="text-right tabular">{row.total.toFixed(2)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Surface>

            <Surface>
              <SurfaceHeader
                title="By restaurant"
                description="Busiest first. The window column is the range read in that restaurant own calendar, which is why two rows can differ."
              />

              {report.restaurants.length === 0 ? (
                <EmptyState
                  icon={<Store />}
                  title="No restaurants yet"
                  description="Create one under Restaurants, then assign it a manager."
                />
              ) : (
                <TableWrap>
                  <Table className="min-w-[52rem]">
                    <thead>
                      <tr>
                        <Th>Restaurant</Th>
                        <Th>Manager</Th>
                        <Th>Its window</Th>
                        <Th className="text-right">Closed</Th>
                        <Th className="text-right">Cancelled</Th>
                        <Th className="text-right">Average</Th>
                        <Th className="text-right">Collected</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.restaurants.map((row) => (
                        <Tr key={row.id}>
                          <Td>
                            <span className="font-medium text-text">{row.name}</span>
                            <p className="font-mono text-2xs text-subtle">{row.slug}</p>
                          </Td>
                          <Td className="text-muted">
                            {row.managerName ?? (
                              <Badge tone="warning">Unassigned</Badge>
                            )}
                          </Td>
                          <Td className="text-xs whitespace-nowrap text-muted">
                            {formatDateTime(row.rangeStartUtc)}
                            <p className="text-subtle">
                              {row.timeZoneId} · day starts{" "}
                              {String(row.dayStartHour).padStart(2, "0")}:00
                            </p>
                          </Td>
                          <Td className="text-right tabular text-muted">
                            {row.completedCount}
                          </Td>
                          <Td className="text-right tabular text-muted">
                            {row.cancelledCount === 0 ? "—" : row.cancelledCount}
                          </Td>
                          <Td className="text-right tabular text-muted">
                            {row.averageOrderValue.toFixed(2)}
                          </Td>
                          <Td className="text-right font-medium tabular text-text">
                            {row.paymentTotal.toFixed(2)}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Surface>

            <p className="flex items-start gap-2 text-xs text-subtle">
              <ChartNoAxesColumn className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Nothing here is stored or rolled up. Every figure is computed from the
                orders and payments themselves when you ask for it, which is the only way
                this report and each restaurant billing screen are guaranteed to agree.
              </span>
            </p>
          </>
        )}
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Surface className="flex flex-col gap-0.5 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p
        className={
          tone === "warning"
            ? "text-2xl font-semibold text-warning tabular"
            : "text-2xl font-semibold text-text tabular"
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </Surface>
  );
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
