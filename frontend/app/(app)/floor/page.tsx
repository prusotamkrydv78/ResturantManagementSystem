"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Armchair,
  ChefHat,
  CircleCheck,
  Flame,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useAuth } from "@/features/auth/auth-context";
import { getManagerFloor, getWaiterFloor } from "@/features/floor/api";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { cn } from "@/lib/utils/cn";
import type { FloorOverview, FloorTable } from "@/types/floor";

/**
 * How often the floor re-reads itself when nothing has been pushed.
 *
 * A backstop, not the mechanism. Every change this screen draws now arrives as an
 * event; this is what keeps the elapsed labels honest and what recovers a connection
 * that died quietly.
 */
const REFRESH_MS = 60_000;

/**
 * The live floor.
 *
 * One card per table, in the order the room is in, answering what is happening at
 * each one. Read only: occupancy is set by placing an order and cleared by settling
 * or cancelling it, and there is deliberately nothing here that sets it by hand.
 *
 * Shared by waiters and managers because they ask the same question of the same room.
 * What differs is what each does next, so only the actions on a card change: a waiter
 * seats guests and adds to orders, a manager takes money.
 */
export default function FloorPage() {
  return (
    <RequireAuth roles={["Staff", "RestaurantManager"]} staffRoles={["Waiter"]}>
      <FloorOverviewScreen />
    </RequireAuth>
  );
}

