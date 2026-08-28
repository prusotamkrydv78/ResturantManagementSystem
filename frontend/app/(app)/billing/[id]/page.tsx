"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ChefHat,
  CircleCheck,
  CreditCard,
  Flame,
  Info,
  Receipt,
  Smartphone,
  StickyNote,
  Ban,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { cancelOrder, getBillingOrder, recordPayment } from "@/features/billing/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import {
  CANCELLATION_LIMITS,
  PAYMENT_METHOD_HINTS,
  PAYMENT_METHODS,
} from "@/types/billing";
import type { BillingOrder, Payment, PaymentMethod } from "@/types/billing";

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  Cash: Banknote,
  Card: CreditCard,
  Digital: Smartphone,
};

/**
 * Settling one order.
 *
 * The bill on the left at the prices it was ordered at, the amount and the action on
 * the right. Nothing on this screen edits anything: the lines are snapshots taken
 * when the order was placed, and the only write available is recording what was paid.
 */
export default function BillingOrderPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <BillingOrderDetail />
    </RequireAuth>
  );
}

function BillingOrderDetail() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const [reason, setReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getBillingOrder(orderId);
        if (!cancelled) {
          setOrder(loaded);
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
  }, [orderId, reloadKey]);

  const settle = useCallback(async () => {
    if (order === null || isSaving) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      // No amount is sent. The server takes it from the order it already stored.
      const result = await recordPayment(order.id, { method });

      setOrder(result.order);
      setReceipt(result.payment);
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not record the payment.",
      );
      // A refusal usually means the order moved, so show what it actually is now.
      setReloadKey((key) => key + 1);
    } finally {
      setIsSaving(false);
    }
  }, [order, method, isSaving]);

  const callOff = useCallback(async () => {
    if (order === null || isCancelling) {
      return;
    }

    setCancelError(null);
    setIsCancelling(true);

    try {
      const updated = await cancelOrder(order.id, { reason: reason.trim() });

      setOrder(updated);
      setIsCancelOpen(false);
      setReason("");
    } catch (caught) {
      setCancelError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not cancel this order.",
      );
    } finally {
      setIsCancelling(false);
    }
  }, [order, reason, isCancelling]);

  if (loadError !== null) {
    return (
      <>
        <PageHeader title="Billing" />
        <PageBody>
          <Surface>
            <ErrorState
              message={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
          <LinkButton href="/billing" variant="secondary" icon={<ArrowLeft />}>
            Back to billing
          </LinkButton>
        </PageBody>
      </>
    );
  }

  if (order === null) {
    return (
      <>
        <PageHeader title="Billing" />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </Surface>
        </PageBody>
      </>
    );
  }

  const isSettled = order.status === "Completed";
  const isCancelled = order.status === "Cancelled";
  const isClosed = isSettled || isCancelled;
  const waiting = order.unfinishedKitchenTicketCount;
  const started = order.startedKitchenTicketCount;
  const trimmedReason = reason.trim();
  const isReasonUsable =
    trimmedReason.length >= CANCELLATION_LIMITS.minReasonLength;

  return (
    <>
      <PageHeader
        title={`Table ${order.tableName}`}
        description={`Order #${order.orderNumber} · opened ${formatTime(order.createdAtUtc)} by ${order.placedByName}`}
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Billing", href: "/billing" },
          { label: `#${order.orderNumber}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              tone={isSettled ? "success" : isCancelled ? "danger" : "primary"}
              dot
            >
              {order.status}
            </Badge>
            <LinkButton href="/billing" variant="secondary" icon={<ArrowLeft />}>
              Billing
            </LinkButton>
          </div>
        }
      />

      <PageBody className="lg:max-w-none">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* The bill */}
          <div className="flex flex-col gap-4">
            <Surface>
              <SurfaceHeader
                title="The bill"
                description={`${order.itemCount} ${order.itemCount === 1 ? "item" : "items"} · table seats ${order.tableCapacity}`}
              />

              <ul className="divide-y divide-border">
                {order.items.map((item, position) => (
                  <li
                    key={`${order.id}-${position}`}
                    className="flex flex-col gap-1 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-base font-medium text-text">
                          <span className="tabular mr-1.5 text-sm font-semibold text-muted">
                            {item.quantity}
                            {"×"}
                          </span>
                          {item.itemName}
                        </span>
                        <span className="tabular text-2xs text-subtle">
                          {item.unitPrice.toFixed(2)} each
                          {item.kitchenTicketNumber !== null &&
                            ` · KOT #${item.kitchenTicketNumber}`}
                          {!item.isSubmittedToKitchen && " · never sent to the kitchen"}
                        </span>
                      </div>
                      <span className="tabular shrink-0 text-base font-semibold text-text">
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>

                    {item.note !== null && item.note.trim() !== "" && (
                      <p className="text-2xs text-muted">
                        <StickyNote
                          className="mr-1 inline size-3 align-[-1px]"
                          aria-hidden="true"
                        />
                        {item.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex items-baseline justify-between border-t border-border bg-surface-2 px-4 py-3">
                <span className="text-sm font-medium text-muted">Total</span>
                <span className="tabular text-2xl font-semibold text-text">
                  {order.subtotal.toFixed(2)}
                </span>
              </div>
            </Surface>

            {/* Kitchen state, which is the only thing gating closure. */}
            <Surface>
              <SurfaceHeader
                title="Kitchen"
                description={
                  order.kitchenTickets.length === 0
                    ? "Nothing was sent through"
                    : waiting === 0
                      ? "Everything is ready"
                      : `${waiting} ${waiting === 1 ? "ticket" : "tickets"} still cooking`
                }
                actions={
                  waiting === 0 ? (
                    <Badge tone="success" dot>
                      Clear
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      Cooking
                    </Badge>
                  )
                }
              />

              {order.kitchenTickets.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted">
                  No kitchen ticket was ever raised for this order, so there is
                  nothing to wait for.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {order.kitchenTickets.map((ticket) => (
                    <li
                      key={ticket.ticketNumber}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-sm text-text">
                        <ChefHat className="size-3.5 text-muted" aria-hidden="true" />
                        <span className="tabular font-semibold">
                          KOT #{ticket.ticketNumber}
                        </span>
                        <span className="text-2xs text-subtle">
                          {ticket.itemCount}{" "}
                          {ticket.itemCount === 1 ? "item" : "items"} ·{" "}
                          {formatTime(ticket.createdAtUtc)}
                        </span>
                      </span>
                      <Badge tone={ticket.status === "Ready" ? "success" : "warning"}>
                        {ticket.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </div>

          {/* Settlement */}
          <Surface className="lg:sticky lg:top-4">
            <SurfaceHeader
              title={isSettled ? "Paid" : isCancelled ? "Cancelled" : "Take payment"}
              description={
                isClosed
                  ? "This order is closed and the table is back in service"
                  : "Records how the bill was settled"
              }
            />

            {isCancelled ? (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3 py-2.5">
                  <Ban
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-medium text-text">
                      This order was cancelled
                    </p>
                    <p className="text-xs text-muted">
                      No payment was taken. The order and its kitchen tickets are kept
                      as a record of what happened.
                    </p>
                  </div>
                </div>

                {order.cancellation !== null && (
                  <>
                    <div className="rounded-md border border-border px-3 py-2.5">
                      <p className="text-2xs font-semibold tracking-wider text-subtle uppercase">
                        Reason
                      </p>
                      <p className="mt-1 text-sm text-text">
                        {order.cancellation.reason}
                      </p>
                    </div>

                    <dl className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                      <Line
                        label="Would have been"
                        value={order.subtotal.toFixed(2)}
                      />
                      <Line
                        label="Cancelled by"
                        value={order.cancellation.cancelledByName}
                      />
                      <Line
                        label="Cancelled"
                        value={formatDateTime(order.cancellation.cancelledAtUtc)}
                      />
                    </dl>
                  </>
                )}

                <LinkButton href="/billing" variant="secondary" className="w-full">
                  Back to billing
                </LinkButton>
              </div>
            ) : isSettled ? (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2.5 rounded-md border border-success-border bg-success-soft px-3 py-2.5">
                  <CircleCheck
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-medium text-text">
                      {receipt === null
                        ? "Payment recorded"
                        : "Payment recorded and order closed"}
                    </p>
                    <p className="text-xs text-muted">
                      The table has been released and is available again.
                    </p>
                  </div>
                </div>

                {order.payment !== null && (
                  <dl className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                    <Line label="Method" value={order.payment.method} />
                    <Line
                      label="Amount"
                      value={order.payment.amount.toFixed(2)}
                      strong
                    />
                    <Line label="Taken by" value={order.payment.recordedByName} />
                    <Line
                      label="Recorded"
                      value={formatDateTime(order.payment.recordedAtUtc)}
                    />
                  </dl>
                )}

                <LinkButton
                  href={`/billing/${order.id}/receipt`}
                  className="w-full"
                  icon={<Receipt />}
                >
                  View receipt
                </LinkButton>

                <LinkButton href="/billing" variant="secondary" className="w-full">
                  Back to billing
                </LinkButton>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-4">
                {saveError !== null && <FormError message={saveError} />}

                {/* When the action is unavailable, the reason is on screen next to
                    it rather than left to a disabled button to imply. */}
                {waiting > 0 && (
                  <div className="flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-soft px-3 py-2.5">
                    <Flame
                      className="mt-0.5 size-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-sm font-medium text-text">
                        The kitchen is not finished
                      </p>
                      <p className="text-xs text-muted">
                        {waiting === 1
                          ? "One ticket on this order has not reached the pass. It can be settled once the kitchen marks it ready."
                          : `${waiting} tickets on this order have not reached the pass. It can be settled once the kitchen marks them ready.`}
                      </p>
                    </div>
                  </div>
                )}

                {/*
                  This blocks the bill rather than merely noting it. Food the kitchen
                  was never asked to cook was never made and never served, so settling
                  for it would record revenue against nothing. The fix belongs to the
                  waiter, so the message says whose job it is.
                */}
                {order.unsubmittedItemCount > 0 && (
                  <div className="flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-soft px-3 py-2.5">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-warning">
                      {order.unsubmittedItemCount}{" "}
                      {order.unsubmittedItemCount === 1 ? "item has" : "items have"}{" "}
                      never been sent to the kitchen, so{" "}
                      {order.unsubmittedItemCount === 1 ? "it was" : "they were"} never
                      cooked. This bill cannot be settled until the waiter sends{" "}
                      {order.unsubmittedItemCount === 1 ? "it" : "them"} through.
                    </p>
                  </div>
                )}

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
                    How was it paid
                  </legend>
                  {PAYMENT_METHODS.map((option) => {
                    const Icon = METHOD_ICONS[option];
                    const isChosen = method === option;

                    return (
                      <label
                        key={option}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                          isChosen
                            ? "border-primary-border bg-primary-soft"
                            : "border-border hover:bg-surface-3",
                        )}
                      >
                        <input
                          type="radio"
                          name="method"
                          value={option}
                          checked={isChosen}
                          onChange={() => setMethod(option)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isChosen ? "text-primary" : "text-muted",
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium text-text">
                            {option}
                          </span>
                          <span className="text-2xs text-subtle">
                            {PAYMENT_METHOD_HINTS[option]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted">Amount due</span>
                  <span className="tabular text-xl font-semibold text-text">
                    {order.subtotal.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={() => void settle()}
                  disabled={!order.canComplete || isSaving}
                  className="h-11 w-full"
                >
                  {isSaving
                    ? "Recording…"
                    : waiting > 0
                      ? "Waiting on the kitchen"
                      : "Complete & record payment"}
                </Button>

                <p className="text-2xs text-subtle">
                  This records the amount and the method against the order, closes it,
                  and puts the table back in service. It does not contact a payment
                  provider, and the amount is taken from the order rather than typed
                  in.
                </p>

                {/* The other ending. Kept visually quiet and below the paid path,
                    because cancelling is the exception rather than the choice. */}
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {cancelError !== null && <FormError message={cancelError} />}

                  <Dialog
                    open={isCancelOpen}
                    onOpenChange={(next) => {
                      setIsCancelOpen(next);
                      setCancelError(null);
                      if (!next) {
                        setReason("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        disabled={!order.canCancel}
                        className="w-full text-danger"
                        icon={<Ban />}
                      >
                        Cancel this order
                      </Button>
                    </DialogTrigger>

                    <DialogContent
                      title={`Cancel order #${order.orderNumber}?`}
                      description="Nothing is deleted. The order and its kitchen tickets are kept, marked as cancelled."
                    >
                      <div className="flex flex-col gap-4 px-4 py-4">
                        {/* What this actually throws away, stated rather than
                            implied. Cooking already done is the real cost. */}
                        {started > 0 && (
                          <div className="flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-soft px-3 py-2.5">
                            <TriangleAlert
                              className="mt-0.5 size-4 shrink-0 text-warning"
                              aria-hidden="true"
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <p className="text-sm font-medium text-text">
                                The kitchen has already started
                              </p>
                              <p className="text-xs text-muted">
                                {started === 1
                                  ? "One ticket on this order has been picked up or cooked."
                                  : `${started} tickets on this order have been picked up or cooked.`}{" "}
                                Cancelling does not un-cook it, and no payment will be
                                taken.
                              </p>
                            </div>
                          </div>
                        )}

                        <dl className="flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                          <Line label="Table" value={order.tableName} />
                          <Line
                            label="Would have been"
                            value={order.subtotal.toFixed(2)}
                            strong
                          />
                        </dl>

                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="cancel-reason"
                            className="text-sm font-medium text-text"
                          >
                            Why is it being cancelled?
                          </label>
                          <Input
                            id="cancel-reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Guests left before ordering arrived"
                            maxLength={CANCELLATION_LIMITS.maxReasonLength}
                            autoFocus
                          />
                          <p className="text-2xs text-subtle">
                            Stored with the order permanently, so the restaurant can
                            answer later why this table paid nothing.
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="secondary">Keep the order</Button>
                        </DialogClose>
                        <Button
                          variant="danger"
                          onClick={() => void callOff()}
                          disabled={!isReasonUsable || isCancelling}
                        >
                          {isCancelling ? "Cancelling…" : "Cancel the order"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <p className="text-2xs text-subtle">
                    Cancelling closes the order without payment and releases the
                    table. It cannot be undone, and a paid order cannot be cancelled.
                  </p>
                </div>
              </div>
            )}
          </Surface>
        </div>
      </PageBody>
    </>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm text-text",
          strong ? "tabular text-base font-semibold" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
