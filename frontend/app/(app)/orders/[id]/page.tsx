"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChefHat,
  Lock,
  Minus,
  Plus,
  HandCoins,
  Send,
  StickyNote,
  Trash2,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  confirmOrder,
  getOrder,
  listWaiterMenu,
  submitToKitchen,
  updateOrder,
} from "@/features/orders/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { ORDER_LIMITS } from "@/types/order";
import type { EditableLine, Order, WaiterMenuCategory } from "@/types/order";

/**
 * Managing an order that is already running.
 *
 * Deliberately the same shape as the New Order screen: menu on the left, the order
 * on the right. Two differences matter here. Lines carrying an id are historical, so
 * the server keeps their recorded price when the quantity changes. And lines already
 * sent to the kitchen are shown but not editable: the kitchen has been told to cook
 * them, so the record of what was asked for cannot move afterwards.
 *
 * An order a customer placed themselves arrives here needing confirmation, and takes
 * over the top of the screen until it gets it. The kitchen will refuse it until then,
 * which is the whole point: a waiter goes to the table, reads the order back, fixes
 * whatever was misunderstood with the ordinary controls below, and confirms once.
 * Confirming and saving are one tap, because a waiter mid-conversation with a table
 * should not have to remember an order of operations.
 */
export default function OrderDetailPage() {
  return (
    <RequireAuth roles={["Staff"]} staffRoles={["Waiter"]}>
      <OrderDetail />
    </RequireAuth>
  );
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<WaiterMenuCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [lines, setLines] = useState<EditableLine[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentTicketNumber, setSentTicketNumber] = useState<number | null>(null);

  /** Turns a loaded order into the editable working copy. */
  const adopt = useCallback((loaded: Order) => {
    setOrder(loaded);
    setLines(
      loaded.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.itemName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        note: item.note ?? "",
        isSubmitted: item.isSubmittedToKitchen,
        kitchenTicketNumber: item.kitchenTicketNumber,
        addedByCustomer: item.addedByCustomer,
      })),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedOrder, loadedMenu] = await Promise.all([
          getOrder(orderId),
          listWaiterMenu(),
        ]);
        if (!cancelled) {
          adopt(loadedOrder);
          setMenu(loadedMenu);
          setActiveCategoryId(loadedMenu[0]?.id ?? null);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load this order.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey, adopt]);

  /* ---- local edits ---- */

  const addItem = useCallback(
    (item: { id: string; name: string; price: number }) => {
      setSaveError(null);
      setSavedAt(null);
      setSentTicketNumber(null);
      setLines((current) => {
        // Only fold into a line that is still pending and whose recorded price
        // matches today price. A line already with the kitchen is untouchable, and a
        // stale price would be silently rewritten. Both cases produce a new line,
        // which is exactly what the server does.
        const index = current.findIndex(
          (line) =>
            !line.isSubmitted &&
            line.menuItemId === item.id &&
            line.note === "" &&
            line.unitPrice === item.price,
        );

        if (index === -1) {
          return [
            ...current,
            {
              menuItemId: item.id,
              name: item.name,
              unitPrice: item.price,
              quantity: 1,
              note: "",
              isSubmitted: false,
              kitchenTicketNumber: null,
              // A waiter is adding this one, so it needs no reading back.
              addedByCustomer: false,
            },
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
    setSavedAt(null);
    setSentTicketNumber(null);
    setLines((current) =>
      current
        .map((line, position) =>
          position === index && !line.isSubmitted
            ? {
                ...line,
                quantity: Math.min(
                  Math.max(line.quantity + delta, 0),
                  ORDER_LIMITS.maxQuantity,
                ),
              }
            : line,
        )
        .filter((line) => line.isSubmitted || line.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((index: number) => {
    setSavedAt(null);
    setSentTicketNumber(null);
    setLines((current) =>
      current.filter((line, position) => line.isSubmitted || position !== index),
    );
  }, []);

  const setNote = useCallback((index: number, note: string) => {
    setSavedAt(null);
    setSentTicketNumber(null);
    setLines((current) =>
      current.map((line, position) =>
        position === index && !line.isSubmitted ? { ...line, note } : line,
      ),
    );
  }, []);

  /* ---- what changed ---- */

  const isDirty = useMemo(() => {
    if (order === null) {
      return false;
    }

    if (lines.length !== order.items.length) {
      return true;
    }

    // Compare against the saved order rather than tracking edits, so undoing a
    // change back to its original value correctly counts as clean.
    return lines.some((line) => {
      if (line.id === undefined) {
        return true;
      }

      const original = order.items.find((item) => item.id === line.id);

      return (
        original === undefined ||
        original.quantity !== line.quantity ||
        (original.note ?? "") !== line.note
      );
    });
  }, [lines, order]);

  // Positions travel with the lines because every edit addresses a line by its
  // index in the single working array. The two groups below are views over that
  // array rather than arrays of their own.
  const placed = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter((entry) => entry.line.isSubmitted),
    [lines],
  );

  const pending = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter((entry) => !entry.line.isSubmitted),
    [lines],
  );

  const pendingUnits = useMemo(
    () => pending.reduce((sum, entry) => sum + entry.line.quantity, 0),
    [pending],
  );

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [lines],
  );

  /**
   * Saves the working copy, and hands back what the server stored.
   *
   * The return value is what lets confirming save first in the same tap: the caller
   * needs to know the save actually happened, and null says it did not.
   */
  async function save(): Promise<Order | null> {
    if (order === null || lines.length === 0) {
      return null;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const updated = await updateOrder(order.id, {
        // Existing lines: identity plus the two things that may move. Lines already
        // with the kitchen go along unchanged, which is what the server expects as
        // proof they are still intact.
        lines: lines
          .filter((line) => line.id !== undefined)
          .map((line) => ({
            id: line.id!,
            quantity: line.quantity,
            ...(line.note.trim() === "" ? {} : { note: line.note.trim() }),
          })),
        // New items: the server prices these itself.
        newItems: lines
          .filter((line) => line.id === undefined)
          .map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            ...(line.note.trim() === "" ? {} : { note: line.note.trim() }),
          })),
        rowVersion: order.rowVersion,
      });

      adopt(updated);
      setSavedAt(Date.now());
      setSentTicketNumber(null);

      return updated;
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not save the order.",
      );

      return null;
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Records that this order has been checked with the table.
   *
   * Saves any adjustments first, because confirming an order while the screen holds
   * unsaved changes would agree to something the restaurant does not have. One tap
   * rather than two: the waiter is standing at the table talking to somebody, and
   * "save, then confirm" is an order of operations to get wrong.
   *
   * A save that fails stops the confirmation. Nothing is half-done - the order simply
   * stays unconfirmed, with the changes still on screen and the reason shown.
   */
  async function confirm() {
    if (order === null) {
      return;
    }

    setConfirmError(null);
    setIsConfirming(true);

    try {
      if (isDirty) {
        const saved = await save();

        if (saved === null) {
          return;
        }
      }

      adopt(await confirmOrder(order.id));
    } catch (caught) {
      setConfirmError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not confirm this order.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function sendToKitchen() {
    if (order === null) {
      return;
    }

    setSendError(null);
    setIsSending(true);

    try {
      // No payload: the server decides what is still waiting, so the kitchen can
      // never be told to cook something this screen merely believed was pending.
      const result = await submitToKitchen(order.id);

      adopt(result.order);
      setSavedAt(null);
      setSentTicketNumber(result.ticket.ticketNumber);
    } catch (caught) {
      setSendError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not send this order to the kitchen.",
      );
    } finally {
      setIsSending(false);
    }
  }

  /* ---- states ---- */

  if (loadError !== null) {
    return (
      <>
        <PageHeader title="Order" />
        <PageBody>
          <Surface>
            <ErrorState
              message={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
          <LinkButton href="/orders" variant="secondary" icon={<ArrowLeft />}>
            Back to orders
          </LinkButton>
        </PageBody>
      </>
    );
  }

  if (order === null || menu === null) {
    return (
      <>
        <PageHeader title="Order" />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
          </Surface>
        </PageBody>
      </>
    );
  }

  if (!order.isEditable) {
    return (
      <>
        <PageHeader
          title={`Order #${order.orderNumber}`}
          description={`Table ${order.tableName}`}
        />
        <PageBody>
          <Surface>
            <EmptyState
              icon={<Lock />}
              title="This order is locked"
              description="It has moved past the point where it can be changed."
              action={
                <LinkButton href="/orders" variant="secondary">
                  Back to orders
                </LinkButton>
              }
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  const activeCategory =
    menu.find((category) => category.id === activeCategoryId) ?? menu[0];
  const isEmpty = lines.length === 0;

  // Save first, then send. Submitting the working copy would be a lie: only what
  // the server has already stored can go onto a ticket.
  const canSend =
    pendingUnits > 0 &&
    !isDirty &&
    !isSaving &&
    !isSending &&
    !order.needsConfirmation;

  return (
    <>
      <PageHeader
        title={`Table ${order.tableName}`}
        description={`Order #${order.orderNumber} · opened ${formatTime(order.createdAtUtc)} by ${order.createdByName}`}
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Orders", href: "/orders" },
          { label: `#${order.orderNumber}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {order.needsConfirmation ? (
              <Badge tone="danger" dot>
                Needs confirming
              </Badge>
            ) : (
              <Badge tone="primary" dot>
                {order.status}
              </Badge>
            )}
            <Button
              variant="secondary"
              onClick={() => router.push("/orders")}
              icon={<ArrowLeft />}
            >
              Orders
            </Button>
          </div>
        }
      />

      <PageBody>
        {/* Above the menu and the order, because until this is done nothing else on
            this screen can go anywhere. A customer is sitting at the table. */}
        {order.needsConfirmation && (
          <Surface className="border-danger-border">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
              >
                <UserRoundCheck className="size-5" />
              </span>

              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-base font-semibold text-text">
                  {order.tableName} ordered this themselves
                </h2>
                <p className="text-sm text-muted">
                  Nothing has been sent to the kitchen and nothing will be until you
                  confirm it. Go to the table, read the order back, change whatever
                  they did not mean below, then confirm — that sends your changes too.
                </p>
                <p className="text-2xs text-subtle">
                  They can still cancel it themselves until you confirm.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:w-52">
                {confirmError !== null && <FormError message={confirmError} />}

                <Button
                  onClick={() => void confirm()}
                  disabled={isConfirming || isSaving || isEmpty}
                  className="w-full"
                  icon={<UserRoundCheck />}
                >
                  {isConfirming
                    ? "Confirming…"
                    : isDirty
                      ? "Save & confirm"
                      : "Confirm order"}
                </Button>

                <p className="text-2xs text-subtle">
                  {isDirty
                    ? "Your changes are saved as part of confirming."
                    : "Confirming opens the kitchen. It does not send anything yet."}
                </p>
              </div>
            </div>
          </Surface>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* Menu, to add more */}
          <Surface>
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
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {(activeCategory?.items ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className="flex flex-col items-start gap-1 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-primary-border hover:bg-primary-soft"
                >
                  <span className="text-base font-medium text-text">{item.name}</span>
                  <span className="tabular mt-auto text-sm font-semibold text-primary">
                    {item.price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </Surface>

          {/* The order, then the kitchen */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            {/*
              Placing an order does not send it. That is deliberate, so drinks can go
              now and food later, but it means a waiter who stops here leaves an order
              the kitchen has never heard of. This says so at the top of the column
              rather than leaving it to be inferred from a button further down, and it
              names the consequence: the bill cannot be settled either.
            */}
            {order.isEditable && pendingUnits > 0 && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {isDirty
                    ? "Save your changes, then send the order to the kitchen. Nothing is cooking yet."
                    : `The kitchen has not been told about ${
                        pendingUnits === 1 ? "1 item" : `${pendingUnits} items`
                      }. Send ${
                        pendingUnits === 1 ? "it" : "them"
                      } through, or the food will not be made and the bill cannot be settled.`}
                </span>
              </p>
            )}

            <Surface>
              <SurfaceHeader
                title="Items"
                description={
                  isDirty
                    ? "Unsaved changes"
                    : pendingUnits > 0
                      ? `${pendingUnits} waiting for the kitchen`
                      : "Everything is with the kitchen"
                }
                actions={
                  isDirty ? (
                    <Badge tone="warning" dot>
                      Pending
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Up to date</Badge>
                  )
                }
              />

              {isEmpty ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted">
                    An order needs at least one item. Add something, or leave without
                    saving.
                  </p>
                </div>
              ) : (
                <>
                  {placed.length > 0 && (
                    <>
                      <GroupLabel>
                        <Lock className="size-3" />
                        Sent to the kitchen
                      </GroupLabel>
                      <ul className="divide-y divide-border">
                        {placed.map(({ line, index }) => (
                          <li
                            key={line.id ?? `sent-${index}`}
                            className="flex flex-col gap-1 bg-surface-2 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium text-text">
                                  <span className="tabular mr-1.5 text-2xs font-semibold text-muted">
                                    {line.quantity}
                                    {"×"}
                                  </span>
                                  {line.name}
                                </span>
                                <span className="text-2xs text-subtle">
                                  KOT #{line.kitchenTicketNumber ?? "—"} ·{" "}
                                  {line.unitPrice.toFixed(2)} each
                                </span>
                              </div>
                              <span className="tabular shrink-0 text-sm font-semibold text-muted">
                                {(line.unitPrice * line.quantity).toFixed(2)}
                              </span>
                            </div>

                            {line.note.trim() !== "" && (
                              <p className="text-2xs text-muted">
                                <StickyNote className="mr-1 inline size-3 align-[-1px]" />
                                {line.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <GroupLabel>
                    <Plus className="size-3" />
                    Not sent yet
                  </GroupLabel>

                  {pending.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted">
                      All items have been sent to the kitchen. Add something to send
                      another ticket.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {pending.map(({ line, index }) => {
                        const isNew = line.id === undefined;

                        return (
                          <li
                            key={line.id ?? `new-${line.menuItemId}-${index}`}
                            className="flex flex-col gap-2 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium text-text">
                                  {line.name}
                                  {isNew && (
                                    <span className="ml-1.5 text-2xs font-normal text-primary">
                                      new
                                    </span>
                                  )}
                                  {line.addedByCustomer && !line.isSubmitted && (
                                    <span className="ml-1.5 text-2xs font-normal text-warning">
                                      from the table
                                    </span>
                                  )}
                                </span>
                                <span className="tabular text-2xs text-muted">
                                  {line.unitPrice.toFixed(2)} each
                                </span>
                              </div>
                              <span className="tabular shrink-0 text-sm font-semibold text-text">
                                {(line.unitPrice * line.quantity).toFixed(2)}
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
                                  setNoteFor(noteFor === index ? null : index)
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

                            {(noteFor === index || line.note.trim() !== "") && (
                              <Input
                                id={`note-${index}`}
                                placeholder="No ice, extra spicy…"
                                maxLength={ORDER_LIMITS.maxNoteLength}
                                value={line.note}
                                onChange={(event) =>
                                  setNote(index, event.target.value)
                                }
                                aria-label={`Note for ${line.name}`}
                                className="h-8 text-sm"
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}

              <div className="flex flex-col gap-3 border-t border-border bg-surface-2 p-4">
                {saveError !== null && <FormError message={saveError} />}
                {savedAt !== null && !isDirty && (
                  <FormSuccess message="Order updated." />
                )}

                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Total</span>
                  <span className="tabular text-xl font-semibold text-text">
                    {total.toFixed(2)}
                  </span>
                </div>

                <p className="text-2xs text-subtle">
                  Recalculated by the server on save. Existing lines keep the price
                  they were ordered at, and lines already with the kitchen cannot be
                  changed at all.
                </p>

                <Button
                  onClick={() => void save()}
                  disabled={!isDirty || isEmpty || isSaving}
                  className="w-full"
                >
                  {isSaving
                    ? "Saving…"
                    : isEmpty
                      ? "Add an item"
                      : isDirty
                        ? "Save changes"
                        : "No changes"}
                </Button>
              </div>
            </Surface>

            <Surface>
              {order.confirmedAtUtc !== null && order.isCustomerPlaced && (
                <p className="flex items-start gap-1.5 px-4 pt-4 text-2xs text-muted">
                  <UserRoundCheck
                    className="mt-px size-3.5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  Confirmed with the table at {formatTime(order.confirmedAtUtc)}
                  {order.confirmedByName !== null && ` by ${order.confirmedByName}`}.
                </p>
              )}

              <BillPanel order={order} />

              <SurfaceHeader
                title="Kitchen"
                description={
                  order.kitchenTickets.length === 0
                    ? "Nothing sent yet"
                    : `${order.kitchenTickets.length} ${
                        order.kitchenTickets.length === 1 ? "ticket" : "tickets"
                      } sent`
                }
              />

              <div className="flex flex-col gap-3 p-4">
                {sendError !== null && <FormError message={sendError} />}
                {sentTicketNumber !== null && (
                  <FormSuccess message={`Sent as KOT #${sentTicketNumber}.`} />
                )}

                <p className="text-2xs text-subtle">
                  {order.needsConfirmation
                    ? "Confirm this order with the table first. The kitchen will refuse it until you do."
                    : pendingUnits === 0
                      ? "Nothing is waiting. Add items to send another ticket."
                      : isDirty
                        ? "Save your changes first, so the kitchen receives what is actually on the order."
                        : `${pendingUnits} ${
                            pendingUnits === 1 ? "item" : "items"
                          } will be sent as one ticket. Once sent they cannot be changed.`}
                </p>

                <Button
                  onClick={() => void sendToKitchen()}
                  disabled={!canSend}
                  className="w-full"
                  icon={<Send />}
                >
                  {isSending
                    ? "Sending…"
                    : order.needsConfirmation
                      ? "Confirm it first"
                      : pendingUnits === 0
                        ? "Nothing to send"
                        : `Send ${pendingUnits} to kitchen`}
                </Button>
              </div>

              {order.kitchenTickets.length > 0 && (
                <ul className="divide-y divide-border border-t border-border">
                  {order.kitchenTickets.map((ticket) => (
                    <li key={ticket.id} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                          <ChefHat className="size-3.5 text-muted" />
                          KOT #{ticket.ticketNumber}
                        </span>
                        <Badge tone="warning">{ticket.status}</Badge>
                      </div>

                      <p className="text-2xs text-subtle">
                        {ticket.itemCount}{" "}
                        {ticket.itemCount === 1 ? "item" : "items"} ·{" "}
                        {formatTime(ticket.createdAtUtc)}
                      </p>

                      <ul className="flex flex-col gap-0.5">
                        {ticket.items.map((item, position) => (
                          <li
                            key={`${ticket.id}-${position}`}
                            className="text-2xs text-muted"
                          >
                            <span className="tabular font-semibold">
                              {item.quantity}
                              {"×"}
                            </span>{" "}
                            {item.itemName}
                            {item.note !== null && item.note.trim() !== "" && (
                              <span className="text-subtle"> · {item.note}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>
        </div>
      </PageBody>
    </>
  );
}

/**
 * What the table owes, and the way to take it.
 *
 * On the order screen rather than only in the billing queue, because this is where a
 * waiter already is when a table calls them over - and until this existed, somebody
 * who saw "Table 3 is asking to pay" had nowhere to go from here.
 *
 * Taking the payment is a link rather than a form. Settling is a screen of its own
 * with a method to pick, part payments and a receipt at the end, and a second copy of
 * that here would be a second place for the rules to drift.
 */
function BillPanel({ order }: { order: Order }) {
  const asked = order.billRequestedAtUtc !== null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border p-4",
        asked && "bg-warning-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-text">The bill</span>
          {asked && (
            <span className="text-2xs font-medium text-warning">
              This table asked to pay at {formatTime(order.billRequestedAtUtc!)}
            </span>
          )}
        </div>

        {asked && (
          <Badge tone="warning" dot>
            Asking to pay
          </Badge>
        )}
      </div>

      {/* Itemised, because the figure a waiter quotes has to match the one on the
          customer's phone - and the subtotal alone understates it by the tax and
          the service charge. */}
      <dl className="flex flex-col gap-1">
        <BillLine label="Food" amount={order.subtotal} currency={order.currency} />

        {order.discountAmount > 0 && (
          <BillLine
            label="Discount"
            amount={-order.discountAmount}
            currency={order.currency}
          />
        )}

        {order.serviceChargeAmount > 0 && (
          <BillLine
            label="Service charge"
            amount={order.serviceChargeAmount}
            currency={order.currency}
          />
        )}

        {order.vatAmount > 0 && (
          <BillLine label="VAT" amount={order.vatAmount} currency={order.currency} />
        )}

        <div className="flex items-baseline justify-between border-t border-border pt-1.5">
          <dt className="text-sm font-medium text-text">Total</dt>
          <dd className="tabular text-lg font-semibold text-text">
            {order.currency} {order.total.toFixed(2)}
          </dd>
        </div>

        {order.amountPaid > 0 && (
          <BillLine
            label="Still owed"
            amount={order.amountOutstanding}
            currency={order.currency}
          />
        )}
      </dl>

      {order.canSettle ? (
        <LinkButton
          href={`/billing/${order.id}`}
          icon={<HandCoins />}
          className="w-full"
        >
          Take payment
        </LinkButton>
      ) : (
        // Said plainly rather than shown as a disabled button. There is something to
        // do about each of these, and it is not pressing this.
        <p className="text-2xs text-subtle">
          {order.unsubmittedItemCount > 0
            ? "Send everything to the kitchen before taking payment."
            : "The kitchen is still working on this order."}
        </p>
      )}
    </div>
  );
}

/** One line of the bill. */
function BillLine({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular text-sm text-text">
        {currency} {amount.toFixed(2)}
      </dd>
    </div>
  );
}

/** A quiet divider naming the group of lines that follows. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 border-y border-border bg-surface-3 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </p>
  );
}

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

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
