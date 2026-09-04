"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChefHat, ChevronDown, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, Spinner } from "@/components/ui/states";
import { useAuth } from "@/features/auth/auth-context";
import {
  getPublicTable,
  placePublicOrder,
  resolveScannedRestaurant,
} from "@/features/public/api";
import {
  OrderComposer,
  type OrderDraftLine,
} from "@/features/public/order-composer";
import { OrderSentOverlay } from "@/features/public/order-sent";
import { ApiError } from "@/lib/api/client";
import type { PublicTable } from "@/types/public-ordering";

/**
 * The order pad behind the code printed on a table.
 *
 * One printed code, two people, and this page is the fork.
 *
 * A member of staff who scans it is standing at the table with their own phone, so
 * they get the pad: the menu, whatever is already running on that table, and controls
 * big enough to hit while working one-handed in a busy room.
 *
 * Anybody else has no session, and rather than being refused they are sent to the
 * restaurant's own ordering page - the same menu, reached the way a customer at home
 * reaches it, where they are asked which table they are at. That redirect is why one
 * anonymous call survives on this route: the browser has to be told which restaurant
 * the code belongs to before it can send them anywhere.
 *
 * Choosing the food is `OrderComposer`, shared with the website. This page is only the
 * fork, the table's own running order, and what happens after the order is sent.
 */
export default function PublicOrderingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [table, setTable] = useState<PublicTable | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [justOrdered, setJustOrdered] = useState(false);
  // The order number the send came back with, held only for the moment the overlay
  // is up. The panel below reads the reloaded table for everything after that.
  const [sentNumber, setSentNumber] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Nothing is decided until the refresh cookie has been checked. Fetching before
    // then would send an anonymous request for a member of staff who is about to be
    // recognised, and redirect them away from their own order pad.
    if (isLoading) {
      return;
    }

    async function loadPad() {
      try {
        const loaded = await getPublicTable(token);

        if (!cancelled) {
          setTable(loaded);
          setFailed(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setTable(null);
          setFailed(
            caught instanceof ApiError
              ? caught.message
              : "We could not reach the restaurant. Check your connection and try again.",
          );
        }
      }
    }

    async function sendToWebsite() {
      try {
        const where = await resolveScannedRestaurant(token);

        if (!cancelled) {
          // Replaced rather than pushed, so the back button returns to whatever they
          // were doing before scanning rather than to a page that only bounces them
          // here again.
          // The table travels with them. Somebody who just scanned the code screwed
          // to table seven should not then be asked which table they are at - that
          // was the one thing the scan knew, and dropping it made the code no better
          // than the web address printed underneath it.
          router.replace(
            `/r/${where.slug}/order?table=${encodeURIComponent(where.tableId)}`,
          );
        }
      } catch {
        if (!cancelled) {
          setFailed(
            "This code does not belong to a restaurant we can find. Please ask a member of staff.",
          );
        }
      }
    }

    void (isAuthenticated ? loadPad() : sendToWebsite());

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey, isAuthenticated, isLoading, router]);

  const place = useCallback(
    async (items: OrderDraftLine[]) => {
      setPlaceError(null);
      setPlacing(true);

      try {
        const order = await placePublicOrder(token, { items });

        setSentNumber(order.orderNumber);
        setJustOrdered(true);
        setReloadKey((key) => key + 1);
      } catch (caught) {
        setPlaceError(
          caught instanceof ApiError
            ? caught.message
            : "We could not send the order. Please try again.",
        );

        // Rethrown so the composer keeps the basket open on a failure. Losing what
        // somebody just assembled because the network blinked is the worst thing this
        // page could do to them.
        throw caught;
      } finally {
        setPlacing(false);
      }
    },
    [token],
  );

  if (failed !== null) {
    return (
      <Centre>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="This link is not working"
            description={failed}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setFailed(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                Try again
              </Button>
            }
          />
        </Surface>
      </Centre>
    );
  }

  if (table === null) {
    return (
      <Centre>
        <div className="flex justify-center py-12">
          <Spinner
            label={
              isLoading || !isAuthenticated
                ? "Taking you to the menu…"
                : "Loading the menu…"
            }
          />
        </div>
      </Centre>
    );
  }

  return (
    <>
      {/* Over everything for a beat, then gone. The reload it triggered lands behind
          it, so the table's running order is already updated when it clears. */}
      {sentNumber !== null && (
        <OrderSentOverlay
          orderNumber={sentNumber}
          onDone={() => setSentNumber(null)}
        />
      )}

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-0.5 px-4 py-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {table.tableName}
          </p>
          <h1 className="text-2xl font-semibold text-text">
            {table.restaurantName}
          </h1>
        </div>
      </header>

      {/* Room at the bottom for the basket bar, which is fixed over the menu. */}
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 pb-28">
        {justOrdered && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-success-border bg-success-soft px-3 py-2.5 text-sm text-success"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Sent. It is on the table&apos;s order below.</span>
          </p>
        )}

        {/* Folded shut. What is already on the table matters, but it is context
            rather than the job: leaving it open pushed the menu - the reason anybody
            opened this page - off the first screen. The summary line carries the two
            facts worth glancing at, and the rest is one press away.

            A details element rather than state, because the browser already knows how
            to do this and does it accessibly. */}
        {table.currentOrder !== null && (
          <details className="group overflow-hidden rounded-lg border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-text">
                  On this table · #{table.currentOrder.orderNumber}
                </span>
                {table.currentOrder.awaitingKitchenCount > 0 ? (
                  <Badge tone="warning" dot>
                    {table.currentOrder.awaitingKitchenCount} not sent
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    <ChefHat className="size-3" aria-hidden="true" />
                    With the kitchen
                  </Badge>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-text tabular">
                  {table.currentOrder.subtotal.toFixed(2)}
                </span>
                <ChevronDown
                  className="size-4 text-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </span>
            </summary>

            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {table.currentOrder.lines.map((line, index) => (
                <li
                  key={`${line.itemName}-${index}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="tabular text-muted">{line.quantity}×</span>{" "}
                    <span className="text-text">{line.itemName}</span>
                    {line.note !== null && (
                      <span className="block text-xs text-muted">
                        {line.note}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular text-text">
                    {line.lineTotal.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <OrderComposer
          menu={table.menu}
          onPlace={place}
          placing={placing}
          error={placeError}
          disabledReason={
            table.canOrder
              ? undefined
              : (table.unavailableReason ??
                "Ordering is not available at this table right now.")
          }
        />
      </main>
    </>
  );
}

/** Centres a single panel, for the states that have nothing else on the page. */
function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12">
      {children}
    </main>
  );
}
