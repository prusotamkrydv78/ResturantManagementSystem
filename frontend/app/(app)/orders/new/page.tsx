"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  Minus,
  Plus,
  ScrollText,
  Send,
  StickyNote,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, FormError, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  createOrder,
  listWaiterMenu,
  listWaiterTables,
} from "@/features/orders/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { ORDER_LIMITS } from "@/types/order";
import type {
  CartLine,
  Order,
  WaiterMenuCategory,
  WaiterTable,
} from "@/types/order";

/**
 * The waiter ordering screen.
 *
 * Built for speed at a table rather than for administration: pick a table, tap
 * items, adjust, place. The running total is shown from server-supplied prices for
 * the waiter benefit only — the API recalculates everything when the order is
 * placed, and the payload carries no prices at all.
 */
export default function NewOrderPage() {
  return (
    <RequireAuth roles={["Staff"]} staffRoles={["Waiter"]}>
      <NewOrder />
    </RequireAuth>
  );
}

function NewOrder() {
  const [tables, setTables] = useState<WaiterTable[] | null>(null);
  const [menu, setMenu] = useState<WaiterMenuCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [tableId, setTableId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedTables, loadedMenu] = await Promise.all([
          listWaiterTables(),
          listWaiterMenu(),
        ]);
        if (!cancelled) {
          setTables(loadedTables);
          setMenu(loadedMenu);
          setActiveCategoryId(loadedMenu[0]?.id ?? null);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load the ordering screen.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /* ---- cart operations, all local ---- */

  const addItem = useCallback(
    (item: { id: string; name: string; price: number }) => {
      setSubmitError(null);
      setCart((current) => {
        // Tapping an item again bumps the plain line rather than creating a second
        // one. A line with a note is left alone, since the note is what makes it
        // distinct.
        const index = current.findIndex(
          (line) => line.menuItemId === item.id && line.note === "",
        );

        if (index === -1) {
          return [
            ...current,
            { menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1, note: "" },
          ];
        }

        return current.map((line, position) =>
          position === index
            ? {
                ...line,
                quantity: Math.min(line.quantity + 1, ORDER_LIMITS.maxQuantity),
              }
            : line,
        );
      });
    },
    [],
  );

  const changeQuantity = useCallback((index: number, delta: number) => {
    setCart((current) =>
      current
        .map((line, position) =>
          position === index
            ? {
                ...line,
                quantity: Math.min(
                  Math.max(line.quantity + delta, 0),
                  ORDER_LIMITS.maxQuantity,
                ),
              }
            : line,
        )
        // Stepping below one removes the line, which is what a waiter expects.
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((index: number) => {
    setCart((current) => current.filter((_, position) => position !== index));
  }, []);

  const setNote = useCallback((index: number, note: string) => {
    setCart((current) =>
      current.map((line, position) =>
        position === index ? { ...line, note } : line,
      ),
    );
  }, []);

  const units = useMemo(
    () => cart.reduce((total, line) => total + line.quantity, 0),
    [cart],
  );
  const runningTotal = useMemo(
    () => cart.reduce((total, line) => total + line.unitPrice * line.quantity, 0),
    [cart],
  );

  async function placeOrder() {
    if (tableId === null || cart.length === 0) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        tableId,
        items: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          ...(line.note.trim() === "" ? {} : { note: line.note.trim() }),
        })),
      });

      setPlaced(order);
      setCart([]);
      setTableId(null);
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not place the order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ---- confirmation ---- */

  if (placed !== null) {
    return <OrderPlaced order={placed} onNext={() => setPlaced(null)} />;
  }

  /* ---- loading and failure ---- */

  if (loadError !== null) {
    return (
      <>
        <PageHeader title="New order" />
        <PageBody>
          <Surface>
            <ErrorState
              message={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  if (tables === null || menu === null) {
    return (
      <>
        <PageHeader title="New order" />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </Surface>
        </PageBody>
      </>
    );
  }

  /* ---- nothing to work with ---- */

  if (tables.length === 0 || menu.length === 0) {
    return (
      <>
        <PageHeader title="New order" />
        <PageBody>
          <Surface>
            <EmptyState
              icon={tables.length === 0 ? <Armchair /> : <ScrollText />}
              title={
                tables.length === 0
                  ? "No tables in service"
                  : "Nothing on the menu yet"
              }
              description={
                tables.length === 0
                  ? "Your manager needs to add or reopen a table before orders can be taken."
                  : "Your manager needs to put items on the menu before orders can be taken."
              }
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  const activeCategory =
    menu.find((category) => category.id === activeCategoryId) ?? menu[0];
  const selectedTable = tables.find((table) => table.id === tableId) ?? null;
  const canPlace = tableId !== null && cart.length > 0 && !isSubmitting;

  return (
    <>
      <PageHeader
        title="New order"
        description="Pick a table, add what the guests asked for, then place the order."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "New order" }]}
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* Left: table, then menu */}
          <div className="flex min-w-0 flex-col gap-4">
            <Surface>
              <SurfaceHeader
                title="Table"
                description={
                  selectedTable === null
                    ? "Choose where the order is going"
                    : `Seats ${selectedTable.capacity}`
                }
              />
              <div className="flex flex-wrap gap-2 p-4">
                {tables.map((table) => {
                  const isSelected = table.id === tableId;

                  return (
                    <button
                      key={table.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setTableId(table.id);
                        setSubmitError(null);
                      }}
                      className={cn(
                        "flex min-w-20 flex-col items-center gap-0.5 rounded-md border px-3 py-2",
                        "transition-colors",
                        isSelected
                          ? "border-primary-solid bg-primary-solid text-primary-fg"
                          : "border-border-strong bg-surface text-text hover:bg-surface-3",
                      )}
                    >
                      <span className="text-sm font-semibold">{table.name}</span>
                      <span
                        className={cn(
                          "text-2xs",
                          isSelected ? "text-primary-fg/80" : "text-muted",
                        )}
                      >
                        {table.capacity} seats
                      </span>
                    </button>
                  );
                })}
              </div>
            </Surface>

            <Surface>
              {/* Category strip: scrolls sideways on a phone rather than wrapping
                  into a tall block that pushes the menu off screen. */}
              <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
                {menu.map((category) => {
                  const isActive = category.id === activeCategory?.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => setActiveCategoryId(category.id)}
                      className={cn(
                        "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary-soft font-medium text-primary"
                          : "text-muted hover:bg-surface-3 hover:text-text",
                      )}
                    >
                      {category.name}
                      <span className="ml-1.5 text-2xs text-subtle">
                        {category.items.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {(activeCategory?.items ?? []).map((item) => {
                  const inCart = cart
                    .filter((line) => line.menuItemId === item.id)
                    .reduce((total, line) => total + line.quantity, 0);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-md border border-border bg-surface p-3 text-left",
                        "transition-colors hover:border-primary-border hover:bg-primary-soft",
                      )}
                    >
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="min-w-0 text-base font-medium text-text">
                          {item.name}
                        </span>
                        {inCart > 0 && (
                          <Badge tone="primary">{inCart}</Badge>
                        )}
                      </span>
                      {item.description !== null && (
                        <span className="line-clamp-2 text-xs text-muted">
                          {item.description}
                        </span>
                      )}
                      <span className="tabular mt-auto text-sm font-semibold text-primary">
                        {formatMoney(item.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Surface>
          </div>

          {/* Right: the order being built */}
          <Surface className="lg:sticky lg:top-4">
            <SurfaceHeader
              title="Order"
              description={
                selectedTable === null
                  ? "No table chosen"
                  : `Table ${selectedTable.name}`
              }
              actions={
                cart.length > 0 ? (
                  <span className="text-xs text-muted">
                    {units} {units === 1 ? "item" : "items"}
                  </span>
                ) : undefined
              }
            />

            {cart.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-muted">
                  Tap items on the left to build the order.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((line, index) => (
                  <li key={`${line.menuItemId}-${index}`} className="flex flex-col gap-2 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-text">
                          {line.name}
                        </span>
                        <span className="tabular text-2xs text-muted">
                          {formatMoney(line.unitPrice)} each
                        </span>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold text-text">
                        {formatMoney(line.unitPrice * line.quantity)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <IconButton
                        label={`Reduce ${line.name}`}
                        onClick={() => changeQuantity(index, -1)}
                      >
                        <Minus className="size-3.5" />
                      </IconButton>
                      <span className="tabular w-7 text-center text-sm font-semibold text-text">
                        {line.quantity}
                      </span>
                      <IconButton
                        label={`Add another ${line.name}`}
                        onClick={() => changeQuantity(index, 1)}
                        disabled={line.quantity >= ORDER_LIMITS.maxQuantity}
                      >
                        <Plus className="size-3.5" />
                      </IconButton>

                      <IconButton
                        label={`Note for ${line.name}`}
                        onClick={() =>
                          setNoteFor(noteFor === `${index}` ? null : `${index}`)
                        }
                        active={line.note.trim() !== ""}
                      >
                        <StickyNote className="size-3.5" />
                      </IconButton>

                      <IconButton
                        label={`Remove ${line.name}`}
                        onClick={() => removeLine(index)}
                        className="ml-auto"
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>

                    {(noteFor === `${index}` || line.note.trim() !== "") && (
                      <Input
                        id={`note-${index}`}
                        placeholder="No ice, extra spicy…"
                        maxLength={ORDER_LIMITS.maxNoteLength}
                        value={line.note}
                        onChange={(event) => setNote(index, event.target.value)}
                        aria-label={`Note for ${line.name}`}
                        className="h-8 text-sm"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-3 border-t border-border bg-surface-2 p-4">
              {submitError !== null && <FormError message={submitError} />}

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Total</span>
                <span className="tabular text-xl font-semibold text-text">
                  {formatMoney(runningTotal)}
                </span>
              </div>

              <p className="text-2xs text-subtle">
                Confirmed by the server when the order is placed.
              </p>

              <Button
                onClick={() => void placeOrder()}
                disabled={!canPlace}
                className="w-full"
              >
                {isSubmitting
                  ? "Placing…"
                  : tableId === null
                    ? "Choose a table first"
                    : cart.length === 0
                      ? "Add an item"
                      : "Place order"}
              </Button>
            </div>
          </Surface>
        </div>
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  active = false,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "border-primary-border bg-primary-soft text-primary"
          : "border-border-strong bg-surface text-muted hover:bg-surface-3 hover:text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Confirmation after the order is placed, showing what the server recorded. */
function OrderPlaced({ order, onNext }: { order: Order; onNext: () => void }) {
  return (
    <>
      <PageHeader
        title={`Order #${order.orderNumber} placed`}
        description={`Table ${order.tableName} · ${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`}
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "New order" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/orders/${order.id}`} icon={<Send />}>
              Send to kitchen
            </LinkButton>
            <Button onClick={onNext} variant="secondary" icon={<Plus />}>
              Take another order
            </Button>
          </div>
        }
      />

      <PageBody>
        <Surface className="border-warning-border bg-warning-soft">
          <div className="flex flex-col gap-3 px-4 py-3">
            <p className="flex items-start gap-2.5 text-base font-medium text-text">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden="true"
              />
              <span>
                The kitchen has not been told about this yet. Placing an order records
                it; sending it is a separate step, so nothing is cooking until you send
                it through.
              </span>
            </p>
            <LinkButton
              href={`/orders/${order.id}`}
              icon={<Send />}
              className="self-start"
            >
              Send {order.itemCount} to kitchen
            </LinkButton>
          </div>
        </Surface>

        <Surface>
          <SurfaceHeader
            title="What was recorded"
            description="Names and prices are stored as they were at this moment"
          />
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-base text-text">
                    <span className="tabular font-semibold">{item.quantity}×</span>{" "}
                    {item.itemName}
                  </span>
                  {item.note !== null && (
                    <span className="text-xs text-muted">{item.note}</span>
                  )}
                  <span className="tabular text-2xs text-subtle">
                    {formatMoney(item.unitPrice)} each
                  </span>
                </div>
                <span className="tabular shrink-0 text-base font-semibold text-text">
                  {formatMoney(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border bg-surface-2 px-4 py-3">
            <span className="text-sm font-medium text-text">Total</span>
            <span className="tabular text-lg font-semibold text-text">
              {formatMoney(order.subtotal)}
            </span>
          </div>
        </Surface>

        <p className="text-xs text-muted">
          Placed by {order.createdByName}.{" "}
          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
            Open the order
          </Link>{" "}
          to send it to the kitchen, or{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            go back to the overview
          </Link>
          .
        </p>
      </PageBody>
    </>
  );
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}
