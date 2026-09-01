"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ImagePlus,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Choice } from "@/components/ui/choice";
import {
  Notice,
  failure,
  fieldError,
  idle,
  type PanelState,
} from "@/components/ui/panel-state";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
  FormSuccess,
  Skeleton,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  deleteInventoryItem,
  getInventoryItem,
  recordStockMovement,
  removeInventoryItemImage,
  setInventoryItemActive,
  setInventoryItemImage,
  updateInventoryItem,
} from "@/features/inventory/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { apiAssetSrc } from "@/lib/api/asset-url";
import {
  ENTERABLE_KINDS,
  INVENTORY_IMAGE,
  INVENTORY_LIMITS,
  KIND_LABEL,
  UNIT_SHORT,
} from "@/types/inventory";
import type {
  InventoryItem,
  InventoryItemDetail,
  StockMovement,
  StockMovementKind,
} from "@/types/inventory";

/**
 * One item, and everything that has moved it.
 *
 * The history is the point of this screen. Each line says what changed, what the
 * balance became, and who did it, so a figure that looks wrong can be traced back to
 * the movement that made it wrong rather than guessed at.
 *
 * Cooking appears here but cannot be entered here: it is written when a waiter sends an
 * order to the kitchen, and offering a second route would let the same food be deducted
 * twice.
 */
export default function InventoryItemPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <ItemDetail />
    </RequireAuth>
  );
}

