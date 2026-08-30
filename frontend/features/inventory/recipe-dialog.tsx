"use client";

import { useEffect, useState } from "react";
import { ChefHat, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormError, Skeleton } from "@/components/ui/states";
import {
  getRecipe,
  listInventory,
  saveRecipe,
} from "@/features/inventory/api";
import { ApiError } from "@/lib/api/client";
import { INVENTORY_LIMITS, UNITS, UNIT_FAMILY, UNIT_SHORT } from "@/types/inventory";
import type { InventoryItem, UnitOfMeasure } from "@/types/inventory";

/** A line being edited, before it is a saved recipe line. */
interface DraftLine {
  inventoryItemId: string;
  quantity: string;
  unit: UnitOfMeasure;
}

/**
 * What a menu item is made from.
 *
 * The whole recipe is saved at once: the lines on screen become the recipe and anything
 * removed is gone, so an editor is a single save rather than a sequence of adds and
 * deletes that could fail half way and leave a recipe nobody intended.
 *
 * Only units that can describe the chosen ingredient are offered, because grams of a
 * liquid would need a density nothing here stores. Refusing at the point of choosing is
 * kinder than refusing at the point of saving.
 */
export function RecipeDialog({
  menuItemId,
  menuItemName,
  onSaved,
}: {
  menuItemId: string;
  menuItemName: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [available, setAvailable] = useState<InventoryItem[] | null>(null);
  const [portions, setPortions] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [recipe, inventory] = await Promise.all([
          getRecipe(menuItemId),
          listInventory(),
        ]);

        if (!cancelled) {
          setLines(
            recipe.lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              quantity: String(line.quantity),
              unit: line.unit,
            })),
          );
          setPortions(recipe.portionsAvailable);
          setAvailable(inventory.items);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the recipe.",
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
  }, [open, menuItemId]);

  function addLine() {
    const unused = (available ?? []).find(
      (item) => !lines.some((line) => line.inventoryItemId === item.id),
    );

    if (unused === undefined) {
      return;
    }

    setLines((current) => [
      ...current,
      {
        inventoryItemId: unused.id,
        quantity: "1",
        // Defaults to how the ingredient is stocked, which is always compatible.
        unit: unused.unit,
      },
    ]);
  }

  function changeIngredient(index: number, inventoryItemId: string) {
    const chosen = (available ?? []).find((item) => item.id === inventoryItemId);

    setLines((current) =>
      current.map((line, position) =>
        position === index
          ? {
              ...line,
              inventoryItemId,
              // A unit that could describe the old ingredient may not describe the new
              // one, so it falls back to how the new one is stocked.
              unit:
                chosen !== undefined &&
                UNIT_FAMILY[line.unit] !== UNIT_FAMILY[chosen.unit]
                  ? chosen.unit
                  : line.unit,
            }
          : line,
      ),
    );
  }

  async function save() {
    setError(null);
    setIsSaving(true);

    try {
      const saved = await saveRecipe(menuItemId, {
        lines: lines
          .filter((line) => Number(line.quantity) > 0)
          .map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: Number(line.quantity),
            unit: line.unit,
          })),
      });

      setPortions(saved.portionsAvailable);
      setOpen(false);
      onSaved?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not save the recipe.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const canAdd =
    available !== null && lines.length < available.length && available.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setIsLoading(true);
        } else {
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" icon={<ChefHat />}>
          Recipe
        </Button>
      </DialogTrigger>

      <DialogContent
        title={`What ${menuItemName} is made from`}
        description="Sending this to the kitchen takes these off the shelf. Leaving it empty means it consumes nothing."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 px-4 py-4">
          {error !== null && <FormError message={error} />}

          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : available !== null && available.length === 0 ? (
            <p className="text-sm text-muted">
              There is nothing on the shelves yet. Add inventory items first, then come
              back and link them.
            </p>
          ) : (
            <>
              {portions !== null && (
                <p className="text-xs text-muted">
                  {portions === 0 ? (
                    <span className="flex items-center gap-1.5 text-warning">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      Not enough on the shelves for even one. It can still be sent to
                      the kitchen; the balance will go negative.
                    </span>
                  ) : (
                    <>
                      Enough on the shelves for about{" "}
                      <span className="tabular font-semibold text-text">{portions}</span>
                      , decided by whichever ingredient runs out first.
                    </>
                  )}
                </p>
              )}

              {lines.length === 0 ? (
                <p className="text-sm text-muted">
                  No ingredients. Nothing will be deducted when this is cooked, which is
                  right for anything sold as it comes.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lines.map((line, index) => {
                    const ingredient = available?.find(
                      (item) => item.id === line.inventoryItemId,
                    );

                    // Only units measuring the same kind of thing as the ingredient, so
                    // an impossible recipe cannot be typed in the first place.
                    const usable = UNITS.filter(
                      (unit) =>
                        ingredient === undefined ||
                        UNIT_FAMILY[unit] === UNIT_FAMILY[ingredient.unit],
                    );

                    return (
                      <li key={index} className="flex flex-wrap items-end gap-2">
                        <label className="sr-only" htmlFor={`ingredient-${index}`}>
                          Ingredient
                        </label>
                        <Select
                          id={`ingredient-${index}`}
                          value={line.inventoryItemId}
                          onChange={(next) => changeIngredient(index, next)}
                          className="min-w-40 flex-1"
                          options={(available ?? []).map((item) => ({
                            value: item.id,
                            label: item.name,
                            // Already used on another line. Shown rather than
                            // hidden, so the list does not change shape as lines
                            // are added.
                            disabled:
                              item.id !== line.inventoryItemId &&
                              lines.some((l) => l.inventoryItemId === item.id),
                          }))}
                        />

                        <label className="sr-only" htmlFor={`quantity-${index}`}>
                          Quantity
                        </label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min={INVENTORY_LIMITS.minPositiveQuantity}
                          step="0.001"
                          value={line.quantity}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((l, position) =>
                                position === index
                                  ? { ...l, quantity: event.target.value }
                                  : l,
                              ),
                            )
                          }
                          className="w-24"
                        />

                        <label className="sr-only" htmlFor={`unit-${index}`}>
                          Unit
                        </label>
                        <Select
                          id={`unit-${index}`}
                          value={line.unit}
                          onChange={(next) =>
                            setLines((current) =>
                              current.map((l, position) =>
                                position === index
                                  ? { ...l, unit: next as UnitOfMeasure }
                                  : l,
                              ),
                            )
                          }
                          className="w-32"
                          options={usable.map((unit) => ({
                            value: unit,
                            label: unit,
                          }))}
                        />

                        {ingredient !== undefined && (
                          <span className="flex items-center gap-1 pb-2 text-2xs text-subtle">
                            {ingredient.isOutOfStock ? (
                              <Badge tone="danger">out</Badge>
                            ) : (
                              <>
                                {formatQuantity(ingredient.quantityInStock)}{" "}
                                {UNIT_SHORT[ingredient.unit]} left
                              </>
                            )}
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((_, position) => position !== index),
                            )
                          }
                          icon={<Trash2 />}
                          className="mb-0.5 text-danger"
                        >
                          <span className="sr-only">Remove</span>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Button
                variant="secondary"
                onClick={addLine}
                disabled={!canAdd}
                icon={<Plus />}
              >
                {canAdd ? "Add an ingredient" : "Every ingredient is already listed"}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={() => void save()} disabled={isSaving || isLoading}>
            {isSaving ? "Saving…" : "Save recipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatQuantity(value: number): string {
  return Number(value.toFixed(3)).toString();
}
