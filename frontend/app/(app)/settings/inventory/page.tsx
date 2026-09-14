"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Plus, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardGrid, CardGridSkeleton } from "@/components/ui/card-grid";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Surface } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { createInventoryItem, listInventory } from "@/features/inventory/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { INVENTORY_LIMITS, UNITS, UNIT_SHORT } from "@/types/inventory";
import type {
  InventoryItem,
  InventoryOverview,
  UnitOfMeasure,
} from "@/types/inventory";

/**
 * How the list is narrowed.
 *
 * Attention is the one that earns its place. The header has always counted what is
 * low, out and below zero, but the counts were only ever a number to read: finding
 * the eleven things they referred to meant scrolling a list of two hundred looking
 * for coloured badges. Pressing the count now shows exactly those rows, which is
 * what somebody reading the count wanted to do next.
 */
type StockFilter = "all" | "attention" | "low" | "out" | "negative";

const FILTER_LABELS: Record<StockFilter, string> = {
  all: "Everything",
  attention: "Needs attention",
  low: "Running low",
  out: "Out of stock",
  negative: "Below zero",
};

function matchesFilter(item: InventoryItem, filter: StockFilter): boolean {
  switch (filter) {
    case "attention":
      // The one question a manager actually asks the shelves. Archived rows are
      // left out even when they are showing: something out of use is not a problem
      // to solve.
      return item.isActive && (item.isLowStock || item.isOutOfStock || item.isNegative);
    case "low":
      return item.isLowStock;
    case "out":
      return item.isOutOfStock;
    case "negative":
      return item.isNegative;
    default:
      return true;
  }
}

/**
 * What the kitchen keeps on its shelves.
 *
 * The figures here are never edited directly. Stock moves through a movement that says
 * why, which is what makes the history worth reading; this screen edits the name and
 * the reorder level, and sends anything else to the item own page.
 *
 * A negative balance is shown as its own state rather than as merely empty, because it
 * means the records are wrong rather than the shelf being bare.
 */
export default function InventoryPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <InventoryList />
    </RequireAuth>
  );
}

