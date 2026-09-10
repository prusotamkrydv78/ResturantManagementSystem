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
  Search,
  Send,
  StickyNote,
  Trash2,
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
import {
  useRealtimeEvent,
  type TicketPayload,
} from "@/lib/realtime/realtime-context";
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
  /**
   * The kitchen changed this order while there were unsaved edits on screen.
   *
   * Held rather than acted on, because refetching would call `adopt` and replace the
   * working copy - throwing away lines a waiter had added and not yet saved. Losing
   * somebody's typing to a chef ticking off a dish would be a far worse bug than a
   * stale panel, so the screen says so and waits.
   */
  const [kitchenMoved, setKitchenMoved] = useState(false);

  const [lines, setLines] = useState<EditableLine[]>([]);
  /**
   * Lines the waiter has taken off but the server still has.
   *
   * Kept rather than dropped, because a removal was the one edit with nothing left on
   * screen to show it happened. A waiter who mis-taps at a table had no way of seeing
   * what went, no way of putting it back, and nothing to read out to check - the dish
   * simply stopped existing and the total moved.
   *
   * Cleared by adopt, since after a save the server's copy is the truth.
   */
  const [removed, setRemoved] = useState<EditableLine[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  // Searched across every course rather than within the open tab. A waiter being
  // told a dish name at a table knows the name and not the course it is filed under,
  // and hunting five tabs for it in front of a guest is the slow part of the job.
  const [menuSearch, setMenuSearch] = useState("");
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
    setKitchenMoved(false);
    setRemoved([]);
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

  const removeLine = useCallback((index: number, line: EditableLine) => {
    setSavedAt(null);
    setSentTicketNumber(null);

    // Only one the server has. A line added and removed in the same sitting was never
    // anywhere but this screen, so there is nothing to undo and nothing to read back.
    if (line.id !== undefined) {
      setRemoved((kept) => [...kept, line]);
    }

    setLines((current) =>
      current.filter((existing, position) => existing.isSubmitted || position !== index),
    );
  }, []);

  const putBack = useCallback((line: EditableLine) => {
    setSavedAt(null);
    setSentTicketNumber(null);
    setRemoved((kept) => kept.filter((held) => held.id !== line.id));
    setLines((current) => [...current, line]);
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
  /**
   * Which lines have moved since the server last saw them, and how many.
   *
   * The screen could only tell a waiter that *something* was unsaved. A line added
   * showed a word in small type; a line whose quantity or note had been edited showed
   * nothing at all, so it sat among untouched lines looking exactly like them. Reading
   * an order back to a table and checking your own corrections is the whole job on
   * this screen, and it was the one thing the screen would not help with.
   *
   * Indexed to match `lines`, so a row can ask about itself by position.
   */
  const { marks, changes } = useMemo(() => {
    const before = new Map<string, { quantity: number; note: string }>();

    for (const item of order?.items ?? []) {
      before.set(item.id, {
        quantity: item.quantity,
        note: item.note ?? "",
      });
    }

    const marks = lines.map((line): "sent" | "new" | "changed" | "same" => {
      if (line.isSubmitted) {
        return "sent";
      }

      const was = line.id === undefined ? undefined : before.get(line.id);

      if (was === undefined) {
        return "new";
      }

      return was.quantity !== line.quantity || was.note !== line.note
        ? "changed"
        : "same";
    });

    // Counted off the marks rather than tallied while building them. Mutating a
    // running total inside the map is the sort of thing that reads fine and that the
    // compiler is right to refuse: nothing in a memo should be reassigned once the
    // render it belongs to is over.
    return {
      marks,
      changes: {
        added: marks.filter((mark) => mark === "new").length,
        changed: marks.filter((mark) => mark === "changed").length,
        removed: removed.length,
      },
    };
  }, [lines, order, removed.length]);

  /** The edits, in words, so a waiter can check them before saving. */
  const changeSummary = useMemo(() => {
    const parts: string[] = [];

    if (changes.added > 0) {
      parts.push(`${changes.added} added`);
    }

    if (changes.changed > 0) {
      parts.push(`${changes.changed} changed`);
    }

    if (changes.removed > 0) {
      parts.push(`${changes.removed} removed`);
    }

    return parts.join(" · ");
  }, [changes]);

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
   * Keeps this screen level with the kitchen.
   *
   * It had no live connection at all - it read the order once and then believed it
   * until something on this page caused a reload. So a chef ticking off a dish, or
   * pulling a slip back off the pass, changed nothing here: the waiter standing at
   * the table read a panel that had been true when they opened it. The per-dish
   * progress on that panel is worth very little if it is only as fresh as the last
   * page load.
   *
   * Filtered to this order. Every ticket in the restaurant comes down the same wire,
   * and refetching one order because another table's food is ready would be a request
   * per ticket per open screen for nothing.
   *
   * The handler is re-read from a ref on every render by `useRealtimeEvent`, so
   * closing over `isDirty` here is safe and always current.
   */
  const onKitchenEvent = (event: TicketPayload) => {
    if (event.orderId !== orderId) {
      return;
    }

    if (isDirty) {
      setKitchenMoved(true);

      return;
    }

    setReloadKey((key) => key + 1);
  };

  useRealtimeEvent<TicketPayload>("ticketQueued", onKitchenEvent);
  useRealtimeEvent<TicketPayload>("ticketStarted", onKitchenEvent);
  useRealtimeEvent<TicketPayload>("ticketReady", onKitchenEvent);
  useRealtimeEvent<TicketPayload>("ticketRecalled", onKitchenEvent);
  useRealtimeEvent<TicketPayload>("ticketServed", onKitchenEvent);

/**
   * How many of each dish are on this order, split by whether the kitchen has them.
   *
   * One number could not answer the question a waiter actually has. A badge reading
   * "1" on a dish already cooking looks identical to one on a dish still in the
   * basket, so somebody adding a second biryani could not tell whether the first was
   * theirs to change or already gone.
   */
  const onOrder = useMemo(() => {
    const counts = new Map<string, { sent: number; pending: number }>();

    for (const line of lines) {
      const seen = counts.get(line.menuItemId) ?? { sent: 0, pending: 0 };

      counts.set(line.menuItemId, {
        sent: seen.sent + (line.isSubmitted ? line.quantity : 0),
        pending: seen.pending + (line.isSubmitted ? 0 : line.quantity),
      });
    }

    return counts;
  }, [lines]);

  /** Every dish matching a search, flattened - the course stops mattering here. */
  const found = useMemo(() => {
    const term = menuSearch.trim().toLowerCase();

    if (term === "" || menu === null) {
      return null;
    }

    return menu
      .flatMap((category) => category.items)
      .filter((item) => item.name.toLowerCase().includes(term));
  }, [menu, menuSearch]);

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
          description={order.tableName}
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

  /**
   * The single next thing to do, worked out once.
   *
   * There were four things on this screen telling a waiter to act: a card at the top
   * about confirming, a banner about items the kitchen had not been told about, a Save
   * button inside the items panel, and a Send button in a panel below that. All four
   * could be on screen together, only one of them was ever the next move, and a waiter
   * standing at a table had to work out which. Now the screen says it.
   *
   * The order of the checks is the order of the job: nothing can be sent before it is
   * confirmed, and nothing can be confirmed or sent while there are edits the server
   * has not seen.
   */
  const step: {
    label: string;
    hint: string;
    tone: "danger" | "warning" | "primary" | "neutral";
    disabled: boolean;
    act: (() => void) | null;
  } = order.needsConfirmation
    ? {
        label: isConfirming
          ? "Confirming…"
          : isDirty
            ? "Save & confirm"
            : "Confirm order",
        hint: isEmpty
          ? "An order needs at least one item before it can be confirmed."
          : `Read it back to ${order.tableName} first. Nothing reaches the kitchen until you confirm, and they can still cancel it themselves until then.`,
        tone: "danger",
        disabled: isConfirming || isSaving || isEmpty,
        act: () => void confirm(),
      }
    : isDirty
      ? {
          label: isSaving ? "Saving…" : "Save changes",
          hint: isEmpty
            ? "An order needs at least one item. Add something, or leave without saving."
            : `${
                changeSummary === "" ? "Your edits" : changeSummary
              } — check it against the table, then save. The kitchen can only be sent what the server has stored.`,
          tone: "warning",
          disabled: isEmpty || isSaving,
          act: () => void save(),
        }
      : pendingUnits > 0
        ? {
            label: isSending
              ? "Sending…"
              : `Send ${pendingUnits} to the kitchen`,
            hint: `${
              pendingUnits === 1 ? "1 item is" : `${pendingUnits} items are`
            } waiting. Until they go through the food will not be made and the bill cannot be settled. Sent items cannot be changed.`,
            tone: "primary",
            disabled: !canSend,
            act: () => void sendToKitchen(),
          }
        : {
            label: "Everything is with the kitchen",
            hint:
              order.kitchenTickets.length === 0
                ? "Add something to send a ticket."
                : "Add another round, or take payment below when they are ready.",
            tone: "neutral",
            disabled: true,
            act: null,
          };

  const stepError = confirmError ?? saveError ?? sendError;

  return (
    <>
      <PageHeader
        // The name already says "Table 5". Prefixing it printed "Table Table 5" at
        // the top of every order in the product.
        title={order.tableName}
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

      <PageBody className="pb-24 lg:pb-5">
        {/* The order first, the menu second - in that order in the markup, which is
            what a phone reads. It was the other way round, so a waiter opening an
            order to read it back to the table scrolled past the whole menu to reach
            it. On a wide screen the order takes the narrow column, because it is a
            list, and the menu takes the wide one, because it is a grid. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
          {/* The order, and what to do with it */}
          <div className="flex flex-col gap-4">
            {/* Sticky on a wide screen, so the next move stays in view while the menu
                is scrolled beside it. On a phone the same answer is pinned to the
                bottom of the screen instead, at the foot of this file - both render
                the same StepBody, so they cannot come to disagree. */}
            <Surface
              className={cn(
                "hidden lg:sticky lg:top-4 lg:z-10 lg:flex lg:flex-col lg:gap-3 lg:p-4",
                step.tone === "danger" && "lg:border-danger-border",
                step.tone === "warning" && "lg:border-warning-border",
              )}
            >
              <StepBody
                order={order}
                step={step}
                error={stepError}
                savedAt={savedAt}
                isDirty={isDirty}
                sentTicketNumber={sentTicketNumber}
              />
            </Surface>
            <Surface>
              {/* Counted rather than merely flagged. "Unsaved changes" told a waiter
                  that something had moved without saying what, which is no use to
                  somebody checking their own corrections in front of a guest. */}
              <SurfaceHeader
                title="Items"
                description={
                  isDirty
                    ? changeSummary === ""
                      ? "Unsaved changes"
                      : changeSummary
                    : pendingUnits > 0
                      ? `${pendingUnits} waiting for the kitchen`
                      : "Everything is with the kitchen"
                }
                actions={
                  isDirty ? (
                    <Badge tone="warning" dot>
                      Not saved
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Saved</Badge>
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
                        const mark = marks[index] ?? "same";
                        const fromTable = line.addedByCustomer;

                        return (
                          <li
                            key={line.id ?? `new-${line.menuItemId}-${index}`}
                            // A stripe down the edge and a tinted ground, so the rows
                            // that need attention are found by glancing rather than by
                            // reading every line. A guest is waiting while this is
                            // read back to them.
                            //
                            // The table's own lines win the colour where both apply:
                            // a quantity a waiter changed can be checked against the
                            // paper, but a line the guest typed has to be said out
                            // loud to them, and that is the more expensive thing to
                            // miss.
                            className={cn(
                              "flex flex-col gap-2 border-l-4 px-3 py-2.5",
                              fromTable
                                ? "border-l-warning bg-warning-soft/25"
                                : mark === "new" || mark === "changed"
                                  ? "border-l-primary bg-primary-soft/25"
                                  : "border-l-transparent",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="truncate text-sm font-medium text-text">
                                  {line.name}
                                </span>

                                {/* Pills rather than a word in coloured type. At arm's
                                    length in a busy room, small text in a slightly
                                    different colour is not a signal. */}
                                {(fromTable || mark !== "same") && (
                                  <span className="flex flex-wrap items-center gap-1">
                                    {fromTable && (
                                      <Badge tone="warning">From the table</Badge>
                                    )}
                                    {mark === "new" && (
                                      <Badge tone="primary">Added</Badge>
                                    )}
                                    {mark === "changed" && (
                                      <Badge tone="primary">Changed</Badge>
                                    )}
                                  </span>
                                )}

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
                                onClick={() => removeLine(index, line)}
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

                  {/* Removals used to leave nothing behind. A waiter who took the
                      wrong dish off had no record of it, no way back, and nothing to
                      say to the table - and the only sign anything had happened was
                      the total moving. They stay here, struck through, until a save
                      makes them real. */}
                  {removed.length > 0 && (
                    <>
                      <GroupLabel>
                        <Trash2 className="size-3" />
                        Taken off — not saved yet
                      </GroupLabel>
                      <ul className="divide-y divide-border">
                        {removed.map((line) => (
                          <li
                            key={line.id}
                            className="flex items-center justify-between gap-2 border-l-4 border-l-danger bg-danger-soft/20 px-3 py-2.5"
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium text-muted line-through">
                                <span className="tabular mr-1.5 text-2xs font-semibold">
                                  {line.quantity}
                                  {"×"}
                                </span>
                                {line.name}
                              </span>
                              {line.note.trim() !== "" && (
                                <span className="text-2xs text-subtle line-through">
                                  {line.note}
                                </span>
                              )}
                            </span>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => putBack(line)}
                            >
                              Put back
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              {/* The total, and nothing to press. Saving lives in the one panel that
                  says what the next move is - a second Save button down here was one
                  of the four competing calls to action this screen used to have. */}
              <div className="flex flex-col gap-2 border-t border-border bg-surface-2 p-4">
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

              {/* Only ever shown mid-edit. Everything else refreshes itself; this is
                  the one case where it cannot, because taking the server's copy would
                  discard whatever is unsaved above. */}
              {kitchenMoved && (
                <p
                  role="status"
                  className="flex items-start gap-2 border-b border-warning-border bg-warning-soft px-4 py-2.5 text-2xs text-warning"
                >
                  <ChefHat className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  The kitchen has moved on since you opened this. Save your changes to
                  see where the food has got to.
                </p>
              )}

              {/* A record of what went, not a place to send from. Sending is the
                  next-step panel's job; this is what a waiter checks when a guest
                  asks how long the food will be. */}
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

              {order.kitchenTickets.length > 0 && (
                <ul className="divide-y divide-border border-t border-border">
                  {order.kitchenTickets.map((ticket) => (
                    <li key={ticket.id} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                          <ChefHat className="size-3.5 text-muted" />
                          KOT #{ticket.ticketNumber}
                        </span>
                        <Badge tone={ticketTone(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </div>

                      <p className="text-2xs text-subtle">
                        {ticket.itemCount}{" "}
                        {ticket.itemCount === 1 ? "item" : "items"} ·{" "}
                        {formatTime(ticket.createdAtUtc)}
                      </p>

                      {/* Dish by dish, because this is the screen a waiter is looking
                          at when a guest asks where their momo is.

                          The kitchen has ticked these off one at a time since per-dish
                          progress went in, and the guest's own phone shows it - this
                          was the only one of the three screens still reporting a whole
                          slip as one lump, which left the person actually standing at
                          the table the least informed of everybody. */}
                      <ul className="flex flex-col gap-1">
                        {ticket.items.map((item, position) => (
                          <li
                            key={`${ticket.id}-${position}`}
                            className="flex items-baseline justify-between gap-2 text-2xs"
                          >
                            <span
                              className={cn(
                                "min-w-0",
                                item.servedAtUtc !== null
                                  ? "text-subtle line-through"
                                  : "text-muted",
                              )}
                            >
                              <span className="tabular font-semibold">
                                {item.quantity}
                                {"×"}
                              </span>{" "}
                              {item.itemName}
                              {item.note !== null && item.note.trim() !== "" && (
                                <span className="text-subtle"> · {item.note}</span>
                              )}
                            </span>

                            <span
                              className={cn(
                                "shrink-0 font-medium whitespace-nowrap",
                                item.servedAtUtc !== null
                                  ? "text-muted"
                                  : item.readyAtUtc !== null
                                    ? "text-success"
                                    : "text-warning",
                              )}
                            >
                              {item.servedAtUtc !== null
                                ? "delivered"
                                : item.readyAtUtc !== null
                                  ? "at the pass"
                                  : "cooking"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>

          {/* Adding to the order. Second, because a waiter opening this screen is
              looking at what is on it far more often than they are adding to it -
              but wide, because when they are adding, they are hunting a name in a
              grid of forty. */}
          <Surface>
            <div className="flex flex-col gap-2 border-b border-border p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Search every course"
                  aria-label="Search the menu"
                  className="pl-8"
                />
              </div>

              {/* Hidden while searching. Results come from the whole menu, so a row
                  of course tabs above them would be claiming to filter something it
                  is not. */}
              {found === null && (
                <div className="flex gap-1 overflow-x-auto">
                  {menu.map((category) => {
                    const isActive = category.id === activeCategory?.id;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => setActiveCategoryId(category.id)}
                        className={cn(
                          "pressable shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
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
              )}
            </div>

            {found !== null && found.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nothing on the menu answers to “{menuSearch.trim()}”.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {(found ?? activeCategory?.items ?? []).map((item) => {
                  const already = onOrder.get(item.id) ?? { sent: 0, pending: 0 };
                  const total = already.sent + already.pending;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={cn(
                        "pressable relative flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                        total > 0
                          ? "border-primary-border bg-primary-soft/50"
                          : "border-border bg-surface hover:border-primary-border hover:bg-primary-soft",
                      )}
                    >
                      <span className="pr-7 text-base font-medium text-text">
                        {item.name}
                      </span>
                      <span className="tabular mt-auto text-sm font-semibold text-primary">
                        {item.price.toFixed(2)}
                      </span>

                      {/* How many are already on the order. A waiter halfway through
                          taking a round has no way of remembering whether they tapped
                          the biryani, and the answer was only in the other column.

                          Two pills rather than one total: the solid one is what is
                          still in their hands to change, the outlined one is what the
                          kitchen already has and cannot be taken back. */}
                      <span className="absolute top-2 right-2 flex items-center gap-1">
                        {already.sent > 0 && (
                          <span
                            title={`${already.sent} already with the kitchen`}
                            className="tabular flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface text-2xs font-semibold text-muted"
                          >
                            {already.sent}
                          </span>
                        )}
                        {already.pending > 0 && (
                          <span
                            title={`${already.pending} not sent yet`}
                            className="tabular flex size-5 items-center justify-center rounded-full bg-primary-solid text-2xs font-semibold text-primary-fg"
                          >
                            {already.pending}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Surface>
        </div>
      </PageBody>

      {/* The same answer as the panel on a wide screen, pinned where a thumb is.
          A waiter works this on a phone, scrolling the menu with the order out of
          sight above - so the next move has to travel with them. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 lg:hidden">
        <StepBody
          order={order}
          step={step}
          error={stepError}
          savedAt={savedAt}
          isDirty={isDirty}
          sentTicketNumber={sentTicketNumber}
          compact
        />
      </div>
    </>
  );
}

/**
 * What to do next, and why.
 *
 * One component so the wide-screen panel and the phone's bottom bar cannot drift
 * apart. `compact` drops the explanation, because a bar over a thumb has room for a
 * button and a line, and the explanation is on the panel for whoever has the screen
 * to read it on.
 */
function StepBody({
  order,
  step,
  error,
  savedAt,
  isDirty,
  sentTicketNumber,
  compact = false,
}: {
  order: Order;
  step: {
    label: string;
    hint: string;
    tone: "danger" | "warning" | "primary" | "neutral";
    disabled: boolean;
    act: (() => void) | null;
  };
  error: string | null;
  savedAt: number | null;
  isDirty: boolean;
  sentTicketNumber: number | null;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error !== null && <FormError message={error} />}
      {sentTicketNumber !== null && (
        <FormSuccess message={`Sent as KOT #${sentTicketNumber}.`} />
      )}
      {error === null && sentTicketNumber === null && savedAt !== null && !isDirty && (
        <FormSuccess message="Order updated." />
      )}

      {!compact && (
        <div className="flex items-start gap-2">
          {order.needsConfirmation && (
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
            >
              <UserRoundCheck className="size-3" />
            </span>
          )}
          <p className="text-2xs text-muted">{step.hint}</p>
        </div>
      )}

      <Button
        onClick={step.act ?? undefined}
        disabled={step.disabled}
        className="w-full"
        variant={step.tone === "neutral" ? "secondary" : "primary"}
        icon={
          step.tone === "danger" ? (
            <UserRoundCheck />
          ) : step.tone === "primary" ? (
            <Send />
          ) : undefined
        }
      >
        {step.label}
      </Button>
    </div>
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

/**
 * How a kitchen ticket's state should read.
 *
 * Every one of these was painted `warning`, so a ticket the kitchen had finished
 * cooking sat in the same amber as one nobody had picked up - which is the opposite of
 * what a waiter scanning this list wants to know, since Ready is the one that means go
 * and fetch it.
 */
function ticketTone(status: string): "neutral" | "primary" | "success" | "warning" {
  switch (status.toLowerCase()) {
    case "ready":
      return "success";
    case "preparing":
      return "primary";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