function ItemDetail() {
  const params = useParams<{ id: string }>();
  const itemId = params.id;
  const router = useRouter();

  const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
  // When the history was fetched. The rate and the chart both need a "now", and
  // reading the clock while rendering makes them change on any re-render for
  // reasons that have nothing to do with the data. Fixed at the fetch, which is
  // also the honest reading: these figures are as of when the page was loaded.
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [kind, setKind] = useState<StockMovementKind>("Received");
  const [quantity, setQuantity] = useState("");
  const [increase, setIncrease] = useState(true);
  const [reason, setReason] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getInventoryItem(itemId);

        if (!cancelled) {
          setDetail(loaded);
          setLoadedAt(Date.now());
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load this item.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [itemId, reloadKey]);

  // The panels below change the item without touching its history, so they swap
  // the item in place rather than refetching a page of movements that cannot have
  // moved.
  const applyItem = useCallback(
    (next: InventoryItem) =>
      setDetail((current) => (current === null ? current : { ...current, item: next })),
    [],
  );

  const needsReason = kind === "Adjusted" || kind === "Wasted";
  const amount = Number(quantity);
  const canSubmit =
    Number.isFinite(amount) &&
    amount >= INVENTORY_LIMITS.minPositiveQuantity &&
    (!needsReason || reason.trim().length > 0) &&
    !isSaving;

  const submit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const updated = await recordStockMovement(itemId, {
        kind,
        quantity: amount,
        increase,
        reason: needsReason ? reason.trim() : undefined,
      });

      setDetail(updated);
      setLoadedAt(Date.now());
      setQuantity("");
      setReason("");
      setSavedAt(Date.now());
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not record the movement.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [canSubmit, itemId, kind, amount, increase, needsReason, reason]);

  if (error !== null) {
    return (
      <>
        <PageHeader title="Inventory" />
        <PageBody>
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
          <LinkButton href="/settings/inventory" variant="secondary" icon={<ArrowLeft />}>
            Back to inventory
          </LinkButton>
        </PageBody>
      </>
    );
  }

  if (detail === null) {
    return (
      <>
        <PageHeader title="Inventory" />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </Surface>
        </PageBody>
      </>
    );
  }

  const { item, movements } = detail;
  const unit = UNIT_SHORT[item.unit];
  const rate = consumptionRate(movements, item.quantityInStock, loadedAt);

  return (
    <>
      <PageHeader
        title={item.name}
        description={`Measured in ${item.unit.toLowerCase()}. Every change below says why it happened.`}
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Inventory", href: "/settings/inventory" },
          { label: item.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!item.isActive && <Badge tone="neutral">Archived</Badge>}
            {item.isNegative ? (
              <Badge tone="danger" dot>
                Below zero
              </Badge>
            ) : item.isOutOfStock ? (
              <Badge tone="danger" dot>
                Out of stock
              </Badge>
            ) : item.isLowStock ? (
              <Badge tone="warning" dot>
                Low
              </Badge>
            ) : (
              <Badge tone="success" dot>
                In stock
              </Badge>
            )}
            <LinkButton href="/settings/inventory" variant="secondary" icon={<ArrowLeft />}>
              Inventory
            </LinkButton>
          </div>
        }
      />

      <PageBody>
        {item.isNegative && (
          <Surface className="border-danger-border bg-danger-soft">
            <div className="flex items-start gap-2.5 px-4 py-3">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-danger"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-base font-medium text-text">
                  The balance has gone below zero
                </p>
                <p className="text-xs text-muted">
                  More was cooked than the records held, so either a delivery was never
                  entered or a count was wrong. Correct it below and say which.
                </p>
              </div>
            </div>
          </Surface>
        )}

        <StatStrip item={item} unit={unit} rate={rate} />

        <Sparkline movements={movements} item={item} now={loadedAt} />

        {/* The history is the widest thing on the page and the reason to be here, so
            it takes the main column with the form that adds to it. Renaming,
            archiving and deleting are occasional and sit beside. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] xl:items-start">
          <div className="flex flex-col gap-4">

            {/* Moving stock. Three kinds, because the other two are written by the
                system and a second route to them would double-count. */}
            <Surface>
              <SurfaceHeader
                title="Move stock"
                description="A delivery, a correction after counting, or something thrown away"
              />

              <div className="flex flex-col gap-4 p-4">
                {saveError !== null && <FormError message={saveError} />}
                {savedAt !== null && saveError === null && (
                  <FormSuccess message="Recorded. The history below now shows it." />
                )}

                {/* Three options, so all three are shown. Behind a dropdown this
                    cost two clicks to answer and one more to find out what the
                    alternatives were - and which of the three it is decides what
                    the rest of this form asks for. */}
                <Field label="What happened" htmlFor="kind">
                  <Choice
                    id="kind"
                    label="What happened"
                    value={kind}
                    onChange={setKind}
                    options={ENTERABLE_KINDS.map((option) => ({
                      value: option,
                      label: KIND_LABEL[option],
                    }))}
                  />
                </Field>

                {kind === "Adjusted" && (
                  <Field
                    label="Direction"
                    htmlFor="direction"
                    hint="A count can go either way. Deliveries and write-offs cannot, so they do not ask."
                  >
                    <Choice
                      id="direction"
                      label="Direction"
                      value={increase ? "up" : "down"}
                      onChange={(next) => setIncrease(next === "up")}
                      options={[
                        { value: "up", label: "More than recorded" },
                        { value: "down", label: "Less than recorded" },
                      ]}
                    />
                  </Field>
                )}

                <Field
                  label={`How much (${unit})`}
                  htmlFor="quantity"
                  hint="Always a positive amount. Which way it moves is decided by what happened."
                >
                  <Input
                    id="quantity"
                    type="number"
                    min={INVENTORY_LIMITS.minPositiveQuantity}
                    step="0.001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    aria-describedby={describedBy("quantity", { hasHint: true })}
                  />
                </Field>

                {needsReason && (
                  <Field
                    label="Why"
                    htmlFor="reason"
                    hint="Required. A stock figure that moved for no stated reason is what this history exists to prevent."
                  >
                    <Input
                      id="reason"
                      value={reason}
                      maxLength={INVENTORY_LIMITS.maxReasonLength}
                      placeholder={
                        kind === "Wasted"
                          ? "Spoiled overnight"
                          : "Recount after stocktake"
                      }
                      onChange={(event) => setReason(event.target.value)}
                      aria-describedby={describedBy("reason", { hasHint: true })}
                    />
                  </Field>
                )}

                <Button
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  icon={<Save />}
                >
                  {isSaving ? "Recording…" : "Record"}
                </Button>

                <p className="text-2xs text-subtle">
                  Stock used for cooking is not entered here. It is recorded when a
                  waiter sends an order to the kitchen.
                </p>
              </div>
            </Surface>

            <HistoryPanel movements={movements} unit={unit} />
          </div>

          {/* The three the list row used to carry. They belong beside the history
              rather than in a table: whether the reorder level is anywhere near right
              is a question the movements answer, and archiving or deleting something
              is not a thing to do by mis-clicking while scanning a long list. */}
          <div className="flex flex-col gap-4">
            <PhotoPanel item={item} onChanged={applyItem} />
            <DetailsPanel item={item} onSaved={applyItem} />
            <StatusPanel item={item} onChanged={applyItem} />
            <RemovePanel
              item={item}
              onDeleted={() => router.replace("/settings/inventory")}
            />
          </div>
        </div>
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* How fast it is going                                                       */
/* -------------------------------------------------------------------------- */