function InventoryList() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listInventory(includeArchived);

        if (!cancelled) {
          setOverview(loaded);
          setError(null);
          setNoRestaurant(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setNoRestaurant(isMissingRestaurant(caught));
          setError(
            isMissingRestaurant(caught)
              ? null
              : caught instanceof Error
                ? caught.message
                : "Unable to load the inventory.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [includeArchived, reloadKey]);

  // Narrowed here rather than in the query, so the header counts keep covering the
  // whole shelf: a warning that could be hidden by typing in the search box would
  // be worse than no warning.
  const term = search.trim().toLowerCase();
  const shown = (overview?.items ?? []).filter(
    (item) =>
      matchesFilter(item, filter) &&
      (term === "" || item.name.toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What is on the shelves. Stock moves through deliveries, corrections and cooking, never by editing a number."
        actions={
          <div className="flex items-center gap-2">
            {/* Pressable, because a count nobody can act on is decoration. Each one
                narrows the list to the rows it is counting. */}
            {overview !== null && overview.outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter("out")}
                className="rounded-full"
              >
                <Badge tone="danger" dot>
                  {overview.outOfStockCount} out
                </Badge>
              </button>
            )}
            {overview !== null && overview.lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter("low")}
                className="rounded-full"
              >
                <Badge tone="warning" dot>
                  {overview.lowStockCount} low
                </Badge>
              </button>
            )}
            <AddItemDialog onSaved={refresh} />
          </div>
        }
      />

      <PageBody>
        {noRestaurant ? (
          <NoRestaurantAssigned area="Inventory" />
        ) : (
          <>
            {/* A balance below zero is a data problem, so it gets its own banner rather
                than being counted among the empty shelves. */}
            {overview !== null && overview.negativeCount > 0 && (
              <Surface className="border-danger-border bg-danger-soft">
                <div className="flex items-start gap-2.5 px-4 py-3">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-base font-medium text-text">
                      {overview.negativeCount === 1
                        ? "One item has gone below zero"
                        : `${overview.negativeCount} items have gone below zero`}
                    </p>
                    <p className="text-xs text-muted">
                      More was cooked than the records held, which means a delivery was
                      not recorded or a count was wrong. Correct it on the item page.
                    </p>
                  </div>
                </div>
              </Surface>
            )}

            {overview !== null && overview.untrackedCount > 0 && (
              <p className="text-xs text-muted">
                <span className="tabular font-medium text-text">
                  {overview.untrackedCount}
                </span>{" "}
                {overview.untrackedCount === 1 ? "item has" : "items have"} no reorder
                level, so nothing can warn when they run low.
              </p>
            )}

            <Surface>
              {/* Searched and filtered in the browser rather than at the server.
                  The endpoint already returns the whole shelf in one response so
                  that its counts can cover everything rather than the filtered
                  set, which means the rows to narrow are here already and a round
                  trip per keystroke would buy nothing. */}
              <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative sm:max-w-xs sm:flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                      aria-hidden="true"
                    />
                    <Input
                      id="inventory-search"
                      type="search"
                      placeholder="Search ingredients"
                      className="pl-8"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      aria-label="Search ingredients"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(event) => {
                        setIncludeArchived(event.target.checked);
                        setOverview(null);
                      }}
                      className="size-4 accent-primary"
                    />
                    Show archived
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {(Object.keys(FILTER_LABELS) as StockFilter[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      aria-pressed={filter === option}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-sm transition-colors",
                        filter === option
                          ? "bg-primary-soft font-medium text-primary"
                          : "text-muted hover:bg-surface-3 hover:text-text",
                      )}
                    >
                      {FILTER_LABELS[option]}
                    </button>
                  ))}

                  <span className="ml-auto text-sm text-muted">
                    {overview === null
                      ? "Loading…"
                      : shown.length === overview.items.length
                        ? `${overview.activeCount} ${overview.activeCount === 1 ? "item" : "items"} in use`
                        : `${shown.length} of ${overview.items.length} shown`}
                  </span>
                </div>
              </div>

              {error !== null && (
                <ErrorState message={error} onRetry={refresh} />
              )}

              {overview === null && error === null ? (
                <CardGridSkeleton count={10} hasMedia />
              ) : overview !== null && overview.items.length === 0 ? (
                <EmptyState
                  icon={<Boxes />}
                  title="Nothing on the shelves yet"
                  description="Add what the kitchen keeps in stock, then link it to menu items so cooking deducts it."
                  action={<AddItemDialog onSaved={refresh} />}
                />
              ) : shown.length === 0 ? (
                <EmptyState
                  icon={<Search />}
                  title="Nothing matches"
                  description="No ingredient on the shelves answers to both the search and the filter."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                      }}
                    >
                      Clear
                    </Button>
                  }
                />
              ) : (
                <CardGrid>
                  {shown.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </CardGrid>
              )}
            </Surface>
          </>
        )}
      </PageBody>
    </>
  );
}

function ItemCard({ item }: { item: InventoryItem }) {
  // The one number the card is really for, coloured by how worried to be about it.
  const stockTone = item.isNegative
    ? "text-danger"
    : item.isOutOfStock
      ? "text-danger"
      : item.isLowStock
        ? "text-warning"
        : "text-text";

  return (
    <Card className={item.isActive ? undefined : "opacity-60"}>
      <div className="relative aspect-4/3 w-full overflow-hidden bg-surface-3">
        {item.imageUrl === null ? (
          <span className="flex size-full items-center justify-center">
            <Boxes className="size-7 text-subtle" aria-hidden="true" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apiAssetSrc(item.imageUrl)}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        )}

        {/* Only when something is wrong with it. A badge on every card would be a
            grid of stickers, and the point of this screen is spotting the few that
            need attention. */}
        <span className="absolute top-2 left-2">
          {!item.isActive ? (
            <Badge tone="neutral">Archived</Badge>
          ) : item.isNegative ? (
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
          ) : null}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link
          href={`/settings/inventory/${item.id}`}
          className="font-medium text-text hover:underline"
        >
          {item.name}
        </Link>

        <p className="flex items-baseline gap-1">
          <span className={cn("text-xl font-semibold tabular", stockTone)}>
            {formatQuantity(item.quantityInStock)}
          </span>
          <span className="text-xs text-muted">{UNIT_SHORT[item.unit]}</span>
          {item.minimumQuantity > 0 && (
            <span className="ml-1 text-2xs text-subtle tabular">
              warn below {formatQuantity(item.minimumQuantity)}
            </span>
          )}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-2xs text-subtle">
            {item.recipeUseCount === 0
              ? "No recipes"
              : `${item.recipeUseCount} ${
                  item.recipeUseCount === 1 ? "recipe" : "recipes"
                }`}
          </span>
          <LinkButton
            href={`/settings/inventory/${item.id}`}
            variant="secondary"
            size="sm"
            icon={<SlidersHorizontal />}
          >
            Manage
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}

