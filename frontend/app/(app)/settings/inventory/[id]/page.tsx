"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChefHat, Save, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
  FormSuccess,
  Skeleton,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { getInventoryItem, recordStockMovement } from "@/features/inventory/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  ENTERABLE_KINDS,
  INVENTORY_LIMITS,
  KIND_LABEL,
  UNIT_SHORT,
} from "@/types/inventory";
import type {
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

  const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
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

      <PageBody className="lg:max-w-none">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-4">
            <Surface>
              <SurfaceHeader title="Now" description="What the records say" />
              <dl className="divide-y divide-border">
                <DetailRow label="On the shelf">
                  <span
                    className={cn(
                      "tabular font-semibold",
                      item.isNegative || item.isOutOfStock
                        ? "text-danger"
                        : item.isLowStock
                          ? "text-warning"
                          : "text-text",
                    )}
                  >
                    {formatQuantity(item.quantityInStock)} {unit}
                  </span>
                </DetailRow>
                <DetailRow label="Warn below">
                  {item.minimumQuantity > 0 ? (
                    <span className="tabular">
                      {formatQuantity(item.minimumQuantity)} {unit}
                    </span>
                  ) : (
                    <span className="text-subtle">Not set</span>
                  )}
                </DetailRow>
                <DetailRow label="Used in">
                  {item.recipeUseCount === 0 ? (
                    <span className="text-subtle">No recipes</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ChefHat className="size-3.5 text-muted" aria-hidden="true" />
                      {item.recipeUseCount}{" "}
                      {item.recipeUseCount === 1 ? "recipe" : "recipes"}
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Movements">
                  <span className="tabular">{item.movementCount}</span>
                </DetailRow>
              </dl>
            </Surface>

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

                <Field label="What happened" htmlFor="kind">
                  <Select
                    id="kind"
                    value={kind}
                    onChange={(event) =>
                      setKind(event.target.value as StockMovementKind)
                    }
                  >
                    {ENTERABLE_KINDS.map((option) => (
                      <option key={option} value={option}>
                        {KIND_LABEL[option]}
                      </option>
                    ))}
                  </Select>
                </Field>

                {kind === "Adjusted" && (
                  <Field
                    label="Direction"
                    htmlFor="direction"
                    hint="A count can go either way. Deliveries and write-offs cannot, so they do not ask."
                  >
                    <Select
                      id="direction"
                      value={increase ? "up" : "down"}
                      onChange={(event) => setIncrease(event.target.value === "up")}
                      aria-describedby={describedBy("direction", { hasHint: true })}
                    >
                      <option value="up">There was more than recorded</option>
                      <option value="down">There was less than recorded</option>
                    </Select>
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
          </div>

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
              <ul className="divide-y divide-border">
                {movements.map((movement) => (
                  <MovementRow
                    key={movement.id}
                    movement={movement}
                    unit={unit}
                  />
                ))}
              </ul>
            )}
          </Surface>
        </div>
      </PageBody>
    </>
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
