"use client";

import { useMemo, useState } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { Bar, Chart, Doughnut } from "react-chartjs-2";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";
import { fade, useChartTheme } from "@/features/analytics/chart-theme";
import type { ChartTheme } from "@/features/analytics/chart-theme";
import type {
  PlatformHour,
  PlatformMethodTotal,
  PlatformPulseRestaurant,
  PlatformReportDay,
  PlatformTrendDay,
  PlatformWeekday,
} from "@/types/platform";

/**
 * The charts on the platform dashboard.
 *
 * Chart.js, registered piece by piece rather than through `chart.js/auto`. Auto pulls
 * in every controller the library has - radar, bubble, polar area, scatter - and this
 * screen draws four kinds of chart. Naming them keeps the bundle to what is on the
 * page.
 *
 * Two rules run through all of them.
 *
 * Nothing is drawn until the palette has been read off the live document, so a chart
 * is never painted in the wrong theme and then corrected. Everything here paints with
 * the same tokens as the surface it sits on, in both themes, and repaints when either
 * changes.
 *
 * And none of them claim more than the data supports. No trend fitted through
 * fourteen points, no projection of a day that has not finished, no second axis
 * without its own labelled ticks. A figure on a dashboard gets believed.
 */

// Controllers as well as elements, and named here rather than left to the import side
// effects of react-chartjs-2. Its <Bar> and <Doughnut> each register their own
// controller when imported, but the generic <Chart> registers nothing - so the line
// riding on the fortnight bar chart would have thrown for want of a controller nobody
// had asked for. Registering the set this file actually draws makes that impossible to
// get wrong again by rearranging an import.
ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

/* -------------------------------------------------------------------------- */
/* Shared options                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The tooltip, styled like the rest of the product.
 *
 * Chart.js draws its own tooltip into the canvas, so it cannot inherit a single class
 * from the page. Everything it needs - surface, border, both text colours - is handed
 * over explicitly, which is the price of not shipping a second popover implementation.
 */
function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    titleColor: theme.text,
    bodyColor: theme.muted,
    footerColor: theme.subtle,
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
    boxWidth: 8,
    boxHeight: 8,
    boxPadding: 4,
    usePointStyle: true,
    titleFont: { size: 12, weight: 600 as const },
    bodyFont: { size: 12 },
    footerFont: { size: 11, weight: 400 as const },
  };
}

/** Grid and tick styling, so every chart reads as the same chart. */
function axisStyle(theme: ChartTheme, showGrid: boolean) {
  return {
    grid: {
      display: showGrid,
      color: theme.border,
      drawTicks: false,
    },
    border: { display: false, dash: [3, 5] },
    ticks: {
      color: theme.subtle,
      font: { size: 11 },
      padding: 8,
    },
  };
}

/** Reduced motion is a preference, not a suggestion. */
function animationFor(theme: ChartTheme, duration = 700) {
  return theme.reducedMotion
    ? (false as const)
    : { duration, easing: "easeOutQuart" as const };
}

/**
 * An arrival that reads left to right, the way the data was gathered.
 *
 * Chart.js grows every bar and every point at once by default, which on a time series
 * is the one thing that is not true about it: the days happened in an order, and a
 * chart that asserts all of them simultaneously reads as a picture being switched on
 * rather than as a week being told. Delaying each index by a few milliseconds makes
 * the line unroll and the bars land under it in sequence.
 *
 * The total sweep is held at roughly a third of a second whatever the range, so seven
 * days and ninety days take the same time. A ninety-day chart staggered at a fixed
 * forty milliseconds a column would take four seconds to draw, which stops being an
 * animation and becomes a wait.
 *
 * Only the first draw sweeps. Every one of these screens polls, and re-running the
 * whole animation each time a poll returns the same figures would make the page look
 * like it were constantly reloading. The ref survives re-renders; the flag is set
 * when the first pass finishes.
 */
