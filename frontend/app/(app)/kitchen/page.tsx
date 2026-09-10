"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChefHat,
  CircleCheck,
  Flame,
  HandPlatter,
  RefreshCw,
  Timer,
  TriangleAlert,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, ErrorState, FormError, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  listKitchenTickets,
  markKitchenItemReady,
  markKitchenTicketReady,
  recallKitchenItem,
  recallKitchenTicket,
  startKitchenTicket,
} from "@/features/kitchen/api";
import { ApiError } from "@/lib/api/client";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { cn } from "@/lib/utils/cn";
import type { KitchenItem, KitchenTicket } from "@/types/kitchen";

/**
 * How long a conflict notice stays up, in milliseconds.
 *
 * Long enough to read, short enough that it never outlives the thing it is about.
 * These messages explain a tap that did nothing because somebody else got there
 * first, and the list underneath corrects itself in the same second - so a banner
 * that stayed would be an alarm sitting over an accurate screen.
 */
const STALE_NOTICE_MS = 6000;

/** How often the rail refreshes itself, which also re-ages every label on it. */
const REFRESH_MS = 20_000;

/**
 * When a ticket stops being ordinary, in minutes.
 *
 * The rail had no notion of this at all: a ticket sitting half an hour looked exactly
 * like one that arrived a minute ago, apart from the words in its corner. Time to
 * plate is the whole job of a kitchen, and it was the one thing the screen would not
 * say out loud.
 *
 * Two thresholds rather than one, because they mean different things. The first is
 * "this needs picking up next"; the second is "somebody is going to complain". They
 * are counted from different moments too - a waiting ticket ages from when the floor
 * sent it, a cooking one from when the stove started - which is why the card decides
 * which clock to read before asking how late it is.
 *
 * Deliberately not configurable yet. A number a manager can set is a setting to
 * design, and nobody has told us what these should be for their kitchen; two honest
 * defaults that make lateness visible beat a settings page nobody has asked for.
 */
const LATE_AFTER_MINUTES = 12;
const VERY_LATE_AFTER_MINUTES = 20;

/**
 * How many tickets before the rail stops being comfortable and starts being dense.
 *
 * Not a preference. A card with a header, a row per dish and a full-width button is
 * about 260 pixels, so a kitchen tablet shows three or four - which is fine for a
 * quiet Tuesday and useless on a Friday, where the same screen becomes five screens
 * of scrolling done with wet hands. Past this many the cards shed everything that is
 * not the food and the timer.
 */
const DENSE_ABOVE = 8;

/**
 * How many tickets are worth putting on the screen at once.
 *
 * A kitchen works oldest first, so anything past this is not information a chef is
 * about to act on - it is a reason to scroll. The rest are counted rather than drawn,
 * and appear as work is cleared.
 */
const VISIBLE_LIMIT = 12;

/** The tab that means "everything", as opposed to one course. */
const ALL_COURSES = "__all__";

/** Where a dish with no course of its own is filed. */
const NO_COURSE = "Other";

/** How urgent a card is, which decides what it looks like. */
type Heat = "fine" | "late" | "critical";

function heatOf(minutes: number | null): Heat {
  if (minutes === null) {
    return "fine";
  }

  if (minutes >= VERY_LATE_AFTER_MINUTES) {
    return "critical";
  }

  return minutes >= LATE_AFTER_MINUTES ? "late" : "fine";
}

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
    // A manager as well as a chef. The rail is not a cooking tool, it is the record
    // of how late the food is, and the person answerable for the room could not open
    // it - the API refused them, so there was no way to look.
    <RequireAuth roles={["Staff", "RestaurantManager"]} staffRoles={["Chef"]}>
      <Kitchen />
    </RequireAuth>
  );
}

