"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A repeatable section of the page: dishes, features, gallery images, opening
 * hours, quotes, footer links.
 *
 * Written once rather than six times, because all six are the same interaction —
 * add a row, edit it, move it, remove it — and only the fields inside a row differ.
 * The caller supplies those and a blank row to add.
 *
 * Order is part of the content here: these lists are rendered top to bottom on the
 * page, so moving a dish up is editing the page, not sorting a table.
 */
export function ListEditor<T>({
  label,
  addLabel,
  emptyHint,
  items,
  blank,
  onChange,
  renderRow,
  max = 24,
}: {
  label: string;
  addLabel: string;
  /** Shown instead of rows when the list is empty, so the section explains itself. */
  emptyHint: string;
  items: T[];
  blank: () => T;
  onChange: (next: T[]) => void;
  renderRow: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  max?: number;
}) {
  function replaceAt(index: number, patch: Partial<T>) {
    onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  }

  function removeAt(index: number) {
    onChange(items.filter((_, at) => at !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= items.length) {
      return;
    }

    // Swapped through a temporary rather than a destructuring swap: indexed access
    // is typed as possibly-undefined under noUncheckedIndexedAccess, and the bounds
    // are already established above.
    const next = [...items];
    const moved = next[index]!;
    next[index] = next[target]!;
    next[target] = moved;

    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {emptyHint}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                  {label} {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${label} ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    icon={<ChevronUp />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${label} ${index + 1} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    icon={<ChevronDown />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${label} ${index + 1}`}
                    onClick={() => removeAt(index)}
                    icon={<Trash2 />}
                  />
                </div>
              </div>

              {renderRow(item, (patch) => replaceAt(index, patch), index)}
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus />}
          disabled={items.length >= max}
          onClick={() => onChange([...items, blank()])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