function sweepFor(theme: ChartTheme, count: number, once: FirstDraw) {
  if (theme.reducedMotion) {
    return false as const;
  }

  const stagger = count <= 1 ? 0 : Math.min(45, 320 / count);

  return {
    duration: 420,
    easing: "easeOutQuart" as const,
    delay: (context: { type: string; mode?: string; dataIndex?: number }) =>
      !once.done &&
      context.type === "data" &&
      // Hovering re-runs the animation in "active" mode. Without this the chart
      // would sweep again every time the pointer crossed it.
      context.mode === "default"
        ? (context.dataIndex ?? 0) * stagger
        : 0,
    onComplete: () => {
      once.done = true;
    },
  };
}

/**
 * Whether a chart has already done its opening sweep.
 *
 * A plain mutable box rather than a ref, because it is handed to a function during
 * render and a ref is not something to pass around: this is a flag Chart.js sets from
 * inside an animation callback, not React state, and nothing re-renders when it flips.
 */
interface FirstDraw {
  done: boolean;
}

/** A box that survives re-renders, created once. */
function useFirstDraw(): FirstDraw {
  const [box] = useState<FirstDraw>(() => ({ done: false }));

  return box;
}

/* -------------------------------------------------------------------------- */
/* Fourteen days: takings and orders together                                 */
/* -------------------------------------------------------------------------- */

/**
 * The recent days, as money over volume.
 *
 * Two axes, which is normally the oldest way to make two unrelated lines look like
 * they explain each other. It earns its place here because the two series are not
 * unrelated and not in competition: the bars are how many orders came in, the line is
 * what they were worth, and the whole point is the days where those two disagree. A
 * fat bar under a flat line is a day of cheap orders; the reverse is a day of large
 * tables. Both axes carry their own labelled ticks, so neither is being read off the
 * other's scale.
 *
 * Titled from the data rather than from a constant. This card used to be called the
 * fortnight because the pulse sent fourteen days; the pulse sends a week now, and a
 * heading that has to be kept in step with a number on the server is a heading that
 * will eventually lie.
 */