interface ConsumptionRate {
  /** How much is used in a day, on average, over the window below. */
  perDay: number;
  /** How many days the window actually covered. */
  days: number;
  /** How long what is on the shelf lasts at that rate. */
  daysLeft: number;
  /** The window was cut short by the movement cap rather than by choice. */
  isShortWindow: boolean;
}

/** A month is the window worth averaging over: long enough to cover a slow week. */
const RATE_WINDOW_DAYS = 30;

/**
 * How fast an ingredient is being used, from the history already on the page.
 *
 * This is the number the whole screen is really for. "5 kg left" answers nothing on
 * its own — five kilos is a fortnight of one thing and an evening of another — and
 * the reorder level a manager is asked to set is a guess until they can see the
 * rate behind it.
 *
 * Averaged over the last thirty days, or over however long the history actually
 * reaches when the hundred-movement cap cuts it shorter than that. The difference
 * is reported rather than hidden: a rate measured over two days of a busy service
 * is worth showing, but not worth presenting as a monthly average.
 *
 * Returns null rather than zero when nothing has been cooked. No consumption is not
 * a rate of nothing; it means there is no basis for the arithmetic, and inventing
 * one would put "999 days left" under an ingredient nobody has used yet.
 */
function consumptionRate(
  movements: StockMovement[],
  quantityInStock: number,
  now: number,
): ConsumptionRate | null {
  const consumed = movements.filter((movement) => movement.kind === "Consumed");

  if (consumed.length === 0) {
    return null;
  }

  const oldest = movements
    .map((movement) => new Date(movement.recordedAtUtc).getTime())
    .filter((time) => Number.isFinite(time))
    .reduce((lowest, time) => Math.min(lowest, time), now);

  const wanted = now - RATE_WINDOW_DAYS * 86_400_000;
  const from = Math.max(wanted, oldest);
  const days = (now - from) / 86_400_000;

  // Less than a day of history divides by almost nothing and produces a rate that
  // says more about the arithmetic than about the kitchen.
  if (days < 1) {
    return null;
  }

  const used = consumed
    .filter((movement) => new Date(movement.recordedAtUtc).getTime() >= from)
    .reduce((total, movement) => total + Math.abs(movement.quantityDelta), 0);

  if (used <= 0) {
    return null;
  }

  const perDay = used / days;

  return {
    perDay,
    days,
    daysLeft: quantityInStock > 0 ? quantityInStock / perDay : 0,
    isShortWindow: from > wanted,
  };
}

/* -------------------------------------------------------------------------- */
/* The headline figures                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the records say, across the top.
 *
 * The balance was a row in a four-row table, at the same weight as the number of
 * movements. It is the reason anybody opens this page, so it is now the largest
 * thing on it, and the three figures that qualify it sit alongside rather than
 * under.
 */
function StatStrip({
  item,
  unit,
  rate,
}: {
  item: InventoryItem;
  unit: string;
  rate: ConsumptionRate | null;
}) {
  const tone = item.isNegative || item.isOutOfStock
    ? "text-danger"
    : item.isLowStock
      ? "text-warning"
      : "text-text";

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="On the shelf">
        <span className={cn("text-3xl font-semibold tabular", tone)}>
          {formatQuantity(item.quantityInStock)}
        </span>
        <span className="ml-1 text-base text-muted">{unit}</span>
      </Stat>

      <Stat label="Warn below">
        {item.minimumQuantity > 0 ? (
          <>
            <span className="text-3xl font-semibold tabular text-text">
              {formatQuantity(item.minimumQuantity)}
            </span>
            <span className="ml-1 text-base text-muted">{unit}</span>
          </>
        ) : (
          <span className="text-base text-subtle">Not set</span>
        )}
      </Stat>

      <Stat
        label="Recent use"
        hint={
          rate === null
            ? undefined
            : rate.isShortWindow
              ? `Averaged over the ${formatDays(rate.days)} the history reaches`
              : `Averaged over ${RATE_WINDOW_DAYS} days`
        }
      >
        {rate === null ? (
          <span className="text-base text-subtle">Nothing cooked yet</span>
        ) : (
          <>
            <span className="text-3xl font-semibold tabular text-text">
              {formatQuantity(rate.perDay)}
            </span>
            <span className="ml-1 text-base text-muted">{unit}/day</span>
          </>
        )}
      </Stat>

      {/* The reorder question, answered rather than left as arithmetic. */}
      <Stat
        label="Cover"
        hint={rate === null ? undefined : "At the rate beside it"}
      >
        {rate === null ? (
          <span className="text-base text-subtle">—</span>
        ) : item.quantityInStock <= 0 ? (
          <span className="text-base font-medium text-danger">None left</span>
        ) : (
          <span
            className={cn(
              "text-3xl font-semibold tabular",
              rate.daysLeft < 2
                ? "text-danger"
                : rate.daysLeft < 5
                  ? "text-warning"
                  : "text-text",
            )}
          >
            {formatDays(rate.daysLeft)}
          </span>
        )}
      </Stat>
    </div>
  );
}

