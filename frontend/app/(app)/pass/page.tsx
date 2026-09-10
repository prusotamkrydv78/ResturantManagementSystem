"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, FormError, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  listPass,
  markTicketItemServed,
  markTicketServed,
} from "@/features/orders/api";
import { useRealtimeEvent, type TicketPayload } from "@/lib/realtime/realtime-context";
import { cn } from "@/lib/utils/cn";
import type { PassTicket } from "@/types/order";

/**
 * Food that is cooked and waiting for somebody to carry it.
 *
 * The floor's half of the kitchen rail, and the answer to a question this product could
 * not previously answer: a ticket used to reach Ready and sit there for the rest of the
 * evening, so nobody could tell whether the plate was still at the pass or had been
 * eaten an hour ago.
 *
 * It is also what makes the "your food is ready" alert survive a locked phone. The toast
 * is a courtesy; this is the record, so a waiter who missed it finds the same work here.
 *
 * Oldest first, which is the opposite of every other list in this product. Everywhere
 * else the newest thing is the most relevant; here the oldest plate is the one going
 * cold, and it belongs at the top.
 */
export default function PassPage() {
  return (
    // A manager as well as a waiter. Carrying a cooked plate raises no question about
    // who took the order, and a manager standing next to a pass full of food going
    // cold should be able to pick it up. RequireAuth only asks for a staff role of
    // somebody who has one, so a manager satisfies this without holding one.
    <RequireAuth roles={["Staff", "RestaurantManager"]} staffRoles={["Waiter"]}>
      <Pass />
    </RequireAuth>
  );
}

/**
 * How long a conflict notice stays up, in milliseconds.
 *
 * Long enough to read, short enough that it never outlives the thing it is about.
 * These messages explain a tap that did nothing because somebody else got there
 * first, and the list underneath corrects itself in the same second - so a banner
 * that stayed would be an alarm sitting over an accurate screen.
 */
const STALE_NOTICE_MS = 6000;

/** How often the queue refreshes itself, for when the live connection is not there. */
const REFRESH_MS = 20_000;