export function RecentDaysCard({ days }: { days: PlatformTrendDay[] }) {
  const theme = useChartTheme();
  const drawn = useFirstDraw();

  const takings = days.reduce((sum, day) => sum + day.takings, 0);
  const orders = days.reduce((sum, day) => sum + day.ordersPlaced, 0);

  const data = useMemo<ChartData<"bar" | "line", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: days.map((day) => shortDay(day.localDate)),
      datasets: [
        {
          type: "line" as const,
          label: "Takings",
          data: days.map((day) => day.takings),
          yAxisID: "money",
          borderColor: theme.primary,
          borderWidth: 2.5,
          // The gradient is built from the canvas itself, so it has to wait for a
          // chart area to exist: on the very first frame there is none.
          backgroundColor: (context: ScriptableContext<"line">) => {
            const { ctx, chartArea } = context.chart;

            if (chartArea === undefined) {
              return fade(theme.primary, 0.15);
            }

            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );

            gradient.addColorStop(0, fade(theme.primary, 0.3));
            gradient.addColorStop(1, fade(theme.primary, 0));

            return gradient;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: theme.surface,
          pointBorderColor: theme.primary,
          pointBorderWidth: 2.5,
          pointHitRadius: 20,
          order: 0,
        },
        {
          type: "bar" as const,
          label: "Orders",
          data: days.map((day) => day.ordersPlaced),
          yAxisID: "volume",
          backgroundColor: fade(theme.series[1] ?? theme.muted, 0.35),
          hoverBackgroundColor: fade(theme.series[1] ?? theme.muted, 0.6),
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.62,
          categoryPercentage: 0.82,
          order: 1,
        },
      ],
    };
  }, [days, theme]);

  const options = useMemo<ChartOptions<"bar" | "line"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: sweepFor(theme, days.length, drawn),
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          callbacks: {
            title: (items) => longDay(days[items[0]?.dataIndex ?? 0]?.localDate),
            label: (item) =>
              item.dataset.label === "Takings"
                ? `  ${money(read(item.parsed.y))} taken`
                : `  ${read(item.parsed.y)} ${read(item.parsed.y) === 1 ? "order" : "orders"} placed`,
            footer: (items) => {
              const day = days[items[0]?.dataIndex ?? 0];

              if (day === undefined) {
                return "";
              }

              return day.cancelled > 0
                ? `${day.completed} settled · ${day.cancelled} cancelled`
                : `${day.completed} settled`;
            },
          },
        },
      },
      scales: {
        x: axisStyle(theme, false),
        money: {
          ...axisStyle(theme, true),
          position: "left" as const,
          beginAtZero: true,
          ticks: {
            ...axisStyle(theme, true).ticks,
            color: theme.primary,
            callback: (value) => money(Number(value)),
          },
        },
        volume: {
          ...axisStyle(theme, false),
          position: "right" as const,
          beginAtZero: true,
          ticks: {
            ...axisStyle(theme, false).ticks,
            precision: 0,
          },
        },
      },
    };
  }, [days, drawn, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title={days.length === 7 ? "This week" : `Last ${days.length} days`}
        description={`${money(takings)} taken from ${orders} ${orders === 1 ? "order" : "orders"}.`}
        actions={
          <div className="flex items-center gap-3">
            <Key colour="var(--primary)" line>
              Takings
            </Key>
            <Key colour="var(--chart-2)">Orders</Key>
          </div>
        }
      />
      <ChartFrame
        height={220}
        summary={`Takings and orders for the last ${days.length} days. ${money(takings)} taken from ${orders} orders.`}
      >
        {data !== null && options !== null && (
          <Chart type="bar" data={data} options={options} />
        )}
      </ChartFrame>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Today, hour by hour                                                        */
/* -------------------------------------------------------------------------- */

/**
 * When today actually happened.
 *
 * The one chart here that answers an operations question rather than a money one:
 * whether load arrives in a lunch and a dinner, which is what a restaurant day looks
 * like, or spread flat through the night, which usually means something is ordering
 * through a screen nobody meant to leave open.
 *
 * All twenty-four hours are drawn and the ones still to come are drawn empty, so the
 * chart keeps the shape of a day instead of growing a column every hour.
 */
export function HourCard({
  hours,
  currentHour,
}: {
  hours: PlatformHour[];
  currentHour: number;
}) {
  const theme = useChartTheme();
  const drawn = useFirstDraw();

  const busiest = hours.reduce(
    (best, hour) => (hour.ordersPlaced > best.ordersPlaced ? hour : best),
    hours[0] ?? { hour: 0, ordersPlaced: 0, takings: 0 },
  );

  const data = useMemo<ChartData<"bar", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: hours.map((hour) => clock(hour.hour)),
      datasets: [
        {
          label: "Orders",
          data: hours.map((hour) => hour.ordersPlaced),
          backgroundColor: hours.map((hour) =>
            hour.hour === currentHour
              ? theme.primary
              : hour.hour > currentHour
                ? fade(theme.border, 0.9)
                : fade(theme.primary, 0.45),
          ),
          hoverBackgroundColor: hours.map(() => theme.primary),
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.72,
          categoryPercentage: 0.92,
        },
      ],
    };
  }, [currentHour, hours, theme]);

  const options = useMemo<ChartOptions<"bar"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      // The day runs left to right and so does this: midnight first, now last.
      animation: sweepFor(theme, hours.length, drawn),
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          displayColors: false,
          callbacks: {
            title: (items) => {
              const hour = hours[items[0]?.dataIndex ?? 0];

              return hour === undefined
                ? ""
                : `${clock(hour.hour)} – ${clock((hour.hour + 1) % 24)}`;
            },
            label: (item) =>
              `  ${read(item.parsed.y)} ${read(item.parsed.y) === 1 ? "order" : "orders"}`,
            footer: (items) => {
              const hour = hours[items[0]?.dataIndex ?? 0];

              return hour === undefined ? "" : `${money(hour.takings)} settled`;
            },
          },
        },
      },
      scales: {
        x: {
          ...axisStyle(theme, false),
          ticks: {
            ...axisStyle(theme, false).ticks,
            // Every third hour. Twenty-four labels on a phone is a grey smear.
            callback: (_value, index) => (index % 3 === 0 ? clock(index) : ""),
            maxRotation: 0,
            autoSkip: false,
          },
        },
        y: {
          ...axisStyle(theme, true),
          beginAtZero: true,
          ticks: { ...axisStyle(theme, true).ticks, precision: 0 },
        },
      },
    };
  }, [drawn, hours, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Today, hour by hour"
        description={
          busiest.ordersPlaced === 0
            ? "No orders placed yet today."
            : `Busiest at ${clock(busiest.hour)} with ${busiest.ordersPlaced} ${busiest.ordersPlaced === 1 ? "order" : "orders"}.`
        }
      />
      <ChartFrame
        height={170}
        summary={`Orders placed in each hour of today. Busiest hour ${clock(busiest.hour)} with ${busiest.ordersPlaced} orders.`}
      >
        {data !== null && options !== null && <Bar data={data} options={options} />}
      </ChartFrame>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* How people paid                                                            */
/* -------------------------------------------------------------------------- */

const METHOD_LABELS: Record<string, string> = {
  Cash: "Cash",
  Card: "Card",
  Digital: "Digital wallet",
};

/**
 * Today's takings split by tender.
 *
 * Worth a card of its own on a Nepali platform rather than a line in a report. The
 * cash share is what decides whether a restaurant needs a float, a safe and somebody
 * counting a till at close, and it is the number that moves as wallets take over.
 *
 * A ring rather than a pie, with the total in the hole, because the total is the
 * figure most often wanted and the middle of a pie is the one part of it that carries
 * no information. Every method is listed underneath even at zero, so a missing tender
 * reads as nothing taken rather than as a gap.
 */
export function TenderCard({ byMethod }: { byMethod: PlatformMethodTotal[] }) {
  const theme = useChartTheme();

  // Which tender the reader is pointing at, from either direction.
  //
  // Held as the method rather than as a slice index, because the ring only draws the
  // tenders that took something while the list below draws all of them. An index into
  // one is not an index into the other, and the row for a tender that took nothing
  // still has to be able to light up and say so.
  const [active, setActive] = useState<string | null>(null);

  const total = byMethod.reduce((sum, row) => sum + row.total, 0);
  const payments = byMethod.reduce((sum, row) => sum + row.count, 0);
  const taken = byMethod.filter((row) => row.total > 0);

  const drawn = taken.some((row) => row.method === active);
  const showing = active === null ? null : byMethod.find((row) => row.method === active);

  const data = useMemo<ChartData<"doughnut", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: taken.map((row) => METHOD_LABELS[row.method] ?? row.method),
      datasets: [
        {
          data: taken.map((row) => row.total),
          // Everything else steps back rather than the chosen slice stepping
          // forward alone: a highlight that only brightens is invisible on the
          // colour somebody is already looking at.
          backgroundColor: taken.map((row) => {
            const colour = tenderColour(theme, row.method);

            return drawn && row.method !== active ? fade(colour, 0.22) : colour;
          }),
          offset: taken.map((row) => (row.method === active ? 10 : 0)),
          hoverOffset: 10,
          borderColor: theme.surface,
          borderWidth: 3,
        },
      ],
    };
  }, [active, drawn, taken, theme]);

  const options = useMemo<ChartOptions<"doughnut"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      animation: animationFor(theme, 500),
      // The sweep on first draw is worth half a second. A highlight is not: at the
      // same duration, pointing at a slice feels like the chart is thinking about it.
      animations: theme.reducedMotion
        ? undefined
        : { colors: { duration: 150 }, offset: { duration: 150 } },
      // Pointing at the ring lights the row underneath, the same way pointing at a
      // row lights the ring. Firing with nothing under the pointer is what clears it.
      onHover: (_event, elements) => {
        const index = elements[0]?.index;

        setActive(index === undefined ? null : (taken[index]?.method ?? null));
      },
      plugins: {
        legend: { display: false },
        // No canvas tooltip. The hole in the middle already shows the figure, and a
        // tooltip would cover the slice it was describing on a ring this size.
        tooltip: { enabled: false },
      },
    };
  }, [taken, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="How people paid"
        description={
          payments === 0
            ? "Nothing settled yet today."
            : `${payments} ${payments === 1 ? "bill" : "bills"} settled today.`
        }
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div
          className="relative mx-auto my-auto h-40 w-40"
          onMouseLeave={() => setActive(null)}
        >
          {data !== null && options !== null && taken.length > 0 ? (
            <Doughnut data={data} options={options} />
          ) : (
            // Nothing taken yet. Dashed rather than solid, so an empty ring reads as
            // a day that has not started rather than as a chart that failed to draw.
            <div className="size-full rounded-full border-8 border-dashed border-surface-3" />
          )}

          {/* The hole earns its keep, and earns it twice: the day's total at rest,
              and whatever is being pointed at while it is. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="tabular text-xl font-semibold text-text">
              {money(showing === undefined || showing === null ? total : showing.total)}
            </span>
            <span className="text-2xs text-subtle">
              {showing === undefined || showing === null
                ? "taken today"
                : `${METHOD_LABELS[showing.method] ?? showing.method}${total === 0 ? "" : ` · ${Math.round((showing.total / total) * 100)}%`}`}
            </span>
          </div>
        </div>

        {/* The list is the legend, and the legend is a control. Each row is a real
            button: hovering it lifts its slice, and tabbing to it does the same, so
            the chart is readable without a pointer at all. */}
        <ul className="-mx-2 flex flex-col">
          {byMethod.map((row) => (
            <li key={row.method}>
              <button
                type="button"
                onMouseEnter={() => setActive(row.method)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(row.method)}
                onBlur={() => setActive(null)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active === row.method ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-text">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 rounded-full transition-all",
                      TENDER_DOTS[row.method],
                      active === row.method ? "size-2.5" : "size-2",
                    )}
                  />
                  {METHOD_LABELS[row.method] ?? row.method}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-2xs text-subtle">
                    {total === 0 ? "—" : `${Math.round((row.total / total) * 100)}%`}
                  </span>
                  <span className="tabular text-sm font-medium text-text">
                    {money(row.total)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Surface>
  );
}

const TENDER_DOTS: Record<string, string> = {
  Cash: "bg-primary",
  Card: "bg-success",
  Digital: "bg-warning",
};

function tenderColour(theme: ChartTheme, method: string): string {
  switch (method) {
    case "Card":
      return theme.success;
    case "Digital":
      return theme.warning;
    default:
      return theme.primary;
  }
}

/* -------------------------------------------------------------------------- */
/* Busiest today                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Today's takings by restaurant, biggest first.
 *
 * Horizontal, because restaurant names are words and a word rotated forty-five
 * degrees under a bar is a word nobody reads. The axis starts at zero and is scaled
 * to the platform, not to the leader, so one room taking nine tenths of everything
 * looks like exactly that.
 */
export function LeaderboardCard({
  rows,
  limit = 7,
}: {
  rows: PlatformPulseRestaurant[];
  limit?: number;
}) {
  const theme = useChartTheme();

  const ranked = [...rows]
    .filter((row) => row.takingsToday > 0 || row.ordersToday > 0)
    .sort((a, b) => b.takingsToday - a.takingsToday || b.ordersToday - a.ordersToday);
  const shown = ranked.slice(0, limit);
  const rest = ranked.length - shown.length;

  const data = useMemo<ChartData<"bar", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: shown.map((row) => row.name),
      datasets: [
        {
          label: "Takings",
          data: shown.map((row) => row.takingsToday),
          backgroundColor: shown.map(
            (_row, index) => fade(theme.series[index % theme.series.length] ?? theme.primary, 0.85),
          ),
          hoverBackgroundColor: shown.map(
            (_row, index) => theme.series[index % theme.series.length] ?? theme.primary,
          ),
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.7,
        },
      ],
    };
  }, [shown, theme]);

  const options = useMemo<ChartOptions<"bar"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: animationFor(theme, 600),
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          displayColors: false,
          callbacks: {
            label: (item) => `  ${money(read(item.parsed.x))} taken`,
            footer: (items) => {
              const row = shown[items[0]?.dataIndex ?? 0];

              if (row === undefined) {
                return "";
              }

              return `${row.ordersToday} ${row.ordersToday === 1 ? "order" : "orders"}${row.openOrders > 0 ? ` · ${row.openOrders} still open` : ""}`;
            },
          },
        },
      },
      scales: {
        x: {
          ...axisStyle(theme, true),
          beginAtZero: true,
          ticks: {
            ...axisStyle(theme, true).ticks,
            callback: (value) => money(Number(value)),
          },
        },
        y: {
          ...axisStyle(theme, false),
          ticks: { ...axisStyle(theme, false).ticks, color: theme.text },
        },
      },
    };
  }, [shown, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Busiest today"
        description={
          shown.length === 0
            ? "Nothing has traded yet today."
            : `${ranked.length} ${ranked.length === 1 ? "restaurant is" : "restaurants are"} trading.`
        }
      />

      {shown.length === 0 ? (
        <p className="flex flex-1 items-center p-4 text-sm text-muted">
          The first order of the day will show up here.
        </p>
      ) : (
        <>
          <ChartFrame
            height={Math.max(140, shown.length * 30 + 32)}
            summary={`Takings today for the ${shown.length} busiest restaurants.`}
          >
            {data !== null && options !== null && <Bar data={data} options={options} />}
          </ChartFrame>
          {rest > 0 && (
            <p className="px-4 pb-4 text-2xs text-subtle">
              and {rest} more {rest === 1 ? "restaurant" : "restaurants"} trading today
            </p>
          )}
        </>
      )}
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* The report range                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every day of a report range, as money over volume.
 *
 * The same reading as the fortnight card on the overview, deliberately: bars for how
 * many bills were settled, a line for what they came to, an axis each. Somebody who
 * has learned to read one has learned to read the other.
 *
 * What differs is that the range here is chosen rather than fixed, and can be ninety
 * days. Nothing about the chart changes with the length except which labels survive -
 * ninety date labels on one axis is a grey smear, so they thin out until they fit.
 */
export function ReportRangeCard({ days }: { days: PlatformReportDay[] }) {
  const theme = useChartTheme();
  const drawn = useFirstDraw();

  const takings = days.reduce((sum, day) => sum + day.takings, 0);
  const bills = days.reduce((sum, day) => sum + day.bills, 0);
  const best = days.reduce(
    (top, day) => (day.takings > top.takings ? day : top),
    days[0] ?? { localDate: "", bills: 0, takings: 0, cancelled: 0, cancelledValue: 0 },
  );

  // One label roughly every eight columns, whatever the range. A week reads as seven
  // dates; a quarter reads as a dozen, which is a scale rather than a list.
  const every = Math.max(1, Math.ceil(days.length / 12));

  const data = useMemo<ChartData<"bar" | "line", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: days.map((day) => shortDay(day.localDate)),
      datasets: [
        {
          type: "line" as const,
          label: "Takings",
          data: days.map((day) => day.takings),
          yAxisID: "money",
          borderColor: theme.primary,
          borderWidth: 2.5,
          backgroundColor: (context: ScriptableContext<"line">) => {
            const { ctx, chartArea } = context.chart;

            if (chartArea === undefined) {
              return fade(theme.primary, 0.15);
            }

            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );

            gradient.addColorStop(0, fade(theme.primary, 0.3));
            gradient.addColorStop(1, fade(theme.primary, 0));

            return gradient;
          },
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: theme.surface,
          pointBorderColor: theme.primary,
          pointBorderWidth: 2.5,
          pointHitRadius: 24,
          order: 0,
        },
        {
          type: "bar" as const,
          label: "Bills",
          data: days.map((day) => day.bills),
          yAxisID: "volume",
          backgroundColor: fade(theme.series[1] ?? theme.muted, 0.35),
          hoverBackgroundColor: fade(theme.series[1] ?? theme.muted, 0.6),
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.9,
          order: 1,
        },
      ],
    };
  }, [days, theme]);

  const options = useMemo<ChartOptions<"bar" | "line"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: sweepFor(theme, days.length, drawn),
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          callbacks: {
            title: (items) => longDay(days[items[0]?.dataIndex ?? 0]?.localDate),
            label: (item) =>
              item.dataset.label === "Takings"
                ? `  ${money(read(item.parsed.y))} taken`
                : `  ${read(item.parsed.y)} ${read(item.parsed.y) === 1 ? "bill" : "bills"}`,
            footer: (items) => {
              const day = days[items[0]?.dataIndex ?? 0];

              if (day === undefined || day.cancelled === 0) {
                return "";
              }

              return `${day.cancelled} cancelled, worth ${money(day.cancelledValue)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ...axisStyle(theme, false),
          ticks: {
            ...axisStyle(theme, false).ticks,
            autoSkip: false,
            maxRotation: 0,
            callback: (_value, index) =>
              index % every === 0 ? shortDay(days[index]?.localDate) : "",
          },
        },
        money: {
          ...axisStyle(theme, true),
          position: "left" as const,
          beginAtZero: true,
          ticks: {
            ...axisStyle(theme, true).ticks,
            color: theme.primary,
            callback: (value) => money(Number(value)),
          },
        },
        volume: {
          ...axisStyle(theme, false),
          position: "right" as const,
          beginAtZero: true,
          ticks: { ...axisStyle(theme, false).ticks, precision: 0 },
        },
      },
    };
  }, [days, drawn, every, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Across the range"
        description={
          bills === 0
            ? "Nothing was settled in this range."
            : `${money(takings)} from ${bills} ${bills === 1 ? "bill" : "bills"}. Best day ${longDay(best.localDate)}, ${money(best.takings)}.`
        }
        actions={
          <div className="flex items-center gap-3">
            <Key colour="var(--primary)" line>
              Takings
            </Key>
            <Key colour="var(--chart-2)">Bills</Key>
          </div>
        }
      />
      <ChartFrame
        height={260}
        summary={`Takings and bills for each of ${days.length} days. ${money(takings)} from ${bills} bills.`}
      >
        {data !== null && options !== null && (
          <Chart type="bar" data={data} options={options} />
        )}
      </ChartFrame>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* The shape of a week                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What each day of the week carried.
 *
 * A restaurant platform lives or dies on two or three days, and a total over a month
 * hides which end of the week carried the month. Read off the daily series rather
 * than the orders again, so it can never drift from the chart above it.
 *
 * Horizontal, because the days have names and a name turned on its side under a bar
 * is a name nobody reads.
 */
export function WeekdayCard({ byWeekday }: { byWeekday: PlatformWeekday[] }) {
  const theme = useChartTheme();

  const total = byWeekday.reduce((sum, row) => sum + row.takings, 0);
  const best = byWeekday.reduce(
    (top, row) => (row.takings > top.takings ? row : top),
    byWeekday[0] ?? { weekday: "Sunday" as const, bills: 0, takings: 0 },
  );

  const data = useMemo<ChartData<"bar", number[], string> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      labels: byWeekday.map((row) => row.weekday.slice(0, 3)),
      datasets: [
        {
          label: "Takings",
          data: byWeekday.map((row) => row.takings),
          backgroundColor: byWeekday.map((row) =>
            row.weekday === best.weekday && total > 0
              ? theme.primary
              : fade(theme.primary, 0.4),
          ),
          hoverBackgroundColor: byWeekday.map(() => theme.primary),
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.72,
        },
      ],
    };
  }, [best.weekday, byWeekday, theme, total]);

  const options = useMemo<ChartOptions<"bar"> | null>(() => {
    if (theme === null) {
      return null;
    }

    return {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: animationFor(theme, 600),
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(theme),
          displayColors: false,
          callbacks: {
            title: (items) => byWeekday[items[0]?.dataIndex ?? 0]?.weekday ?? "",
            label: (item) => `  ${money(read(item.parsed.x))} taken`,
            footer: (items) => {
              const row = byWeekday[items[0]?.dataIndex ?? 0];

              return row === undefined
                ? ""
                : `${row.bills} ${row.bills === 1 ? "bill" : "bills"}`;
            },
          },
        },
      },
      scales: {
        x: {
          ...axisStyle(theme, true),
          beginAtZero: true,
          ticks: {
            ...axisStyle(theme, true).ticks,
            callback: (value) => money(Number(value)),
          },
        },
        y: {
          ...axisStyle(theme, false),
          ticks: { ...axisStyle(theme, false).ticks, color: theme.text },
        },
      },
    };
  }, [byWeekday, theme]);

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="The shape of a week"
        description={
          total === 0
            ? "Nothing was settled in this range."
            : `${best.weekday} carries the most, at ${money(best.takings)}.`
        }
      />
      <ChartFrame
        height={210}
        summary={`Takings by day of the week. ${best.weekday} is the busiest at ${money(best.takings)}.`}
      >
        {data !== null && options !== null && <Bar data={data} options={options} />}
      </ChartFrame>
    </Surface>
  );
}


/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The box a chart is drawn in.
 *
 * It holds the height, because `maintainAspectRatio: false` hands that job to CSS,
 * and it holds the skeleton for the moment before the palette has been read. It also
 * carries the sentence a screen reader gets: a canvas is a picture, and a picture of
 * a number is not a number.
 */
function ChartFrame({
  height,
  summary,
  children,
}: {
  /** The shortest this chart is worth drawing at, not the height it will get. */
  height: number;
  summary: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  // Every caller passes {ready && <Chart />}, which is `false` before the palette
  // resolves - and `false ?? fallback` is `false`, so the nullish coalescing that
  // used to be here left an empty box where the skeleton should have been.
  const drawing =
    children !== false && children !== null && children !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
      <div className="relative w-full flex-1" style={{ minHeight: height }}>
        <AnimatePresence mode="wait" initial={false}>
          {drawing ? (
            // The chart is uncovered from the left, not faded in.
            //
            // Staggering the points inside Chart.js was not enough on its own, and the
            // reason is worth keeping: a line chart animating its points from the
            // baseline already has a path across the full width on the first frame, so
            // delaying each point makes the line *rise* rather than *extend*. With an
            // area fill under it there is nothing left to see at all.
            //
            // Wiping the plot area sidesteps that completely. The line, its fill and
            // the bars are all revealed by the same moving edge, which is the thing
            // being asked for - the chart being written left to right - and it cannot
            // be defeated by whatever a dataset does with its own animation.
            <motion.div
              key="chart"
              className="size-full"
              initial={
                reduced === true ? false : { clipPath: "inset(0% 100% 0% 0%)" }
              }
              animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
              // Starts briskly and eases out, so the edge is clearly moving from the
              // first frame rather than creeping. Every chart behind this frame has a
              // horizontal axis, so there is always a left for it to start from; the
              // tender ring draws itself and does not come through here.
              transition={{ duration: 0.85, ease: [0.33, 0, 0.15, 1] }}
            >
              {children}
            </motion.div>
          ) : (
            // The skeleton pulses on its own, and leaves rather than vanishing, so a
            // slow endpoint does not end in a flicker.
            <motion.div
              key="waiting"
              className="size-full"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Skeleton className="size-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

/** A legend entry: a swatch and a name, drawn in HTML rather than on the canvas. */
function Key({
  colour,
  line = false,
  children,
}: {
  colour: string;
  line?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
      <span
        aria-hidden="true"
        className={cn("shrink-0 rounded-full", line ? "h-0.5 w-3.5" : "size-2")}
        style={{ backgroundColor: colour }}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * A parsed value off a tooltip item.
 *
 * Chart.js types every parsed coordinate as nullable, because a dataset is allowed to
 * carry gaps. None of these datasets do - every series here is built with one entry
 * per label, zeros included - so a null would be a bug rather than a hole, and it
 * reads as zero.
 */
function read(value: number | null | undefined): number {
  return value ?? 0;
}

/**
 * An amount, grouped, without decimals.
 *
 * Whole units on a chart on purpose. Two decimal places on a fortnight of takings is
 * four characters of noise in a label nobody is reconciling; the receipt and the
 * report are where the paisa belong.
 */
function money(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** 14:00, the way a rota writes it. */
function clock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** "Sat 13 Sep" — enough to find the day without reading a year. */
function longDay(localDate: string | undefined): string {
  if (localDate === undefined) {
    return "—";
  }

  const parsed = new Date(`${localDate}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? localDate
    : parsed.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

/** "13 Sep", for an axis with no room to spell it out. */
function shortDay(localDate: string | undefined): string {
  if (localDate === undefined) {
    return "";
  }

  const parsed = new Date(`${localDate}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? localDate
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