/**
 * Adding an item.
 *
 * Only adding. Editing moved to the item's own page, where it sits beside the
 * history that says whether the reorder level is set anywhere near right.
 *
 * The unit and the opening quantity are asked for once, here, and never again:
 * changing the unit later would reinterpret every quantity already recorded, and
 * after this the figure only ever moves through a movement that says why.
 */
function AddItemDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("Piece");
  const [quantity, setQuantity] = useState("0");
  const [minimum, setMinimum] = useState("0");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName("");
    setUnit("Piece");
    setQuantity("0");
    setMinimum("0");
    setError(null);
    setFieldErrors({});
  }

  async function save() {
    setError(null);
    setFieldErrors({});
    setIsSaving(true);

    try {
      await createInventoryItem({
        name: name.trim(),
        unit,
        quantityInStock: Number(quantity) || 0,
        minimumQuantity: Number(minimum) || 0,
      });

      setOpen(false);
      reset();
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
      }
      setError(caught instanceof Error ? caught.message : "Could not add the item.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button icon={<Plus />}>Add item</Button>
      </DialogTrigger>

      <DialogContent
        title="Add an inventory item"
        description="Any opening quantity is recorded as its own movement."
      >
        <div className="flex flex-col gap-4 px-4 py-4">
          {error !== null && <FormError message={error} />}

          <Field
            label="Name"
            htmlFor="item-name"
            hint="What the kitchen calls it. Unique within the restaurant."
            error={fieldErrors.name?.[0]}
          >
            <Input
              id="item-name"
              value={name}
              maxLength={INVENTORY_LIMITS.maxNameLength}
              onChange={(event) => setName(event.target.value)}
              aria-describedby={describedBy("item-name", {
                hasHint: true,
                hasError: fieldErrors.name !== undefined,
              })}
              autoFocus
            />
          </Field>

          <Field
            label="Measured in"
            htmlFor="item-unit"
            hint="Fixed once the item exists, because changing it would reinterpret every quantity already recorded. Recipes may use any unit measuring the same kind of thing."
            error={fieldErrors.unit?.[0]}
          >
            <Select
              id="item-unit"
              value={unit}
              onChange={(next) => setUnit(next as UnitOfMeasure)}
              aria-describedby={describedBy("item-unit", { hasHint: true })}
              options={UNITS.map((option) => ({ value: option, label: option }))}
            />
          </Field>

          <Field
            label="On the shelf now"
            htmlFor="item-quantity"
            hint="Recorded as an opening balance, so the history accounts for the whole figure."
            error={fieldErrors.quantityInStock?.[0]}
          >
            <Input
              id="item-quantity"
              type="number"
              min={0}
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-describedby={describedBy("item-quantity", { hasHint: true })}
            />
          </Field>

          <Field
            label="Warn below"
            htmlFor="item-minimum"
            hint="Zero for no warning at all."
            error={fieldErrors.minimumQuantity?.[0]}
          >
            <Input
              id="item-minimum"
              type="number"
              min={0}
              step="0.001"
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
              aria-describedby={describedBy("item-minimum", { hasHint: true })}
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => void save()}
            disabled={isSaving || name.trim().length === 0}
          >
            {isSaving ? "Saving…" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A quantity without trailing zeros, so 1.000 reads as 1. */
export function formatQuantity(value: number): string {
  return Number(value.toFixed(3)).toString();
}