function Kitchen() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  /**
   * What is sitting at the pass, so the kitchen can see what it just sent.
   *
   * A ticket used to vanish off this screen the instant it was marked ready, which
   * left a chef with no confirmation that the tap had landed, no way to check what
   * went out, and no way back from tapping the wrong card. Fetched separately because
   * the rail's own query is live work only, and mixing finished tickets into it would
   * push real work off the screen.
   */
  const [atPass, setAtPass] = useState<KitchenTicket[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * When the data arrived, which is what every age on this screen is measured from.
   *
   * Captured rather than read while rendering. `Date.now()` in a render is impure, and
   * the pass screen already avoided exactly this - the rail was the one place still
   * calling the clock mid-render, which meant its labels were only as true as the last
   * thing that happened to cause a re-render.
   */
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * Which course this screen is working, or all of them.
   *
   * Filtered here rather than at the server. The rail holds live work for one
   * restaurant - tens of rows, already loaded - so a tab is instant and costs no
   * request, and a kitchen switching between the grill and the fryer mid-service
   * should not have to wait for either.
   */
  const [course, setCourse] = useState<string>(ALL_COURSES);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Both at once. The pass strip is a second query rather than a filter over
        // one, because the rail's default is deliberately live work only.
        const [loaded, ready] = await Promise.all([
          listKitchenTickets(),
          listKitchenTickets("Ready"),
        ]);

        if (!cancelled) {
          setTickets(loaded);
          setAtPass(ready);
          setLoadedAt(Date.now());
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
  //
  // Kept even though the rail is now live, and not as a belt-and-braces habit: the
  // ages on these cards are the point of this screen, and they have to keep counting
  // during the stretches when nothing happens and no event arrives.
  useEffect(() => {
    const timer = setInterval(() => setReloadKey((key) => key + 1), REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  // A new ticket should appear the moment a waiter sends it, not up to twenty seconds
  // later. Started too, so two chefs do not both reach for the same one.
  useRealtimeEvent("ticketQueued", reload);
  useRealtimeEvent("ticketStarted", reload);
  // A slip another chef pulled back off the pass belongs on this rail again.
  useRealtimeEvent("ticketRecalled", reload);
  // This one used to do nothing: the rail showed live work only, so a served ticket
  // was never on it to remove. It matters now that the pass strip exists - a plate a
  // waiter has carried has left the pass, and the strip has to stop showing it.
  useRealtimeEvent("ticketServed", reload);

  /**
   * Every course with work on the rail right now, and how much.
   *
   * Derived from the tickets rather than configured anywhere. A kitchen never has to
   * set its stations up: the tabs are whatever is actually cooking, they appear when
   * the first order of the night lands and disappear when it clears.
   */
  const courses = useMemo(() => {
    const counts = new Map<string, number>();

    for (const ticket of tickets ?? []) {
      for (const name of new Set(
        ticket.items.map((item) => item.course ?? NO_COURSE),
      )) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tickets]);

  /**
   * The rail as this screen is working it.
   *
   * Filtering hides the dishes as well as the tickets. A grill chef looking at a slip
   * of grill and cold work wants their two lines, not six with four struck out - and
   * the ticket only leaves the rail when every station has finished with it, which
   * the per-dish state already handles.
   */
  const working = useMemo(() => {
    if (course === ALL_COURSES) {
      return tickets ?? [];
    }

    return (tickets ?? [])
      .map((ticket) => ({
        ...ticket,
        items: ticket.items.filter(
          (item) => (item.course ?? NO_COURSE) === course,
        ),
      }))
      .filter((ticket) => ticket.items.length > 0);
  }, [tickets, course]);

  const preparing = useMemo(
    () => working.filter((ticket) => ticket.status === "Preparing"),
    [working],
  );

  const pending = useMemo(
    () => working.filter((ticket) => ticket.status === "Pending"),
    [working],
  );

  /**
   * Whether to draw the cards small.
   *
   * Decided by how much work there is, not by a switch somebody has to remember to
   * flip. The moment a service gets busy is the moment nobody has a spare hand for
   * a display setting.
   */
  const dense = preparing.length + pending.length > DENSE_ABOVE;

  /**
   * Which live slips belong to which table, in the order they sit on the rail.
   *
   * A table that orders three times leaves three tickets, and the rail showed them as
   * three strangers - separate cards, separate timers, nothing saying they were the
   * same table waiting for one meal. A chef plating the second one had no way to know
   * a third was coming, which is how half a table gets fed.
   *
   * Marked rather than regrouped. Sorting the rail by table would break the ordering
   * that matters more - oldest first, so the latest work is picked up next - so each
   * card says how many others there are and leaves them where urgency put them.
   */
  const slipsByTable = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const ticket of [...preparing, ...pending]) {
      groups.set(ticket.tableName, [
        ...(groups.get(ticket.tableName) ?? []),
        ticket.id,
      ]);
    }

    return groups;
  }, [preparing, pending]);

  /**
   * Everything still to cook, counted by dish rather than by ticket.
   *
   * Six tables ordering biryani was six cards, and the kitchen had to add them up in
   * its head to know whether to cook one pan or three. This is the answer to the
   * question a kitchen actually asks when it looks at a full rail - "how many of that
   * do I need" - and it costs nothing, because every ticket on the screen already
   * carries its own lines.
   *
   * Notes are counted separately from the plain version of the same dish. Two
   * biryanis, one of them without chilli, is not three of one thing - batching them
   * is exactly the mistake this is meant to prevent.
   */
  const toCook = useMemo(() => {
    const counts = new Map<string, { label: string; note: string; units: number }>();

    for (const ticket of [...preparing, ...pending]) {
      for (const item of ticket.items) {
        const note = item.note?.trim() ?? "";
        const key = `${item.itemName}\u0000${note}`;
        const seen = counts.get(key);

        counts.set(key, {
          label: item.itemName,
          note,
          units: (seen?.units ?? 0) + item.quantity,
        });
      }
    }

    return [...counts.values()].sort(
      (a, b) => b.units - a.units || a.label.localeCompare(b.label),
    );
  }, [preparing, pending]);

  async function move(ticket: KitchenTicket, action: "start" | "ready" | "recall") {
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
          : action === "ready"
            ? await markKitchenTicketReady(ticket.id)
            : await recallKitchenTicket(ticket.id);

      // The response is the ticket as the server now has it, so the rail updates
      // from the truth rather than from a guess made before the call.
      setTickets((current) =>
        current === null
          ? null
          : updated.status === "Ready"
            ? current.filter((candidate) => candidate.id !== updated.id)
            : current.some((candidate) => candidate.id === updated.id)
              ? current.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                )
              : // Recalled: it was not on the rail a moment ago and is now.
                [...current, updated],
      );

      // And the other side of the same move. Marking ready puts it at the pass;
      // recalling takes it off. Kept in step here so the strip does not wait for the
      // refetch behind this to catch up.
      setAtPass((current) =>
        updated.status === "Ready"
          ? [...current.filter((candidate) => candidate.id !== updated.id), updated]
          : current.filter((candidate) => candidate.id !== updated.id),
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

      // And the message goes once the rail has caught up with it. It describes a tap
      // that did nothing on a card that has already changed underneath.
      window.setTimeout(() => setActionError(null), STALE_NOTICE_MS);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(ticket.id);
        return next;
      });
    }
  }

  /**
   * Ticks one dish, or puts it back.
   *
   * Separate from `move` because the busy flag is per dish here rather than per
   * ticket: a chef clearing a slip taps three lines in a row, and locking the whole
   * card after the first would make the other two feel broken.
   */
  async function moveItem(
    ticket: KitchenTicket,
    item: KitchenItem,
    action: "ready" | "recall",
  ) {
    if (busyIds.has(item.id)) {
      return;
    }

    setActionError(null);
    setBusyIds((current) => new Set(current).add(item.id));

    try {
      const updated =
        action === "ready"
          ? await markKitchenItemReady(ticket.id, item.id)
          : await recallKitchenItem(ticket.id, item.id);

      // The whole ticket comes back, because ticking the last dish closes it - so the
      // card has to be replaced rather than patched, and it may have to move groups
      // or leave the rail entirely.
      setTickets((current) =>
        current === null
          ? null
          : updated.status === "Ready"
            ? current.filter((candidate) => candidate.id !== updated.id)
            : current.some((candidate) => candidate.id === updated.id)
              ? current.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                )
              : [...current, updated],
      );

      setAtPass((current) =>
        updated.status === "Ready"
          ? [...current.filter((candidate) => candidate.id !== updated.id), updated]
          : current.filter((candidate) => candidate.id !== updated.id),
      );
    } catch (caught) {
      setActionError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not update that dish.",
      );
      setReloadKey((key) => key + 1);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
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
            <Badge tone={atPass.length > 0 ? "success" : "neutral"} dot>
              {atPass.length} at the pass
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

      <PageBody>
        {actionError !== null && <FormError message={actionError} />}

        {/* Which part of the kitchen this screen is. Only shown when the menu is
            actually divided - a place with one course has nothing to choose between,
            and a row of one tab is furniture.

            Never configured. The tabs are whatever is cooking right now, so a kitchen
            with two people can put one screen on Main Course and another on Breads
            and Rice without anybody setting a station up. */}
        {courses.length > 1 && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            <CourseTab
              label="Everything"
              count={tickets?.length ?? 0}
              active={course === ALL_COURSES}
              onPick={() => setCourse(ALL_COURSES)}
            />
            {courses.map(([name, count]) => (
              <CourseTab
                key={name}
                label={name}
                count={count}
                active={course === name}
                onPick={() => setCourse(name)}
              />
            ))}
          </div>
        )}

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
        ) : working.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<ChefHat />}
              title={
                course === ALL_COURSES
                  ? "Nothing on the rail"
                  : `Nothing for ${course}`
              }
              description={
                course === ALL_COURSES
                  ? "Tickets appear here the moment a waiter sends them through."
                  : "Other courses have work. Switch to Everything to see the whole rail."
              }
              action={
                course === ALL_COURSES ? undefined : (
                  <Button
                    variant="secondary"
                    onClick={() => setCourse(ALL_COURSES)}
                  >
                    Show everything
                  </Button>
                )
              }
            />
          </Surface>
        ) : (
          <div className="flex flex-col gap-8">
            {/* What to cook, added up. Above the tickets, because deciding how much to
                put in the pan comes before working out which card it belongs to. */}
            {/* Only when there is actually something to batch.

                It used to appear whenever the rail held more than one distinct dish,
                which on a rail of four different single dishes made it a smaller,
                duller copy of the cards underneath it. A count of one tells a chef
                nothing they cannot see; a count of three is the whole reason to look. */}
            {toCook.some((row) => row.units > 1) && (
              <Surface className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-3 text-muted"
                  >
                    <UtensilsCrossed className="size-4" />
                  </span>
                  <h2 className="text-lg font-semibold text-text">Still to cook</h2>
                  <span className="tabular text-sm text-muted">
                    across {preparing.length + pending.length}{" "}
                    {preparing.length + pending.length === 1 ? "ticket" : "tickets"}
                  </span>
                </div>

                <ul className="flex flex-wrap gap-2">
                  {toCook.map((row) => (
                    <li
                      key={`${row.label}-${row.note}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2"
                    >
                      <span className="tabular text-lg leading-5 font-bold text-text">
                        {row.units}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-base leading-5 font-medium text-text">
                          {row.label}
                        </span>
                        {row.note !== "" && (
                          <span className="text-2xs text-warning">{row.note}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}

            {/* On the stove. Prominent because someone is already standing over it. */}
            {preparing.length > 0 && (
              <section className="flex flex-col gap-3">
                <ZoneHeading
                  icon={<Flame className="size-4" />}
                  title="On the stove"
                  count={preparing.length}
                  tone="warning"
                />
                <div
                  className={cn(
                    "grid grid-cols-1 gap-3",
                    dense
                      ? "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                      : "xl:grid-cols-2",
                  )}
                >
                  {preparing.slice(0, VISIBLE_LIMIT).map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={loadedAt}
                      slips={slipsByTable.get(ticket.tableName)}
                      dense={dense}
                      isBusy={busyIds.has(ticket.id)}
                      busyIds={busyIds}
                      onAct={() => void move(ticket, "ready")}
                      onItem={(item, action) => void moveItem(ticket, item, action)}
                    />
                  ))}
                </div>
                <MoreBehind count={preparing.length - VISIBLE_LIMIT} />
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
                <div
                  className={cn(
                    "grid grid-cols-1 gap-3",
                    dense
                      ? "md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                      : "md:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  {pending.slice(0, VISIBLE_LIMIT).map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      now={loadedAt}
                      slips={slipsByTable.get(ticket.tableName)}
                      dense={dense}
                      isBusy={busyIds.has(ticket.id)}
                      busyIds={busyIds}
                      onAct={() => void move(ticket, "start")}
                      onItem={(item, action) => void moveItem(ticket, item, action)}
                    />
                  ))}
                </div>
              )}
              <MoreBehind count={pending.length - VISIBLE_LIMIT} />
            </section>

            {/* What has gone out and not yet been carried.

                The confirmation the rail never gave: a ticket marked ready used to
                disappear in the same instant, so a chef had no evidence the tap had
                landed and no way back from tapping the wrong card. Small and last,
                because it is finished work - but it holds the only undo on this
                screen. */}
            {atPass.length > 0 && (
              <section className="flex flex-col gap-3">
                <ZoneHeading
                  icon={<HandPlatter className="size-4" />}
                  title="At the pass"
                  count={atPass.length}
                  tone="success"
                />
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {atPass.map((ticket) => (
                    <li key={ticket.id}>
                      <Surface className="flex h-full items-center gap-3 border-l-4 border-l-success px-3 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="tabular text-base font-semibold text-text">
                            KOT #{ticket.ticketNumber}
                          </span>
                          <span className="truncate text-2xs text-muted">
                            {ticket.tableName} ·{" "}
                            {elapsedSince(ticket.readyAtUtc, loadedAt)}
                          </span>
                        </span>

                        <Button
                          variant="secondary"
                          className="min-h-11"
                          disabled={busyIds.has(ticket.id)}
                          onClick={() => void move(ticket, "recall")}
                          icon={<Undo2 />}
                        >
                          {busyIds.has(ticket.id) ? "…" : "Recall"}
                        </Button>
                      </Surface>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}

/**
 * One course, as a tab.
 *
 * The count is the point of it. A chef deciding whether to work the grill or the
 * fryer next wants to know which has piled up, and reading that off two lists means
 * changing screens to find out.
 */
function CourseTab({
  label,
  count,
  active,
  onPick,
}: {
  label: string;
  count: number;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "pressable flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border-strong text-muted hover:bg-surface-3 hover:text-text",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular rounded-full px-1.5 text-2xs font-semibold",
          active ? "bg-primary-solid text-primary-fg" : "bg-surface-3 text-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * What did not fit on the screen.
 *
 * Counted rather than drawn. A kitchen works oldest first, so anything past the cap
 * is not work anybody is about to touch - it is a reason to scroll a tablet with wet
 * hands. Saying how much is behind is honest and costs one line.
 */
function MoreBehind({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <p className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-center text-sm text-muted">
      <span className="tabular font-semibold text-text">{count}</span> more{" "}
      {count === 1 ? "ticket" : "tickets"} behind these. They appear as work is
      cleared.
    </p>
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
  tone: "warning" | "primary" | "success";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border",
          tone === "warning" && "border-warning-border bg-warning-soft text-warning",
          tone === "primary" && "border-primary-border bg-primary-soft text-primary",
          tone === "success" && "border-success-border bg-success-soft text-success",
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
  now,
  slips,
  dense = false,
  isBusy,
  busyIds,
  onAct,
  onItem,
}: {
  ticket: KitchenTicket;
  /** When the data arrived. Passed in so the card never reads the clock itself. */
  now: number;
  /** Every live slip for this table, in rail order, so a card can place itself. */
  slips?: readonly string[];
  /**
   * Whether the rail is busy enough to shed everything but the food and the clock.
   *
   * Passed in rather than decided here, because it is a property of how much work
   * there is rather than of any one ticket - and a rail where some cards were small
   * and others large would be harder to read than either.
   */
  dense?: boolean;
  isBusy: boolean;
  /** Which dishes are mid-request, so each line can lock on its own. */
  busyIds: ReadonlySet<string>;
  onAct: () => void;
  onItem: (item: KitchenItem, action: "ready" | "recall") => void;
}) {
  const isPreparing = ticket.status === "Preparing";

  // A waiting ticket ages from when the floor sent it, a cooking one from when the
  // stove started. Reading the wrong clock would make everything on the stove look
  // ancient the moment it was picked up.
  const since = isPreparing ? ticket.startedAtUtc : ticket.createdAtUtc;
  const minutes = minutesSince(since, now);
  const heat = heatOf(minutes);

  // Only worth saying when there is more than one. On a table with a single slip this
  // would be a label reading "1 of 1", which is noise dressed as information.
  const position =
    slips === undefined || slips.length < 2
      ? null
      : { at: slips.indexOf(ticket.id) + 1, of: slips.length };

  return (
    <Surface
      className={cn(
        "flex flex-col overflow-hidden border-l-4",
        // Lateness wins the colour over status. A chef scanning a full rail needs the
        // late ones to be findable without reading a single label, and which stage a
        // ticket is at is already said by which group it is standing in.
        heat === "critical"
          ? "border-l-danger bg-danger-soft/20"
          : heat === "late"
            ? "border-l-warning bg-warning-soft/20"
            : isPreparing
              ? "border-l-warning"
              : "border-l-primary",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          dense ? "px-3 pt-2.5 pb-2" : "px-5 pt-4 pb-3",
        )}
      >
        <div className="flex min-w-0 flex-col">
          {/* The table leads when the rail is busy, not the slip number.

              A chef at volume is matching food to a place in the room; the KOT number
              is for calling out and for talking to a waiter, which is the quieter job
              of the two. Reversed rather than hidden, so nothing is lost. */}
          {dense ? (
            <>
              <span className="truncate text-lg leading-6 font-bold text-text">
                {ticket.tableName}
              </span>
              <span className="tabular text-2xs text-subtle">
                KOT #{ticket.ticketNumber}
              </span>
            </>
          ) : (
            <>
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
            </>
          )}

          {/* This table is waiting on more than this slip. Said on the card rather
              than by regrouping the rail, so the oldest work stays at the top where a
              kitchen looks for it. */}
          {position !== null && (
            <span
              className={cn(
                "self-start rounded-full border border-warning-border bg-warning-soft font-medium text-warning",
                dense
                  ? "mt-0.5 px-1.5 text-2xs"
                  : "mt-1 px-2 py-0.5 text-2xs",
              )}
            >
              {dense
                ? `${position.at}/${position.of} slips`
                : `Slip ${position.at} of ${position.of} for this table`}
            </span>
          )}

          {/* How far through the slip the kitchen is. The state a busy kitchen is
              actually in most of the time, and the screen had no way to say it. */}
          {ticket.readyItemCount > 0 && (
            <span
              className={cn(
                "tabular mt-1 font-medium text-success",
                dense ? "text-2xs" : "text-sm",
              )}
            >
              {ticket.readyItemCount} of {ticket.items.length} done
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* The clock is the badge now. It used to be the status - which a chef can
              already see from the group the card is standing in - while the one number
              that decides what to pick up next was grey text underneath it. */}
          <Badge
            tone={
              heat === "critical"
                ? "danger"
                : heat === "late"
                  ? "warning"
                  : "neutral"
            }
            dot={heat !== "fine"}
          >
            {elapsedSince(since, now)}
          </Badge>

          <span
            className={cn(
              "flex items-center gap-1 text-2xs whitespace-nowrap",
              heat === "critical" ? "font-medium text-danger" : "text-subtle",
            )}
          >
            {heat === "critical" && (
              <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
            )}
            {isPreparing ? "cooking" : "waiting"}
          </span>
        </div>
      </div>

      {/* The food. Set larger than anything else on the card, because this is the
          part being read from a step away. */}
      <ul
        className={cn(
          "flex flex-col border-t border-border",
          dense ? "gap-0.5 px-2 py-2" : "gap-1 px-3 py-3",
        )}
      >
        {ticket.items.map((item) => (
          <TicketLine
            key={item.id}
            item={item}
            dense={dense}
            isBusy={busyIds.has(item.id)}
            onTick={() => onItem(item, item.readyAtUtc === null ? "ready" : "recall")}
          />
        ))}
      </ul>

      <div
        className={cn(
          "mt-auto border-t border-border bg-surface-2",
          dense ? "p-2" : "p-3",
        )}
      >
        <Button
          onClick={onAct}
          disabled={isBusy}
          variant={isPreparing ? "primary" : "secondary"}
          className={cn("w-full", dense ? "h-11 text-sm" : "h-12 text-base")}
          icon={isPreparing ? <CircleCheck /> : <Flame />}
        >
          {isBusy
            ? "Working…"
            : !isPreparing
              ? "Start preparing"
              : ticket.readyItemCount === 0
                ? "Mark all ready"
                : `Mark the last ${ticket.items.length - ticket.readyItemCount} ready`}
        </Button>
      </div>
    </Surface>
  );
}

/**
 * One dish, and the tap that says it is cooked.
 *
 * The whole line is the target rather than a small checkbox beside it, because this is
 * pressed with a thumb by somebody holding a knife in the other hand.
 *
 * A cooked dish stays on the card, struck through, instead of disappearing. A chef
 * halfway through a slip needs to see what is done as much as what is left - and it is
 * the only way back from ticking the wrong line.
 */
function TicketLine({
  item,
  dense = false,
  isBusy,
  onTick,
}: {
  item: KitchenItem;
  /** Tighter, for a rail with too much on it to read comfortably. */
  dense?: boolean;
  isBusy: boolean;
  onTick: () => void;
}) {
  const note = item.note?.trim() ?? "";
  const isReady = item.readyAtUtc !== null;
  const isGone = item.servedAtUtc !== null;

  return (
    <li>
      <button
        type="button"
        onClick={onTick}
        disabled={isBusy || isGone}
        aria-pressed={isReady}
        aria-label={
          isGone
            ? `${item.itemName} has been taken to the table`
            : isReady
              ? `Put ${item.itemName} back on the stove`
              : `${item.itemName} is cooked`
        }
        className={cn(
          // min-h-11 whatever else changes. This is the most-pressed control in the
          // product and the screen is a tablet propped on a shelf, so it has to stay a
          // thumb wide - dense may take the padding and the type down, but not the
          // target. Shrinking it was the exact wrong move: the busiest rail is the one
          // where a missed tap costs the most.
          "pressable flex min-h-11 w-full items-center rounded-md text-left transition-colors",
          dense ? "gap-2 px-1.5 py-1" : "gap-3 px-2 py-2",
          isGone
            ? "cursor-default opacity-60"
            : isReady
              ? "bg-success-soft/40 hover:bg-success-soft"
              : "hover:bg-surface-3",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-md border",
            dense ? "size-5" : "size-6",
            isReady
              ? "border-success bg-success text-inverse"
              : "border-border-strong",
          )}
        >
          {isReady && <CircleCheck className={dense ? "size-3.5" : "size-4"} />}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "flex items-baseline gap-2",
              // Still the largest thing on the card even when dense. This is what is
              // read from a step away with a pan in one hand; everything else on the
              // card gave up space first precisely so this would not have to.
              dense ? "text-base leading-5" : "text-lg leading-6",
              isReady ? "text-muted line-through" : "text-text",
            )}
          >
            <span className="tabular shrink-0 font-bold">{item.quantity}×</span>
            <span className="font-medium">{item.itemName}</span>
          </span>

          {/* A note is the one thing on a ticket that ruins a plate if missed, so it
              gets its own line and its own colour rather than a parenthesis. */}
          {note !== "" && (
            <span
              className={cn(
                "rounded-r border-l-2 border-warning bg-warning-soft text-text",
                // A note never shrinks below readable. It is the one thing on a slip
                // that ruins a plate if it is missed.
                dense ? "px-1.5 py-0.5 text-sm leading-4" : "px-2 py-1 text-base leading-5",
                isReady && "opacity-60",
              )}
            >
              {note}
            </span>
          )}

          {isGone && (
            <span className="text-2xs font-medium text-muted">
              taken to the table
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * How many minutes ago something happened, or null when there is no time to read.
 *
 * Takes the moment to measure from rather than calling the clock. It used to read
 * `Date.now()` mid-render, which is impure and meant a label was only ever as true as
 * whatever last caused a re-render; the pass screen had already been fixed this way
 * and the rail was the one place left doing it.
 */
function minutesSince(isoString: string | null, now: number): number | null {
  if (isoString === null) {
    return null;
  }

  const started = new Date(isoString);

  if (Number.isNaN(started.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((now - started.getTime()) / 60000));
}

/** How long ago something happened, in the words a kitchen uses. */
function elapsedSince(isoString: string | null, now: number): string {
  const minutes = minutesSince(isoString, now);

  if (minutes === null) {
    return "—";
  }

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