function Pass() {
  const [tickets, setTickets] = useState<PassTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serveError, setServeError] = useState<string | null>(null);
  // Keyed by whatever is mid-request - a ticket or a single dish - because a waiter
  // clearing three plates off one slip taps them in a row and locking the card after
  // the first would read as broken.
  const [serving, setServing] = useState<ReadonlySet<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  // Captured when the data arrived rather than read while rendering, because calling
  // the clock during render is impure and the ages below all measure from it.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listPass();

        if (!cancelled) {
          setTickets(loaded);
          setLoadedAt(Date.now());
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the pass.",
          );
        }
      }
    }

    void load();

    // Still polls. The socket is the thing most likely to be missing - a phone in a
    // pocket, a tunnel, a laptop that slept - and food at the pass is the last thing
    // that should depend on it.
    const timer = setInterval(reload, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reloadKey, reload]);

  // Live, when the connection is there. Both directions: something new to carry, and
  // something a colleague has already carried.
  useRealtimeEvent<TicketPayload>("ticketReady", reload);
  useRealtimeEvent<TicketPayload>("ticketServed", reload);
  // And when the kitchen takes something back. A recalled ticket is being cooked
  // again, so it has to leave this screen - otherwise a waiter walks to a pass to
  // fetch a plate that is back on the stove.
  //
  // Listening for the recall itself rather than for a start. A start is announced to
  // the kitchen alone, so this screen never heard it and only corrected on its next
  // poll twenty seconds later.
  useRealtimeEvent<TicketPayload>("ticketRecalled", reload);

  /** Marks a whole slip delivered, or one dish off it. */
  async function serve(ticket: PassTicket, itemId?: string) {
    const key = itemId ?? ticket.ticketId;

    if (serving.has(key)) {
      return;
    }

    setServeError(null);
    setServing((current) => new Set(current).add(key));

    try {
      const updated =
        itemId === undefined
          ? await markTicketServed(ticket.ticketId)
          : await markTicketItemServed(ticket.ticketId, itemId);

      // Applied here rather than waiting for the reload, so the tap feels immediate.
      // The refresh behind it is what makes it true.
      //
      // A slip with dishes still at the pass stays, carrying what is left - which is
      // the whole point of per-dish delivery: the momo card does not vanish because
      // the samosa went.
      setTickets((current) =>
        current === null
          ? null
          : current.flatMap((row) =>
              row.ticketId !== ticket.ticketId
                ? [row]
                : updated.items.length === 0
                  ? []
                  : [updated],
            ),
      );
      reload();
    } catch (caught) {
      setServeError(
        caught instanceof Error
          ? caught.message
          : "Could not mark that as delivered.",
      );
      reload();

      // Cleared on a timer, because the screen behind it fixes itself.
      //
      // The message explains a tap that did nothing - somebody else carried the plate,
      // or the kitchen pulled it back - and the list is corrected within the same
      // second. Leaving the banner up after that is a screen contradicting itself: an
      // alarm above an empty, accurate queue, with nothing left to act on.
      window.setTimeout(() => setServeError(null), STALE_NOTICE_MS);
    } finally {
      setServing((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  // Counted in plates rather than slips. A waiter looking at this wants to know how
  // many things they have to carry, and one slip can be three of them.
  const waiting = useMemo(
    () => tickets?.reduce((sum, row) => sum + row.items.length, 0) ?? 0,
    [tickets],
  );

  return (
    <>
      <PageHeader
        title="The pass"
        description="Food the kitchen has finished. Take it to the table, then tick it off."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Pass" }]}
        actions={
          waiting > 0 ? (
            <Badge tone="warning" dot>
              {waiting} {waiting === 1 ? "plate" : "plates"} waiting
            </Badge>
          ) : undefined
        }
      />

      <PageBody>
        {serveError !== null && <FormError message={serveError} />}

        {error !== null ? (
          <Surface>
            <ErrorState message={error} onRetry={reload} />
          </Surface>
        ) : tickets === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Surface key={row} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full" />
              </Surface>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<UtensilsCrossed />}
              title="Nothing at the pass"
              description="When the kitchen finishes a ticket it appears here, and your phone will let you know."
            />
          </Surface>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tickets.map((ticket, index) => {
              // The oldest plate is the one going cold, and it is first in the list.
              // Marked rather than merely positioned, because a waiter scanning a
              // screen of six cards should not have to work out the order.
              const isOldest = index === 0 && tickets.length > 1;

              return (
                <li key={ticket.ticketId}>
                  <Surface
                    className={cn(
                      "flex h-full flex-col",
                      isOldest && "border-warning-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 p-4 pb-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-lg font-semibold text-text">
                          {ticket.tableName}
                        </span>
                        <span className="tabular text-2xs text-subtle">
                          KOT #{ticket.ticketNumber} · order #{ticket.orderNumber}
                        </span>
                      </div>

                      <Badge tone={isOldest ? "warning" : "neutral"} dot={isOldest}>
                        {formatAge(ticket.readyAtUtc, loadedAt)}
                      </Badge>
                    </div>

                    {/* What is on the plate, so it can be checked before it is
                        carried. Short lists in full: a waiter about to walk to a
                        table wants to know it is all there. */}
                    {/* Each dish can go on its own. A table's momo and samosa are
                        cooked fifteen minutes apart and land on the same slip, so a
                        queue that could only be cleared whole made the floor wait for
                        the slower one before carrying either. */}
                    <ul className="flex flex-col gap-0.5 border-t border-border p-2">
                      {ticket.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => void serve(ticket, item.id)}
                            disabled={serving.has(item.id)}
                            aria-label={`${item.itemName} delivered to ${ticket.tableName}`}
                            // Thumb-sized, like everything else a walking waiter has
                            // to hit. This screen is a phone held in one hand while
                            // the other is carrying a plate.
                            className="pressable flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-success-soft"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border-strong text-transparent"
                            >
                              <Check className="size-3.5" />
                            </span>

                            <span className="min-w-0 flex-1 text-sm text-text">
                              <span className="tabular font-semibold text-muted">
                                {item.quantity}×
                              </span>{" "}
                              {item.itemName}
                              {item.note !== null && (
                                <span className="text-2xs text-warning">
                                  {" · "}
                                  {item.note}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto flex flex-col gap-2 border-t border-border bg-surface-2 p-4">
                      <Button
                        onClick={() => void serve(ticket)}
                        disabled={serving.has(ticket.ticketId)}
                        icon={<Check />}
                        className="h-11 w-full"
                      >
                        {serving.has(ticket.ticketId)
                          ? "Marking…"
                          : ticket.items.length === 1
                            ? `Delivered to ${ticket.tableName}`
                            : `All ${ticket.items.length} to ${ticket.tableName}`}
                      </Button>

                      <Link
                        href={`/orders/${ticket.orderId}`}
                        className="pressable flex min-h-11 items-center justify-center rounded-md text-2xs font-medium text-muted hover:bg-surface-3 hover:text-text"
                      >
                        Open order #{ticket.orderNumber}
                      </Link>
                    </div>
                  </Surface>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}

/** How long the plate has been sitting there, which is the whole urgency of this screen. */
function formatAge(isoString: string, since: number): string {
  const ready = new Date(isoString);

  if (Number.isNaN(ready.getTime())) {
    return "—";
  }

  const minutes = Math.max(0, Math.round((since - ready.getTime()) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m at the pass`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