function FloorOverviewScreen() {
  const { user } = useAuth();
  const isManager = user?.platformRole === "RestaurantManager";

  const [floor, setFloor] = useState<FloorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<FloorView>("All");
  const [search, setSearch] = useState("");

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // The floor is the one screen two people watch at once, and it was the only
  // operational screen still finding out on a timer. A waiter seating a table and a
  // manager deciding whether to walk over should be looking at the same room, not at
  // the same room twenty seconds apart.
  //
  // Every event below already reaches this client - the kitchen rail and the pass
  // have been using them for a while - so this is a subscription, not new plumbing.
  useRealtimeEvent("orderPlaced", reload);
  useRealtimeEvent("orderConfirmed", reload);
  useRealtimeEvent("ticketQueued", reload);
  useRealtimeEvent("ticketStarted", reload);
  useRealtimeEvent("ticketReady", reload);
  useRealtimeEvent("ticketRecalled", reload);
  useRealtimeEvent("ticketServed", reload);
  useRealtimeEvent("billRequested", reload);
  // Settling and cancelling are deliberately absent: the notifier tells the customer
  // about those, not the operations hub, so subscribing here would register handlers
  // for names that never arrive. The timer below is what covers them.

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = isManager ? await getManagerFloor() : await getWaiterFloor();
        if (!cancelled) {
          setFloor(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the floor.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isManager, reloadKey]);

  // Every state this screen draws is now pushed, so the timer is no longer the
  // mechanism - it is what re-ages the elapsed labels, which no event would do, and
  // what covers a connection that dropped without anybody noticing. Slower than it
  // was, because it is no longer racing the service.
  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    const onFocus = () => reload();

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const term = search.trim().toLowerCase();
  const shown = (floor?.tables ?? []).filter(
    (table) =>
      inView(table, view) &&
      (term === "" || table.name.toLowerCase().includes(term)),
  );

  // Counted here rather than taken from the response: the overview carries occupancy
  // and availability but not reservations, and a strip showing three of its four
  // figures from the server and one from somewhere else is the more confusing option.
  const reservedCount = (floor?.tables ?? []).filter(
    (table) =>
      table.isActive && table.status === "Reserved" && table.openOrders.length === 0,
  ).length;

  const openOrderCount = (floor?.tables ?? []).reduce(
    (sum, table) => sum + table.openOrders.length,
    0,
  );

  return (
    <>
      <PageHeader
        title="Floor"
        description={
          isManager
            ? "Every table and what is happening at it. Occupancy follows the orders."
            : "Every table and what is happening at it. Tap a free table to seat guests."
        }
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Floor" }]}
        actions={
          <div className="flex items-center gap-2">
            {floor !== null && (
              <>
                <Badge tone={floor.availableCount > 0 ? "success" : "neutral"} dot>
                  {floor.availableCount} free
                </Badge>
                <Badge tone={floor.occupiedCount > 0 ? "primary" : "neutral"} dot>
                  {floor.occupiedCount} working
                </Badge>
              </>
            )}
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

      <PageBody>
        {error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        ) : floor === null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <Surface key={cell} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </Surface>
            ))}
          </div>
        ) : floor.totalCount === 0 ? (
          <Surface>
            <EmptyState
              icon={<Armchair />}
              title="No tables yet"
              description={
                isManager
                  ? "Add tables and they will appear here as soon as they are in service."
                  : "This restaurant has no tables set up yet. Your manager can add them."
              }
              action={
                isManager ? (
                  <LinkButton href="/settings/tables" variant="secondary">
                    Add tables
                  </LinkButton>
                ) : undefined
              }
            />
          </Surface>
        ) : (
          <>
            {/* The room in four figures, then the room itself.

                The first cell is filled rather than outlined because it is the only
                one that is money rather than furniture: three counts of tables and
                one count of what is running on them do not deserve equal weight. */}
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border lg:grid-cols-4">
              <div className="flex flex-col gap-1 bg-primary-solid px-4 py-3.5 text-primary-fg">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-semibold tracking-wider uppercase opacity-80">
                    On the floor
                  </span>
                  <ReceiptText className="size-4 opacity-80" aria-hidden="true" />
                </span>
                <span className="tabular text-2xl leading-8 font-semibold">
                  {floor.openValue.toFixed(2)}
                </span>
                <span className="text-2xs opacity-80">
                  {openOrderCount} {openOrderCount === 1 ? "order" : "orders"} open
                </span>
              </div>

              <FloorStat
                label="Occupied"
                value={floor.occupiedCount}
                tone="warning"
                className="border-l border-border"
              />
              <FloorStat
                label="Reserved"
                value={reservedCount}
                tone="primary"
                className="border-l border-border max-lg:border-t"
              />
              <FloorStat
                label="Available"
                value={floor.availableCount}
                tone="success"
                className="border-l border-border max-lg:border-t"
              />
            </div>

            {/* One row: which tables, and which of those. */}
            <Surface className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {FLOOR_VIEWS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={view === option.value}
                    count={
                      floor.tables.filter((table) => inView(table, option.value)).length
                    }
                    tone={option.tone}
                    onClick={() => setView(option.value)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>

              {/* Says when the screen last heard anything. Everything here arrives
                  as an event now, so the one failure a reader cannot see is a
                  connection that died quietly - and a clock that stopped moving is
                  what gives that away. */}
              <span className="text-2xs whitespace-nowrap text-subtle sm:ml-auto sm:mr-3">
                updated {formatTime(floor.generatedAtUtc)}
              </span>

              <div className="relative sm:w-56">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="floor-search"
                  type="search"
                  placeholder="Find a table"
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Find a table by name"
                />
              </div>
            </Surface>

            {shown.length === 0 ? (
              <Surface>
                <EmptyState
                  icon={<Armchair />}
                  title="Nothing in this view"
                  description="No table matches it right now."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setView("All");
                        setSearch("");
                      }}
                    >
                      Show every table
                    </Button>
                  }
                />
              </Surface>
            ) : (
              /* One card per table, all the same size.

                 An earlier pass gave working tables a big card and free ones a small
                 tile, on the reasoning that the work deserves the room. That is true
                 of a list and wrong of a floor plan: a room is read by scanning it,
                 and a grid whose cells change size is a grid nobody can scan. The
                 state is carried by the pill and the ring instead, which is how you
                 would read the actual room. */
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {shown.map((table) => (
                  <li key={table.id}>
                    <TableCard table={table} isManager={isManager} />
                  </li>
                ))}
              </ul>
            )}

          </>
        )}
      </PageBody>
    </>
  );
}

