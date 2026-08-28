"use client";

import { useEffect, useMemo, useState } from "react";
import { ChefHat, CircleCheck, Flame, RefreshCw, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, FormError, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  listKitchenTickets,
  markKitchenTicketReady,
  startKitchenTicket,
} from "@/features/kitchen/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { KitchenItem, KitchenTicket } from "@/types/kitchen";

/** How often the rail refreshes itself, which also re-ages every label on it. */
const REFRESH_MS = 20_000;

/**
 * The kitchen rail.
 *
 * Built for a tablet propped up near the pass, not for a desk. The unit of the
 * screen is a ticket a chef can read at arm length and act on with one tap, so this
 * deliberately does not look like the manager areas: no tables, no filters, no
 * forms, and one obvious action per ticket.
 *
 * Two zones, in the order a kitchen thinks: what is on the stove, then what is
 * waiting. A ticket leaves the rail the moment it reaches the pass.
 */
export default function KitchenPage() {
  return (
    <RequireAuth roles={["Staff"]}>
      <Kitchen />
    </RequireAuth>
  );
}

function Kitchen() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listKitchenTickets();
        if (!cancelled) {
          setTickets(loaded);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load the kitchen.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // One timer for the whole screen. Refetching also re-renders every elapsed
  // label, so there is no second clock to keep in step and nothing stored in the
  // database counting anything.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  const preparing = useMemo(
    () => tickets?.filter((ticket) => ticket.status === "Preparing") ?? [],
    [tickets],
  );

  const pending = useMemo(
    () => tickets?.filter((ticket) => ticket.status === "Pending") ?? [],
    [tickets],
  );

  async function move(ticket: KitchenTicket, action: "start" | "ready") {
    // Guards a second tap on the same ticket. Other tickets stay live, because a
    // chef clearing three at once is normal.
    if (busyIds.has(ticket.id)) {
      return;
    }

    setActionError(null);
    setBusyIds((current) => new Set(current).add(ticket.id));

    try {
      const updated =
        action === "start"
          ? await startKitchenTicket(ticket.id)
          : await markKitchenTicketReady(ticket.id);

      // The response is the ticket as the server now has it, so the rail updates
      // from the truth rather than from a guess made before the call.
      setTickets((current) =>
        current === null
          ? null
          : updated.status === "Ready"
            ? current.filter((candidate) => candidate.id !== updated.id)
            : current.map((candidate) =>
                candidate.id === updated.id ? updated : candidate,
              ),
      );
    } catch (caught) {
      setActionError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not update that ticket.",
      );
      // A refusal almost always means someone else moved it, so the fastest fix is
      // to show the chef what is actually on the rail.
      setReloadKey((key) => key + 1);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(ticket.id);
        return next;
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Kitchen"
        description="Tickets sent through by the floor. Newest at the bottom of each group."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={preparing.length > 0 ? "warning" : "neutral"} dot>
              {preparing.length} on the stove
            </Badge>
            <Badge tone={pending.length > 0 ? "primary" : "neutral"} dot>
              {pending.length} waiting
            </Badge>
            <Button
              variant="secondary"
              onClick={() => setReloadKey((key) => key + 1)}
              icon={<RefreshCw />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <PageBody className="lg:max-w-none">
        {actionError !== null && <FormError message={actionError} />}

        {loadError !== null ? (
          <Surface>
            <ErrorState
              message={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : tickets === null ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((row) => (
              <Surface key={row} className="flex flex-col gap-3 p-5">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
              </Surface>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<ChefHat />}
              title="Nothing on the rail"
              description="Tickets appear here the moment a waiter sends them through."
            />
          </Surface>
        ) : (
          <div className="flex flex-col gap-8">
            {/* On the stove. Prominent because someone is already standing over it. */}
            {preparing.length > 0 && (
              <section className="flex flex-col gap-3">
                <ZoneHeading
                  icon={<Flame className="size-4" />}
                  title="On the stove"
                  count={preparing.length}
                  tone="warning"
                />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {preparing.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      isBusy={busyIds.has(ticket.id)}
                      onAct={() => void move(ticket, "ready")}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Waiting. Denser, because these are scanned rather than worked. */}
            <section className="flex flex-col gap-3">
              <ZoneHeading
                icon={<Timer className="size-4" />}
                title="Waiting"
                count={pending.length}
                tone="primary"
              />
              {pending.length === 0 ? (
                <Surface className="px-5 py-6">
                  <p className="text-center text-base text-muted">
                    Nothing waiting. Everything sent through has been picked up.
                  </p>
                </Surface>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pending.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      isBusy={busyIds.has(ticket.id)}
                      onAct={() => void move(ticket, "start")}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </>
  );
}

function ZoneHeading({
  icon,
  title,
  count,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone: "warning" | "primary";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border",
          tone === "warning"
            ? "border-warning-border bg-warning-soft text-warning"
            : "border-primary-border bg-primary-soft text-primary",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <span className="tabular text-sm text-muted">
        {count} {count === 1 ? "ticket" : "tickets"}
      </span>
    </div>
  );
}

/**
 * One ticket, whole.
 *
 * Everything a chef needs is on the face of it, so the workflow never requires
 * opening anything: the number to call out, where the food is going, how long it
 * has been sitting, what to cook, and the single next action.
 */
function TicketCard({
  ticket,
  isBusy,
  onAct,
}: {
  ticket: KitchenTicket;
  isBusy: boolean;
  onAct: () => void;
}) {
  const isPreparing = ticket.status === "Preparing";

  return (
    <Surface
      className={cn(
        "flex flex-col overflow-hidden border-l-4",
        isPreparing ? "border-l-warning" : "border-l-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col">
          <span className="tabular text-2xl leading-7 font-bold text-text">
            KOT #{ticket.ticketNumber}
          </span>
          <span className="mt-0.5 truncate text-base text-muted">
            {ticket.tableName}
            <span className="tabular text-sm text-subtle">
              {" · order #"}
              {ticket.orderNumber}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={isPreparing ? "warning" : "primary"} dot>
            {ticket.status}
          </Badge>
          <span className="tabular text-sm font-medium whitespace-nowrap text-muted">
            {elapsedSince(isPreparing ? ticket.startedAtUtc : ticket.createdAtUtc)}
          </span>
          <span className="text-2xs whitespace-nowrap text-subtle">
            {isPreparing ? "cooking" : "waiting"}
          </span>
        </div>
      </div>

      {/* The food. Set larger than anything else on the card, because this is the
          part being read from a step away. */}
      <ul className="flex flex-col gap-2 border-t border-border px-5 py-4">
        {ticket.items.map((item, position) => (
          <TicketLine key={`${ticket.id}-${position}`} item={item} />
        ))}
      </ul>

      <div className="mt-auto border-t border-border bg-surface-2 p-3">
        <Button
          onClick={onAct}
          disabled={isBusy}
          variant={isPreparing ? "primary" : "secondary"}
          className="h-12 w-full text-base"
          icon={isPreparing ? <CircleCheck /> : <Flame />}
        >
          {isBusy
            ? "Working…"
            : isPreparing
              ? "Mark ready"
              : "Start preparing"}
        </Button>
      </div>
    </Surface>
  );
}

function TicketLine({ item }: { item: KitchenItem }) {
  const note = item.note?.trim() ?? "";

  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2 text-lg leading-6 text-text">
        <span className="tabular shrink-0 font-bold">{item.quantity}×</span>
        <span className="font-medium">{item.itemName}</span>
      </span>

      {/* A note is the one thing on a ticket that ruins a plate if missed, so it
          gets its own line and its own colour rather than a parenthesis. */}
      {note !== "" && (
        <span className="ml-7 rounded-r border-l-2 border-warning bg-warning-soft px-2 py-1 text-base leading-5 text-text">
          {note}
        </span>
      )}
    </li>
  );
}

/**
 * How long ago something happened, in the words a kitchen uses.
 *
 * Derived on the client from the stored UTC instant. Nothing counts in the
 * database, and there is no per-ticket timer: the rail simply re-renders when it
 * refreshes.
 */
function elapsedSince(isoString: string | null): string {
  if (isoString === null) {
    return "—";
  }

  const started = new Date(isoString);

  if (Number.isNaN(started.getTime())) {
    return "—";
  }

  const minutes = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m ago`;
}