/** One cell of the strip. The hairlines are the grid gap showing through. */
function Stat({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-3.5">
      <span className="text-2xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <span className="flex items-baseline">{children}</span>
      {hint !== undefined && <span className="text-2xs text-subtle">{hint}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The balance over time                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The shape of the ledger, as a line.
 *
 * A stock balance has a shape — a sawtooth of deliveries filling it and service
 * drawing it down — and that shape says in one glance what a hundred rows say
 * slowly: whether deliveries are keeping up, how close to the warn line it runs,
 * and whether the last correction was a blip or a cliff.
 *
 * Stepped rather than joined, because that is what actually happened: a balance
 * holds flat between movements and jumps at each one. A straight line between two
 * points would draw stock draining smoothly over a week it did not move at all.
 *
 * Plotted against time rather than against movement number, for the same reason.
 * Ten movements in one evening and ten across a month are different pictures.
 */
function Sparkline({
  movements,
  item,
  now: loadedAt,
}: {
  movements: StockMovement[];
  item: InventoryItem;
  now: number;
}) {
  // Oldest first, which is the direction a line is read in.
  const points = [...movements]
    .reverse()
    .map((movement) => ({
      t: new Date(movement.recordedAtUtc).getTime(),
      q: movement.quantityAfter,
    }))
    .filter((point) => Number.isFinite(point.t));

  if (points.length < 2) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (first === undefined || last === undefined) {
    return null;
  }

  // Carried to now, because nothing having moved since is itself information.
  const now = Math.max(loadedAt, last.t);
  const span = now - first.t;

  if (span <= 0) {
    return null;
  }

  const width = 1000;
  const height = 120;
  const pad = 10;

  const values = points.map((point) => point.q);
  const warn = item.minimumQuantity > 0 ? item.minimumQuantity : null;

  const highest = Math.max(...values, warn ?? 0, 0);
  const lowest = Math.min(...values, 0);
  const range = highest - lowest || 1;

  const x = (t: number) => ((t - first.t) / span) * (width - pad * 2) + pad;
  const y = (q: number) =>
    height - pad - ((q - lowest) / range) * (height - pad * 2);

  let path = `M ${x(first.t)} ${y(first.q)}`;

  for (const point of points.slice(1)) {
    path += ` H ${x(point.t)} V ${y(point.q)}`;
  }

  path += ` H ${x(now)}`;

  return (
    <Surface className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Balance over time</h2>
        <p className="text-2xs text-subtle">
          {formatDate(first.t)} to today
          {warn !== null && " · dashed line is the warn level"}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Balance from ${formatQuantity(first.q)} to ${formatQuantity(
          last.q,
        )} over ${formatDays((now - first.t) / 86_400_000)}`}
        className="mt-2 h-24 w-full"
      >
        {/* Zero, drawn only when the line has been below it. Above zero it is the
            floor of the chart and a rule there would say nothing. */}
        {lowest < 0 && (
          <line
            x1={pad}
            x2={width - pad}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--danger)"
            strokeWidth="2"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {warn !== null && (
          <line
            x1={pad}
            x2={width - pad}
            y1={y(warn)}
            y2={y(warn)}
            stroke="var(--warning)"
            strokeWidth="2"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          // Without this the horizontal scale stretches the stroke and the line
          // comes out thicker across than down.
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

/** The kinds worth separating when reading back through a ledger. */
const HISTORY_FILTERS = [
  { id: "all", label: "Everything", kinds: null },
  { id: "in", label: "Deliveries", kinds: ["Received", "Opening"] },
  { id: "out", label: "Cooking", kinds: ["Consumed"] },
  { id: "fixes", label: "Corrections and waste", kinds: ["Adjusted", "Wasted"] },
] as const;

/**
 * Everything that has moved this item.
 *
 * Filtered, because on a busy ingredient nearly every line is cooking and the
 * handful of entries somebody typed — the deliveries, the corrections, the waste —
 * are what an audit is looking for and what a hundred automatic rows bury.
 */
function HistoryPanel({
  movements,
  unit,
}: {
  movements: StockMovement[];
  unit: string;
}) {
  const [filter, setFilter] = useState<(typeof HISTORY_FILTERS)[number]["id"]>("all");

  const active = HISTORY_FILTERS.find((entry) => entry.id === filter);
  const shown =
    active?.kinds == null
      ? movements
      : movements.filter((movement) =>
          (active.kinds as readonly string[]).includes(movement.kind),
        );

  return (
    <Surface>
      <SurfaceHeader
        title="History"
        description={
          movements.length === 0
            ? "Nothing has moved yet"
            : "Newest first, with the balance each change produced"
        }
      />

      {movements.length === 0 ? (
        <EmptyState
          icon={<TriangleAlert />}
          title="No movements"
          description="This item has never moved, so it can still be deleted rather than archived."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
            {HISTORY_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                aria-pressed={filter === entry.id}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm transition-colors",
                  filter === entry.id
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted hover:bg-surface-3 hover:text-text",
                )}
              >
                {entry.label}
              </button>
            ))}

            <span className="ml-auto pr-1 text-2xs text-subtle">
              {shown.length === movements.length
                ? `${movements.length} shown`
                : `${shown.length} of ${movements.length}`}
              {movements.length >= 100 && " · most recent 100"}
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nothing of that kind has been recorded for this item.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((movement) => (
                <MovementRow key={movement.id} movement={movement} unit={unit} />
              ))}
            </ul>
          )}
        </>
      )}
    </Surface>
  );
}

/** A span of days, said the way somebody would say it. */
function formatDays(days: number): string {
  if (days < 1) {
    return "under a day";
  }

  if (days < 14) {
    const whole = Math.round(days);
    return `${whole} ${whole === 1 ? "day" : "days"}`;
  }

  const weeks = Math.round(days / 7);
  return weeks < 9 ? `${weeks} weeks` : `${Math.round(days / 30)} months`;
}

/** A date without the time, for an axis label. */
function formatDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/* -------------------------------------------------------------------------- */
/* Photograph                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * An optional picture of the thing.
 *
 * Optional in the strongest sense: nothing in the product reads it, no report counts
 * it, and an item without one behaves identically. It is here because a delivery is
 * checked against a list by somebody holding a box, and forty identical white tubs
 * are easier to match to a name with a picture beside it than without.
 *
 * One picture, replaced rather than added to. There is no gallery here and no
 * picker: the website's library exists because a page reuses images across its
 * sections, and an ingredient has exactly one thing it looks like.
 */
function PhotoPanel({
  item,
  onChanged,
}: {
  item: InventoryItem;
  onChanged: (next: InventoryItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PanelState>(idle);

  async function upload(file: File) {
    // Checked here as well as by the server, so the common mistake - a photograph
    // straight off a phone - is answered instantly instead of after a megabyte has
    // gone up the wire to be refused.
    if (file.size > INVENTORY_IMAGE.maxBytes) {
      setState({
        status: "error",
        message: `That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
          INVENTORY_IMAGE.maxBytes / 1024 / 1024
        } MB.`,
        fieldErrors: {},
      });
      return;
    }

    setState({ status: "busy" });

    try {
      onChanged(await setInventoryItemImage(item.id, file));
      setState({ status: "done", message: "Picture saved." });
    } catch (caught) {
      setState(failure(caught, "Could not upload that picture."));
    }
  }

  async function remove() {
    setState({ status: "busy" });

    try {
      onChanged(await removeInventoryItemImage(item.id));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not remove the picture."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader title="Picture" description="Optional, and nothing depends on it" />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {item.imageUrl === null ? (
          <p className="text-sm text-muted">
            No picture yet. One helps when somebody is checking a delivery against
            this list with a box in their hands.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apiAssetSrc(item.imageUrl)}
            alt={item.name}
            className="aspect-4/3 w-full rounded-md border border-border object-cover"
          />
        )}

        {/* The input is hidden and driven by the button. A bare file input cannot be
            styled to match anything else on the page, and its "no file chosen" text
            says nothing useful once a picture is already showing above it. */}
        <input
          ref={inputRef}
          type="file"
          accept={INVENTORY_IMAGE.accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            // Cleared so choosing the same file twice still fires a change, which is
            // exactly what somebody does after a failed upload.
            event.target.value = "";

            if (file !== undefined) {
              void upload(file);
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ImagePlus />}
            disabled={state.status === "busy"}
            onClick={() => inputRef.current?.click()}
          >
            {state.status === "busy"
              ? "Uploading…"
              : item.imageUrl === null
                ? "Add a picture"
                : "Replace"}
          </Button>

          {item.imageUrl !== null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          )}

          <Notice state={state} />
        </div>

        <p className="text-2xs text-subtle">
          JPEG, PNG, WebP or AVIF, up to{" "}
          {INVENTORY_IMAGE.maxBytes / 1024 / 1024} MB.
        </p>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Name and reorder level                                                     */
/* -------------------------------------------------------------------------- */

function DetailsPanel({
  item,
  onSaved,
}: {
  item: InventoryItem;
  onSaved: (next: InventoryItem) => void;
}) {
  const [name, setName] = useState(item.name);
  const [minimum, setMinimum] = useState(String(item.minimumQuantity));
  const [state, setState] = useState<PanelState>(idle);

  const isDirty = name !== item.name || minimum !== String(item.minimumQuantity);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      onSaved(
        await updateInventoryItem(item.id, {
          name: name.trim(),
          minimumQuantity: Number(minimum) || 0,
        }),
      );
      setState({ status: "done", message: "Saved." });
    } catch (caught) {
      setState(failure(caught, "Could not save the item."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Details"
        description="What it is called, and when to warn about it"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <Field
          label="Name"
          htmlFor="edit-name"
          hint="What the kitchen calls it. Unique within the restaurant."
          error={fieldError(state, "name")}
        >
          <Input
            id="edit-name"
            value={name}
            maxLength={INVENTORY_LIMITS.maxNameLength}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={describedBy("edit-name", { hasHint: true })}
            aria-invalid={fieldError(state, "name") !== undefined}
          />
        </Field>

        <Field
          label={`Warn below (${UNIT_SHORT[item.unit]})`}
          htmlFor="edit-minimum"
          hint="Zero for no warning at all. The history below is the best guide to what this should be."
          error={fieldError(state, "minimumQuantity")}
        >
          <Input
            id="edit-minimum"
            type="number"
            min={0}
            step="0.001"
            className="sm:max-w-40"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            aria-describedby={describedBy("edit-minimum", { hasHint: true })}
            aria-invalid={fieldError(state, "minimumQuantity") !== undefined}
          />
        </Field>

        <div className="flex flex-col gap-1 text-2xs text-subtle">
          <p>
            Measured in {item.unit.toLowerCase()}, and fixed. Changing it would
            reinterpret every quantity already recorded.
          </p>
          <p>
            {item.recipeUseCount === 0
              ? "No recipe names it, so cooking will never deduct it."
              : `Deducted by ${item.recipeUseCount} ${
                  item.recipeUseCount === 1 ? "recipe" : "recipes"
                } whenever those dishes are sent to the kitchen.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="submit"
            size="sm"
            disabled={state.status === "busy" || !isDirty || name.trim().length === 0}
          >
            {state.status === "busy" ? "Saving…" : "Save changes"}
          </Button>

          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => {
                setName(item.name);
                setMinimum(String(item.minimumQuantity));
                setState(idle);
              }}
            >
              Discard
            </Button>
          )}

          <Notice state={state} />
        </div>
      </form>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Archive                                                                    */
/* -------------------------------------------------------------------------- */

function StatusPanel({
  item,
  onChanged,
}: {
  item: InventoryItem;
  onChanged: (next: InventoryItem) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);

  async function toggle() {
    setState({ status: "busy" });

    try {
      onChanged(await setInventoryItemActive(item.id, !item.isActive));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Could not change it."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="In use"
        actions={
          item.isActive ? (
            <Badge tone="success" dot>
              In use
            </Badge>
          ) : (
            <Badge tone="neutral">Archived</Badge>
          )
        }
      />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          {item.isActive
            ? "Archiving takes it off the shelves without losing its history. Any recipe still naming it keeps deducting it, because that food is still being made."
            : "This item is kept with its history but is no longer offered when building a recipe."}
        </p>

        <Button
          variant={item.isActive ? "secondary" : "primary"}
          size="sm"
          className="self-start"
          icon={item.isActive ? <Archive /> : <ArchiveRestore />}
          disabled={state.status === "busy"}
          onClick={() => void toggle()}
        >
          {state.status === "busy"
            ? "Saving…"
            : item.isActive
              ? "Archive"
              : "Restore"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Removal                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Deleting outright, which is almost never the right answer.
 *
 * Offered only while the item has no history and no recipe naming it, which in
 * practice means it was added by mistake a minute ago. The server refuses the rest
 * regardless; hiding the button is so the answer is visible before the click rather
 * than as an error after it.
 */
function RemovePanel({
  item,
  onDeleted,
}: {
  item: InventoryItem;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, setState] = useState<PanelState>(idle);

  const canDelete = item.movementCount === 0 && item.recipeUseCount === 0;

  async function handleDelete() {
    setState({ status: "busy" });

    try {
      await deleteInventoryItem(item.id);
      onDeleted();
    } catch (caught) {
      setState(failure(caught, "Could not delete it."));
      setIsConfirming(false);
    }
  }

  return (
    <Surface className={canDelete ? "border-danger-border" : undefined}>
      <SurfaceHeader
        title="Remove"
        className={canDelete ? "border-danger-border" : undefined}
      />

      <div className="flex flex-col gap-4 p-4">
        {state.status === "error" && <FormError message={state.message} />}

        {canDelete ? (
          <>
            <p className="text-sm text-muted">
              Nothing has moved this item and no recipe names it, so it can be deleted
              outright. Once either is true, archive it instead — a movement pointing
              at a row nobody can look up would make the ledger unreadable.
            </p>

            {isConfirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={state.status === "busy"}
                  onClick={() => void handleDelete()}
                >
                  {state.status === "busy" ? "Deleting…" : `Yes, delete ${item.name}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={state.status === "busy"}
                  onClick={() => setIsConfirming(false)}
                >
                  Keep it
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                size="sm"
                className="self-start"
                icon={<Trash2 />}
                onClick={() => setIsConfirming(true)}
              >
                Delete item
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            This item cannot be deleted:{" "}
            {item.movementCount > 0 && (
              <>
                its history holds{" "}
                <span className="font-medium text-text tabular">
                  {item.movementCount}
                </span>{" "}
                {item.movementCount === 1 ? "movement" : "movements"}
              </>
            )}
            {item.movementCount > 0 && item.recipeUseCount > 0 && ", and "}
            {item.recipeUseCount > 0 && (
              <>
                <span className="font-medium text-text tabular">
                  {item.recipeUseCount}
                </span>{" "}
                {item.recipeUseCount === 1 ? "recipe names" : "recipes name"} it
              </>
            )}
            . Archive it above instead, which keeps all of that intact.
          </p>
        )}
      </div>
    </Surface>
  );
}

function MovementRow({
  movement,
  unit,
}: {
  movement: StockMovement;
  unit: string;
}) {
  const outward = movement.quantityDelta < 0;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium text-text">
          {KIND_LABEL[movement.kind]}
          {movement.kind === "Consumed" && (
            <Badge tone="neutral">automatic</Badge>
          )}
        </span>
        <span className="text-2xs text-muted">
          {movement.recordedByName} · {formatDateTime(movement.recordedAtUtc)}
          {movement.orderNumber !== null && (
            <>
              {" · "}
              <Link
                href={`/billing/${movement.orderId}`}
                className="text-primary hover:underline"
              >
                order #{movement.orderNumber}
              </Link>
            </>
          )}
        </span>
        {movement.reason !== null && (
          <span className="text-2xs text-muted italic">{movement.reason}</span>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            "tabular text-sm font-semibold",
            outward ? "text-danger" : "text-success",
          )}
        >
          {outward ? "" : "+"}
          {formatQuantity(movement.quantityDelta)} {unit}
        </span>
        {/* The balance this movement produced, so the history reads a line at a time
            rather than having to be added up. */}
        <span className="tabular text-2xs text-subtle">
          left {formatQuantity(movement.quantityAfter)} {unit}
        </span>
      </div>
    </li>
  );
}

/** A quantity without trailing zeros, so 1.000 reads as 1. */
function formatQuantity(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