/**
 * One table with something on it.
 *
 * Redesigned around a simple observation: on a forty-cover floor most tables are free,
 * and the old grid gave a free table exactly as much room as a working one. Three
 * quarters of the screen was cards saying "Nothing running", and the two tables that
 * needed somebody were the same size as the thirty that did not.
 *
 * So the working tables get a card and the rest get a tile, below. This is the card.
 *
 * The whole thing is the link when there is one order on the table, which is the usual
 * case. It used to end in a full-width button inside a tinted footer, which made every
 * table look like a form waiting to be submitted rather than a table with people at it.
 */
/**
 * One table, drawn the way it sits in the room.
 *
 * Every card is the same size, and the state is carried by the pill, the ring and the
 * glyph rather than by how much space the card takes. That is deliberate: a floor is
 * read by scanning it, so the grid has to stay a grid.
 *
 * The whole card is the link when there is something to open. A free table has nowhere
 * to go for a manager - the API gates opening an order on the Waiter policy - so it
 * stays a plain card rather than a button that would be refused.
 */
function TableCard({ table, isManager }: { table: FloorTable; isManager: boolean }) {
  const working = table.openOrders.length > 0;
  const primary = table.openOrders[0];
  const phantom = isPhantom(table);
  const stranded = isStranded(table);
  const flagged = phantom || stranded || table.unsubmittedItemCount > 0;

  const href =
    working && primary !== undefined
      ? isManager
        ? `/billing/${primary.id}`
        : `/orders/${primary.id}`
      : !working && table.isActive && !isManager
        ? "/orders/new"
        : null;

  const body = (
    <>
      {/* The pill sits on its own line so the table can have the middle of the card
          to itself. Laying them side by side pinned the table to the top-left corner
          and left a hole under it, which on a grid of mostly-free tables is most of
          what you are looking at. */}
      <div className="flex justify-end">
        <StatusPill table={table} />
      </div>

      <div className="flex flex-1 items-center justify-center py-1">
        <TableGlyph name={table.name} capacity={table.capacity} state={stateOf(table)} />
      </div>

      <div className="flex flex-col gap-1.5">
        {/* Kitchen chips, only for what is actually there. They sit above the footer
            so the footer line stays in the same place on every card in the grid. */}
        {working && (
          <div className="flex flex-wrap gap-1">
            {table.preparingTicketCount > 0 && (
              <Chip tone="warning" icon={<Flame className="size-3" />}>
                {table.preparingTicketCount} cooking
              </Chip>
            )}
            {table.pendingTicketCount > 0 && (
              <Chip tone="primary" icon={<ChefHat className="size-3" />}>
                {table.pendingTicketCount} waiting
              </Chip>
            )}
            {table.readyTicketCount > 0 && (
              <Chip tone="success" icon={<CircleCheck className="size-3" />}>
                {table.readyTicketCount} ready
              </Chip>
            )}
            {table.unsubmittedItemCount > 0 && (
              <Chip tone="neutral" icon={<Plus className="size-3" />}>
                {table.unsubmittedItemCount} not sent
              </Chip>
            )}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2">
          <span className="flex min-w-0 items-baseline gap-1.5 text-2xs text-muted">
            <span>{sizeOf(table.capacity)}</span>
            <span className="text-subtle">·</span>
            <span className="whitespace-nowrap">
              {table.capacity} {table.capacity === 1 ? "person" : "people"}
            </span>
          </span>

          {working ? (
            <span className="tabular text-sm font-semibold text-primary">
              {table.openValue.toFixed(2)}
            </span>
          ) : (
            <span
              className={cn(
                "text-2xs",
                table.isActive ? "text-subtle" : "text-muted",
              )}
            >
              {table.isActive ? "Free" : "Off"}
            </span>
          )}
        </div>

        {/* How long they have been there, and whether that is a while. Not a fault:
            plenty of tables are meant to sit ninety minutes, which is why it colours
            a figure rather than raising a badge. */}
        {working && table.seatedSinceUtc !== null && (
          <span
            className={cn(
              "text-2xs",
              minutesSince(table.seatedSinceUtc) >= LONG_SEATED_MINUTES
                ? "text-warning"
                : "text-subtle",
            )}
          >
            {formatAge(table.seatedSinceUtc)}
            {table.openOrders.length > 1 && ` · ${table.openOrders.length} orders`}
          </span>
        )}

        {phantom && (
          <p className="flex items-start gap-1.5 text-2xs text-warning">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            Occupied with nothing open on it.
          </p>
        )}

        {stranded && (
          <p className="flex items-start gap-1.5 text-2xs text-danger">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            Out of service with guests still on it.
          </p>
        )}
      </div>
    </>
  );

  const shell = cn(
    "flex h-full min-h-[9.5rem] flex-col gap-3 rounded-lg border bg-surface p-3 transition-colors",
    !table.isActive && !stranded
      ? "border-border opacity-60"
      : flagged
        ? "border-warning-border ring-1 ring-warning-border"
        : table.canSettle
          ? "border-success-border ring-1 ring-success-border"
          : "border-border",
  );

  return href === null ? (
    <div className={shell}>{body}</div>
  ) : (
    <Link href={href} className={cn(shell, "hover:border-primary-border hover:bg-primary-soft/40")}>
      {body}
    </Link>
  );
}

/**
 * The table itself, seen from above.
 *
 * A plan view rather than an icon, because the thing being listed is furniture in a
 * room and a person scanning this screen is picturing the room. The seats drawn are
 * the seats the table has, up to a point - past ten the pips stop being countable and
 * start being texture, so the number beside them does the work instead.
 */
function TableGlyph({
  name,
  capacity,
  state,
}: {
  name: string;
  capacity: number;
  state: TableState;
}) {
  const seats = Math.min(Math.max(capacity, 1), 10);
  const perSide = Math.ceil(seats / 2);
  const top = Array.from({ length: perSide }, (_, index) => index);
  const bottom = Array.from({ length: seats - perSide }, (_, index) => index);

  return (
    <span className="flex flex-col items-center gap-1">
      <span className="flex gap-0.5">
        {top.map((seat) => (
          <span key={seat} className={cn("h-1 w-2.5 rounded-sm", SEAT_TONES[state])} />
        ))}
      </span>

      <span
        className={cn(
          "flex min-w-14 items-center justify-center rounded-md px-2 py-1.5 text-2xs font-semibold",
          TABLE_TONES[state],
        )}
      >
        {name}
      </span>

      <span className="flex gap-0.5">
        {bottom.map((seat) => (
          <span key={seat} className={cn("h-1 w-2.5 rounded-sm", SEAT_TONES[state])} />
        ))}
      </span>
    </span>
  );
}

/** What the glyph and the pill are colouring. */
type TableState = "working" | "reserved" | "free" | "off";

function stateOf(table: FloorTable): TableState {
  if (!table.isActive) {
    return "off";
  }

  if (table.openOrders.length > 0) {
    return "working";
  }

  return table.status === "Reserved" ? "reserved" : "free";
}

const SEAT_TONES: Record<TableState, string> = {
  working: "bg-warning-border",
  reserved: "bg-primary-border",
  free: "bg-success-border",
  off: "bg-border",
};

const TABLE_TONES: Record<TableState, string> = {
  working: "bg-warning-soft text-warning",
  reserved: "bg-primary-soft text-primary",
  free: "bg-success-soft text-success",
  off: "bg-surface-3 text-muted",
};

/** The state, in one word, in the corner where the reference puts it. */
function StatusPill({ table }: { table: FloorTable }) {
  if (!table.isActive) {
    return <Badge tone="neutral">Out of service</Badge>;
  }

  if (table.canSettle) {
    return (
      <Badge tone="success" dot>
        Ready
      </Badge>
    );
  }

  if (table.openOrders.length > 0) {
    return (
      <Badge tone="warning" dot>
        Occupied
      </Badge>
    );
  }

  return table.status === "Reserved" ? (
    <Badge tone="primary" dot>
      Reserved
    </Badge>
  ) : (
    <Badge tone="success">Available</Badge>
  );
}

/**
 * What a manager calls a table of this size.
 *
 * Presentational only, and named so: the product stores a seat count and nothing
 * else, so these three words are this screen's shorthand rather than a field anybody
 * set. The boundaries are the ones a restaurant actually lays up to - a two, a four
 * or six, and a big one.
 */
function sizeOf(capacity: number): string {
  if (capacity <= 2) {
    return "Small";
  }

  return capacity <= 6 ? "Medium" : "Large";
}

/** A clock time, to the minute. */
function formatTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** One count in the strip along the top. */
function FloorStat({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone: "warning" | "primary" | "success";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 bg-surface px-4 py-3.5", className)}>
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
      </span>
      <span
        className={cn(
          "tabular text-2xl leading-8 font-semibold",
          value === 0
            ? "text-muted"
            : tone === "warning"
              ? "text-warning"
              : tone === "primary"
                ? "text-primary"
                : "text-success",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatAge(isoString: string): string {
  const minutes = minutesSince(isoString);

  if (minutes < 0) {
    return "—";
  }

  if (minutes < 1) {
    return "just seated";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Minutes since an instant, or -1 when the server sent nothing parseable. */
function minutesSince(isoString: string): number {
  const then = new Date(isoString).getTime();

  return Number.isNaN(then)
    ? -1
    : Math.max(0, Math.round((Date.now() - then) / 60_000));
}

/**
 * When a table has been sitting long enough to be worth a second look.
 *
 * Ninety minutes: a leisurely dinner and a very late lunch. Not a fault, which is why
 * it colours the elapsed figure rather than raising a badge - plenty of tables are
 * meant to be there that long, and the ones that are not are obvious to whoever is
 * standing in the room.
 */
const LONG_SEATED_MINUTES = 90;

/** How a room is read during a service. */
type FloorView = "All" | "Working" | "Ready" | "Free" | "Attention";

const FLOOR_VIEWS: {
  value: FloorView;
  label: string;
  tone: "neutral" | "warning" | "danger";
}[] = [
  { value: "All", label: "All tables", tone: "neutral" },
  { value: "Working", label: "Working", tone: "neutral" },
  { value: "Ready", label: "Ready to settle", tone: "neutral" },
  { value: "Free", label: "Free", tone: "neutral" },
  { value: "Attention", label: "Needs attention", tone: "warning" },
];

/**
 * Whether a table belongs in a view.
 *
 * "Needs attention" is the only one that is not obvious, and it is deliberately three
 * different faults rather than a status: a table whose stored occupancy disagrees with
 * its orders, a table with items a waiter has not sent to the kitchen yet, and a table
 * taken out of service while somebody is still sitting at it. None of those show up in
 * a status badge, and all three are somebody walking over.
 */
function inView(table: FloorTable, view: FloorView): boolean {
  switch (view) {
    case "Working":
      return table.openOrders.length > 0;
    case "Ready":
      return table.canSettle;
    case "Free":
      return table.isActive && table.openOrders.length === 0;
    case "Attention":
      return isPhantom(table) || table.unsubmittedItemCount > 0 || isStranded(table);
    default:
      return true;
  }
}

/**
 * Occupied on the record, with nothing open on it.
 *
 * Both facts come from the server as they are stored, and nothing on this screen
 * writes either. When they disagree the floor says so rather than picking the one it
 * prefers, because the disagreement is the only symptom anybody gets.
 */
function isPhantom(table: FloorTable): boolean {
  return table.status === "Occupied" && table.openOrders.length === 0 && table.isActive;
}

/** Taken out of service with people still sitting at it. */
function isStranded(table: FloorTable): boolean {
  return !table.isActive && table.openOrders.length > 0;
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: "neutral" | "primary" | "success" | "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-surface-3 text-muted",
    primary: "border-primary-border bg-primary-soft text-primary",
    success: "border-success-border bg-success-soft text-success",
    warning: "border-warning-border bg-warning-soft text-warning",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}



