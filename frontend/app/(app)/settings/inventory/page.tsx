"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronRight,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  TableSkeleton,
} from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  setInventoryItemActive,
  updateInventoryItem,
} from "@/features/inventory/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { INVENTORY_LIMITS, UNITS, UNIT_SHORT } from "@/types/inventory";
import type {
  InventoryItem,
  InventoryOverview,
  UnitOfMeasure,
} from "@/types/inventory";

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

  return (
    <>
      <PageHeader
        title="Inventory"
        description="What is on the shelves. Stock moves through deliveries, corrections and cooking, never by editing a number."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Inventory" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {overview !== null && overview.outOfStockCount > 0 && (
              <Badge tone="danger" dot>
                {overview.outOfStockCount} out
              </Badge>
            )}
            {overview !== null && overview.lowStockCount > 0 && (
              <Badge tone="warning" dot>
                {overview.lowStockCount} low
              </Badge>
            )}
            <ItemDialog onSaved={refresh} />
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="text-sm text-muted">
                  {overview === null
                    ? "Loading…"
                    : `${overview.activeCount} ${overview.activeCount === 1 ? "item" : "items"} in use`}
                </p>
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

              {error !== null && (
                <ErrorState message={error} onRetry={refresh} />
              )}

              {overview === null && error === null ? (
                <TableSkeleton />
              ) : overview !== null && overview.items.length === 0 ? (
                <EmptyState
                  icon={<Boxes />}
                  title="Nothing on the shelves yet"
                  description="Add what the kitchen keeps in stock, then link it to menu items so cooking deducts it."
                  action={<ItemDialog onSaved={refresh} />}
                />
              ) : (
                overview !== null && (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Item</Th>
                          <Th className="text-right">In stock</Th>
                          <Th className="text-right">Reorder at</Th>
                          <Th>State</Th>
                          <Th className="text-right">Used in</Th>
                          <Th className="text-right">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.items.map((item) => (
                          <ItemRow key={item.id} item={item} onChanged={refresh} />
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )
              )}
            </Surface>
          </>
        )}
      </PageBody>
    </>
  );
}

function ItemRow({
  item,
  onChanged,
}: {
  item: InventoryItem;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function toggleArchived() {
    setBusy(true);
    setRowError(null);

    try {
      await setInventoryItemActive(item.id, !item.isActive);
      onChanged();
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : "Could not change it.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setRowError(null);

    try {
      await deleteInventoryItem(item.id);
      onChanged();
    } catch (caught) {
      // Usually because it has history or a recipe names it, and the message says
      // which. Archiving is the answer in both cases.
      setRowError(caught instanceof Error ? caught.message : "Could not delete it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tr className={item.isActive ? undefined : "opacity-60"}>
      <Td>
        <Link
          href={`/settings/inventory/${item.id}`}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {item.name}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
        <span className="block text-2xs text-subtle">
          measured in {item.unit.toLowerCase()}
          {item.movementCount > 0 && ` · ${item.movementCount} movements`}
        </span>
        {rowError !== null && (
          <span className="mt-1 block text-2xs text-danger">{rowError}</span>
        )}
      </Td>
      <Td className="text-right">
        <span
          className={cn(
            "tabular font-semibold",
            item.isNegative
              ? "text-danger"
              : item.isOutOfStock
                ? "text-danger"
                : item.isLowStock
                  ? "text-warning"
                  : "text-text",
          )}
        >
          {formatQuantity(item.quantityInStock)}
        </span>
        <span className="ml-1 text-2xs text-subtle">{UNIT_SHORT[item.unit]}</span>
      </Td>
      <Td className="text-right text-muted tabular">
        {item.minimumQuantity > 0 ? (
          <>
            {formatQuantity(item.minimumQuantity)}
            <span className="ml-1 text-2xs text-subtle">{UNIT_SHORT[item.unit]}</span>
          </>
        ) : (
          <span className="text-subtle">not set</span>
        )}
      </Td>
      <Td>
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
        ) : (
          <Badge tone="success" dot>
            In stock
          </Badge>
        )}
      </Td>
      <Td className="text-right text-muted tabular">
        {item.recipeUseCount === 0 ? (
          <span className="text-subtle">—</span>
        ) : (
          `${item.recipeUseCount} ${item.recipeUseCount === 1 ? "recipe" : "recipes"}`
        )}
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <ItemDialog item={item} onSaved={onChanged} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleArchived()}
            disabled={busy}
            icon={item.isActive ? <Archive /> : <ArchiveRestore />}
          >
            {item.isActive ? "Archive" : "Restore"}
          </Button>
          {/* Only offered when it could actually succeed. Anything with history or a
              recipe naming it is archived instead, and the server refuses regardless. */}
          {item.movementCount === 0 && item.recipeUseCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove()}
              disabled={busy}
              icon={<Trash2 />}
              className="text-danger"
            >
              Delete
            </Button>
          )}
        </div>
      </Td>
    </Tr>
  );
}

/**
 * Adding or editing an item.
 *
 * The unit and the opening quantity are only offered when adding. Changing the unit
 * later would reinterpret every quantity already recorded, and the stock figure only
 * ever moves through a movement, so neither belongs on an edit.
 */
function ItemDialog({
  item,
  onSaved,
}: {
  item?: InventoryItem;
  onSaved: () => void;
}) {
  const isEdit = item !== undefined;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState<UnitOfMeasure>(item?.unit ?? "Piece");
  const [quantity, setQuantity] = useState("0");
  const [minimum, setMinimum] = useState(
    item === undefined ? "0" : String(item.minimumQuantity),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "Piece");
    setQuantity("0");
    setMinimum(item === undefined ? "0" : String(item.minimumQuantity));
    setError(null);
    setFieldErrors({});
  }

  async function save() {
    setError(null);
    setFieldErrors({});
    setIsSaving(true);

    try {
      if (isEdit) {
        await updateInventoryItem(item.id, {
          name: name.trim(),
          minimumQuantity: Number(minimum) || 0,
        });
      } else {
        await createInventoryItem({
          name: name.trim(),
          unit,
          quantityInStock: Number(quantity) || 0,
          minimumQuantity: Number(minimum) || 0,
        });
      }

      setOpen(false);
      reset();
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
      }
      setError(caught instanceof Error ? caught.message : "Could not save the item.");
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
        {isEdit ? (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        ) : (
          <Button icon={<Plus />}>Add item</Button>
        )}
      </DialogTrigger>

      <DialogContent
        title={isEdit ? `Edit ${item.name}` : "Add an inventory item"}
        description={
          isEdit
            ? "The unit and the stock figure cannot be changed here."
            : "Any opening quantity is recorded as its own movement."
        }
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

          {isEdit ? (
            <p className="text-2xs text-subtle">
              Measured in {item.unit.toLowerCase()}. Fixed once the item has any
              history, because changing it would reinterpret every quantity already
              recorded.
            </p>
          ) : (
            <>
              <Field
                label="Measured in"
                htmlFor="item-unit"
                hint="Fixed once the item has history. Recipes may use any unit measuring the same kind of thing."
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
            </>
          )}

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
            {isSaving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
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
