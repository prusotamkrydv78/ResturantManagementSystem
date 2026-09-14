"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  CircleSlash,
  Plus,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardGrid, CardGridSkeleton } from "@/components/ui/card-grid";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, describedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Surface } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { listCustomers } from "@/features/customers/api";
import {
  cancelReservation,
  completeReservation,
  confirmReservation,
  createReservation,
  getReservationBoard,
  seatReservation,
  updateReservation,
} from "@/features/reservations/api";
import { listTables } from "@/features/tables/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { useNow } from "@/lib/time/since";
import { cn } from "@/lib/utils/cn";
import { RESERVATION_LIMITS } from "@/types/reservation";
import type { Reservation, ReservationBoard, ReservationStatus } from "@/types/reservation";
import type { Customer } from "@/types/customer";
import type { RestaurantTable } from "@/types/table";

/**
 * Tables held for people at times.
 *
 * Not a second view of the floor. A booking says a table is intended for somebody
 * later; whether it is busy right now is what the floor screen answers, and seating a
 * party here does not make a table occupied. The order a waiter opens does that, as it
 * always has.
 *
 * Which actions a booking allows comes from the server rather than being worked out
 * here, so a button that would be refused is never offered.
 */
export default function ReservationsPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <Reservations />
    </RequireAuth>
  );
}

function Reservations() {
  const [board, setBoard] = useState<ReservationBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [onDate, setOnDate] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [view, setView] = useState<BookingView>("All");
  const [reloadKey, setReloadKey] = useState(0);

  // A ticking clock, because the only thing that changes on this screen without
  // anybody touching it is the time. A booking does not become late when somebody
  // presses a button; it becomes late because a quarter of an hour went by, and a
  // board that only re-read itself on an action would keep saying a party was due in
  // five minutes an hour after they failed to turn up.
  const now = useNow();

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getReservationBoard({ onDate, includeClosed });

        if (!cancelled) {
          setBoard(loaded);
          setError(null);
          setNoRestaurant(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setNoRestaurant(isMissingRestaurant(caught));
          setError(
            isMissingRestaurant(caught)
              ? null
              : caught instanceof Error
                ? caught.message
                : "Unable to load the reservations.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [includeClosed, onDate, reloadKey]);

  // Every booking, tagged with where it stands against the clock. Worked out once
  // here rather than per card, so the strip at the top and the cards underneath can
  // never disagree about who is late.
  const tagged = (board?.reservations ?? []).map((reservation) => ({
    reservation,
    timing: timingOf(reservation, now),
  }));

  const shown = tagged.filter(({ reservation }) => inBookingView(reservation, view));
  const late = tagged.filter(({ timing }) => timing === "late").length;
  const dueSoon = tagged.filter(({ timing }) => timing === "due").length;
  const next = tagged.find(({ timing }) => timing === "due" || timing === "later");

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Who is coming and when. Seating a party records that they arrived; the order a waiter opens is what puts the table in use."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Reservations" },
        ]}
        actions={<ReservationDialog onSaved={refresh} />}
      />

      <PageBody>
        {noRestaurant ? (
          <NoRestaurantAssigned area="Reservations" />
        ) : (
          <>
{/* The clock first, then the day.

              A reservations board during service answers two questions in this order:
              is anybody standing at the door I have not dealt with, and who is next.
              The counts for the day are the context for those, not the other way
              round, and they used to be the only thing here. */}
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border lg:grid-cols-4">
              <div
                className={cn(
                  "flex flex-col gap-0.5 px-4 py-3",
                  late > 0
                    ? "bg-danger-soft text-danger"
                    : dueSoon > 0
                      ? "bg-warning-soft text-warning"
                      : "bg-primary-solid text-primary-fg",
                )}
              >
                <span className="text-2xs font-semibold tracking-wider uppercase opacity-80">
                  {late > 0 ? "Past their time" : dueSoon > 0 ? "Due soon" : "Next in"}
                </span>
                <span className="tabular text-xl leading-7 font-semibold">
                  {late > 0
                    ? late
                    : dueSoon > 0
                      ? dueSoon
                      : next === undefined
                        ? "—"
                        : formatTime(next.reservation.reservedForUtc)}
                </span>
                <span className="text-2xs opacity-80">
                  {late > 0
                    ? "not seated or cancelled"
                    : dueSoon > 0
                      ? "within the half hour"
                      : next === undefined
                        ? "nothing booked"
                        : next.reservation.customerName}
                </span>
              </div>

              <BoardStat label="Today" value={board?.todayCount} hint="Bookings" />
              <BoardStat
                label="Covers today"
                value={board?.todayGuestCount}
                hint="Guests expected"
              />
              <BoardStat label="Seated now" value={board?.seatedCount} hint="Parties in" />
            </div>

            <Surface>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* No visible label: the control sits beside the sentence that
                      explains it, and an empty label element would be announced as
                      one. The accessible name is on the input itself. */}
                  <Input
                    id="reservation-date"
                    type="date"
                    aria-label="Show a particular day"
                    className="sm:max-w-44"
                    value={onDate}
                    onChange={(event) => setOnDate(event.target.value)}
                  />
                  {onDate === "" ? (
                    <p className="text-sm text-muted">
                      Today and everything still to come.
                    </p>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setOnDate("")}>
                      Back to upcoming
                    </Button>
                  )}
                </div>

                <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border-strong"
                    checked={includeClosed}
                    onChange={(event) => setIncludeClosed(event.target.checked)}
                  />
                  Show finished and cancelled
                </label>
              </div>

              {/* Where a booking stands, as the thing you filter by. The checkbox above
                  decides what the server sends; these decide what you are looking at
                  within it, which is why choosing "Finished" also ticks the box rather
                  than showing an empty list and leaving you to work out why. */}
              <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
                {BOOKING_VIEWS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={view === option.value}
                    count={
                      tagged.filter(({ reservation }) =>
                        inBookingView(reservation, option.value),
                      ).length
                    }
                    tone={option.tone}
                    onClick={() => {
                      setView(option.value);

                      if (option.value === "Closed") {
                        setIncludeClosed(true);
                      }
                    }}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </div>

              {error !== null && <ErrorState message={error} onRetry={refresh} />}

              {board === null ? (
                <CardGridSkeleton count={10} />
              ) : shown.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock />}
                  title={onDate === "" ? "Nothing booked" : "Nothing on that day"}
                  description={
                    onDate === ""
                      ? "Take a booking and it appears here until the party has been and gone."
                      : "Try another day, or clear the date to see what is coming up."
                  }
                  action={onDate === "" ? <ReservationDialog onSaved={refresh} /> : undefined}
                />
              ) : (
                <CardGrid>
                  {shown.map(({ reservation, timing }) => (
                    <Card
                      key={reservation.id}
                      className={cn(
                        "p-3.5",
                        timing === "late"
                          ? "border-danger-border ring-1 ring-danger-border"
                          : timing === "due"
                            ? "border-warning-border"
                            : undefined,
                      )}
                    >
                      {/* The time leads. A booking is looked up by when it is, and
                          on a board sorted by time that is the thing the eye is
                          running down. */}
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              "tabular text-lg font-semibold",
                              timing === "late"
                                ? "text-danger"
                                : timing === "due"
                                  ? "text-warning"
                                  : "text-text",
                            )}
                          >
                            {formatTime(reservation.reservedForUtc)}
                          </span>
                          <span className="text-2xs text-muted">
                            {formatDay(reservation.reservedForUtc)}
                          </span>
                        </p>
                        <Badge tone={toneFor(reservation.status)} dot>
                          {reservation.status}
                        </Badge>
                      </div>

                      {/* Where this booking stands against the clock, in the words
                          somebody would use at the door. Only said when it is not the
                          obvious one - a booking three hours away needs no comment. */}
                      <p className="text-2xs text-subtle">
                        {timing === "late" ? (
                          <span className="font-medium text-danger">
                            {minutesBetween(reservation.reservedForUtc, now)} min past
                            their time
                          </span>
                        ) : timing === "due" ? (
                          <span className="font-medium text-warning">
                            due in {minutesBetween(now, reservation.reservedForUtc)} min
                          </span>
                        ) : (
                          <>until {formatTime(reservation.endsAtUtc)}</>
                        )}
                      </p>

                      <div className="mt-2.5 min-w-0">
                        <p className="truncate font-medium text-text">
                          {reservation.customerName}
                        </p>
                        {reservation.customerPhone !== null && (
                          <p className="truncate text-2xs text-muted">
                            {reservation.customerPhone}
                          </p>
                        )}
                      </div>

                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span className="tabular">
                          {reservation.guestCount}{" "}
                          {reservation.guestCount === 1 ? "guest" : "guests"}
                        </span>
                        <span aria-hidden="true" className="text-subtle">
                          ·
                        </span>
                        <span>{reservation.tableName ?? "Table not decided"}</span>
                      </p>

                      {/* The one thing on this card somebody has to act on before
                          service, so it is called out rather than left as a number
                          to compare against another number. */}
                      {reservation.tableCapacity !== null &&
                        reservation.guestCount > reservation.tableCapacity && (
                          <p className="mt-1.5 rounded-md border border-warning-border bg-warning-soft px-2 py-1 text-2xs text-warning">
                            That table seats {reservation.tableCapacity}
                          </p>
                        )}

                      {reservation.notes !== null && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted italic">
                          {reservation.notes}
                        </p>
                      )}

                      {reservation.cancellationReason !== null && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                          {reservation.cancellationReason}
                        </p>
                      )}

                      <div className="mt-auto flex justify-end pt-3.5">
                        <ReservationActions
                          reservation={reservation}
                          onChanged={refresh}
                        />
                      </div>
                    </Card>
                  ))}
                </CardGrid>
              )}
            </Surface>

            <p className="text-xs text-muted">
              Times are shown in this device timezone.
            </p>
          </>
        )}
      </PageBody>
    </>
  );
}

function toneFor(
  status: ReservationStatus,
): "primary" | "success" | "warning" | "neutral" {
  switch (status) {
    case "Seated":
      return "primary";
    case "Confirmed":
      return "success";
    case "Pending":
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

function formatDay(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Turns an instant into the value a datetime-local input wants, in the timezone of
 * whoever is looking.
 */
function toLocalInput(isoString: string): string {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}

function firstError(
  errors: Record<string, string[]>,
  field: string,
): string | undefined {
  return errors[field]?.[0];
}

/* -------------------------------------------------------------------------- */
/* Take and change a booking                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One dialog for taking and for changing a booking.
 *
 * The customer is chosen only when taking one. Moving a booking to a different person
 * is a different booking, and the history of the first one should not quietly change
 * hands.
 */
function ReservationDialog({
  reservation,
  onSaved,
  trigger,
}: {
  reservation?: Reservation;
  onSaved: () => void;
  trigger?: React.ReactNode;
}) {
  const isEdit = reservation !== undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [customerId, setCustomerId] = useState(reservation?.customerId ?? "");
  // Somebody new by default. Taking a booking almost always means a person who is not
  // on the books yet - a regular is the pleasant exception - and the old form put the
  // exception first, then sent the manager to another screen for everything else.
  const [isKnown, setIsKnown] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [when, setWhen] = useState(
    reservation === undefined ? "" : toLocalInput(reservation.reservedForUtc),
  );
  const [guests, setGuests] = useState(String(reservation?.guestCount ?? 2));
  const [duration, setDuration] = useState(
    String(reservation?.durationMinutes ?? RESERVATION_LIMITS.duration.default),
  );
  const [tableId, setTableId] = useState(reservation?.tableId ?? "");
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loaded when the dialog opens rather than with the page, so a board nobody is
  // booking from does not pull the whole customer list behind it.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [loadedCustomers, loadedTables] = await Promise.all([
          listCustomers(),
          listTables(),
        ]);

        if (!cancelled) {
          setCustomers(loadedCustomers);
          setTables(loadedTables.filter((table) => table.isActive));
        }
      } catch {
        if (!cancelled) {
          // The lists are how the form is filled in, so failing to load them is
          // reported in the form rather than left as two empty dropdowns.
          setError("Could not load your customers and tables. Close this and try again.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  function reset() {
    setCustomerId(reservation?.customerId ?? "");
    setIsKnown(false);
    setCustomerName("");
    setCustomerPhone("");
    setWhen(reservation === undefined ? "" : toLocalInput(reservation.reservedForUtc));
    setGuests(String(reservation?.guestCount ?? 2));
    setDuration(
      String(reservation?.durationMinutes ?? RESERVATION_LIMITS.duration.default),
    );
    setTableId(reservation?.tableId ?? "");
    setNotes(reservation?.notes ?? "");
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      reservedForUtc: new Date(when).toISOString(),
      guestCount: Number(guests),
      durationMinutes: Number(duration),
      tableId: tableId === "" ? null : tableId,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    try {
      if (isEdit) {
        await updateReservation(reservation.id, payload);
      } else {
        await createReservation(
          isKnown
            ? { ...payload, customerId }
            : {
                ...payload,
                customerName: customerName.trim(),
                customerPhone:
                  customerPhone.trim() === "" ? null : customerPhone.trim(),
              },
        );
      }

      setIsOpen(false);
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Unable to save this booking.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldId = (field: string) =>
    isEdit ? `reservation-${field}-${reservation.id}` : `reservation-${field}`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button icon={<Plus />}>Take a booking</Button>}
      </DialogTrigger>

      <DialogContent
        title={isEdit ? `Booking for ${reservation.customerName}` : "Take a booking"}
        description="A table is optional. Name one and it is held for the whole sitting, so nothing else can be booked onto it."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            {isEdit ? (
              <p className="text-sm text-muted">
                For{" "}
                <span className="font-medium text-text">
                  {reservation.customerName}
                </span>
                . Booking somebody else means taking a new booking.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Who it is for, asked the way it is asked on the telephone.

                    This used to be a dropdown of existing customers and nothing else,
                    with a hint telling the manager to go and create the person on
                    another screen first. Taking a booking is six steps and two screens
                    in that arrangement, while somebody waits on the line.

                    The server takes a name and a number and finds or creates the
                    record, so the list is what it should always have been: a shortcut
                    for regulars, not the toll gate. */}
                <div
                  role="group"
                  aria-label="Who the booking is for"
                  className="flex rounded-md border border-border p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setIsKnown(false)}
                    aria-pressed={!isKnown}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      isKnown ? "text-muted hover:text-text" : "bg-primary-soft text-primary",
                    )}
                  >
                    Someone new
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsKnown(true)}
                    aria-pressed={isKnown}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      isKnown ? "bg-primary-soft text-primary" : "text-muted hover:text-text",
                    )}
                  >
                    On the books
                  </button>
                </div>

                {isKnown ? (
                  <Field
                    htmlFor={fieldId("customer")}
                    label="Customer"
                    required
                    error={firstError(fieldErrors, "customerId")}
                  >
                    <Select
                      id={fieldId("customer")}
                      required
                      value={customerId}
                      onChange={setCustomerId}
                      options={[
                        {
                          value: "",
                          label: customers === null ? "Loading…" : "Choose a customer",
                        },
                        ...(customers ?? []).map((customer) => ({
                          value: customer.id,
                          label:
                            customer.phone === null
                              ? customer.name
                              : `${customer.name} · ${customer.phone}`,
                        })),
                      ]}
                    />
                  </Field>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      htmlFor={fieldId("customer-name")}
                      label="Name"
                      required
                      error={firstError(fieldErrors, "customerName")}
                    >
                      <Input
                        id={fieldId("customer-name")}
                        required
                        maxLength={120}
                        autoComplete="off"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                      />
                    </Field>

                    <Field
                      htmlFor={fieldId("customer-phone")}
                      label="Phone"
                      hint="Matches them to an existing record, so a regular stays one person."
                      error={firstError(fieldErrors, "customerPhone")}
                    >
                      <Input
                        id={fieldId("customer-phone")}
                        type="tel"
                        maxLength={32}
                        autoComplete="off"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        aria-describedby={describedBy(fieldId("customer-phone"), {
                          hasHint: true,
                        })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}

            <Field
              htmlFor={fieldId("when")}
              label="Expected"
              required
              hint="In this device timezone."
              error={firstError(fieldErrors, "reservedForUtc")}
            >
              <Input
                id={fieldId("when")}
                type="datetime-local"
                required
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                aria-describedby={describedBy(fieldId("when"), { hasHint: true })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                htmlFor={fieldId("guests")}
                label="Guests"
                required
                error={firstError(fieldErrors, "guestCount")}
              >
                <Input
                  id={fieldId("guests")}
                  type="number"
                  inputMode="numeric"
                  required
                  min={RESERVATION_LIMITS.guests.min}
                  max={RESERVATION_LIMITS.guests.max}
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                />
              </Field>

              <Field
                htmlFor={fieldId("duration")}
                label="Sitting (minutes)"
                hint="How long the table is held."
                error={firstError(fieldErrors, "durationMinutes")}
              >
                <Input
                  id={fieldId("duration")}
                  type="number"
                  inputMode="numeric"
                  min={RESERVATION_LIMITS.duration.min}
                  max={RESERVATION_LIMITS.duration.max}
                  step={15}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  aria-describedby={describedBy(fieldId("duration"), { hasHint: true })}
                />
              </Field>
            </div>

            <Field
              htmlFor={fieldId("table")}
              label="Table"
              hint="Leave unset to decide later."
              error={firstError(fieldErrors, "tableId")}
            >
              <Select
                id={fieldId("table")}
                value={tableId}
                onChange={setTableId}
                aria-describedby={describedBy(fieldId("table"), { hasHint: true })}
                options={[
                  { value: "", label: "Not decided" },
                  ...(tables ?? []).map((table) => ({
                    value: table.id,
                    label: `${table.name} · seats ${table.capacity}`,
                  })),
                ]}
              />
            </Field>

            <Field
              htmlFor={fieldId("notes")}
              label="Notes"
              hint="A window table, a birthday, anything the floor should know."
              error={firstError(fieldErrors, "notes")}
            >
              <Textarea
                id={fieldId("notes")}
                maxLength={RESERVATION_LIMITS.notes}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                aria-describedby={describedBy(fieldId("notes"), { hasHint: true })}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            {/* Guarded here rather than by the browser. The dropdown is no longer a
                native control, so a required attribute has nothing to block on. */}
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (isEdit
                  ? false
                  : isKnown
                    ? customerId === ""
                    : customerName.trim() === "")
              }
            >
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Take booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Lifecycle actions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * What can be done to this booking next.
 *
 * Every button is gated on a flag the server sent, not on a status read here. The
 * server refuses anything it did not offer, so the two cannot disagree about what step
 * comes next.
 */
function ReservationActions({
  reservation,
  onChanged,
}: {
  reservation: Reservation;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, work: () => Promise<unknown>) {
    setError(null);
    setBusy(action);

    try {
      await work();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error !== null && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {reservation.canConfirm && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Check />}
            disabled={busy !== null}
            onClick={() => void run("confirm", () => confirmReservation(reservation.id))}
          >
            {busy === "confirm" ? "Saving…" : "Confirm"}
          </Button>
        )}

        {reservation.canSeat && (
          <Button
            size="sm"
            icon={<UserCheck />}
            disabled={busy !== null}
            onClick={() => void run("seat", () => seatReservation(reservation.id))}
          >
            {busy === "seat" ? "Saving…" : "Seat"}
          </Button>
        )}

        {reservation.canComplete && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Users />}
            disabled={busy !== null}
            onClick={() =>
              void run("complete", () => completeReservation(reservation.id))
            }
          >
            {busy === "complete" ? "Saving…" : "Sitting over"}
          </Button>
        )}

        {reservation.isEditable && (
          <ReservationDialog
            reservation={reservation}
            onSaved={onChanged}
            trigger={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          />
        )}

        {reservation.canCancel && (
          <CancelReservationDialog reservation={reservation} onCancelled={onChanged} />
        )}
      </div>
    </div>
  );
}

/**
 * Calling a booking off.
 *
 * A reason is asked for but not required, unlike cancelling an order: a booking that
 * never happened costs nothing, and most of the time the honest reason is that the
 * guest changed their plans.
 */
function CancelReservationDialog({
  reservation,
  onCancelled,
}: {
  reservation: Reservation;
  onCancelled: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await cancelReservation(reservation.id, reason.trim() === "" ? null : reason.trim());
      setIsOpen(false);
      setReason("");
      onCancelled();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to cancel this booking.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          icon={<CircleSlash />}
          className="text-danger hover:bg-danger-soft hover:text-danger"
        >
          Cancel
        </Button>
      </DialogTrigger>

      <DialogContent
        title={`Cancel the booking for ${reservation.customerName}`}
        description="The table is freed for other bookings. The record is kept."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor={`cancel-reason-${reservation.id}`}
              label="Reason"
              hint="Optional. Useful when somebody asks later why the table was free."
            >
              <Textarea
                id={`cancel-reason-${reservation.id}`}
                maxLength={RESERVATION_LIMITS.notes}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby={describedBy(`cancel-reason-${reservation.id}`, {
                  hasHint: true,
                })}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Keep it</Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={isSubmitting}>
              {isSubmitting ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Where a booking stands                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How soon a booking is, relative to now.
 *
 * "late" is the one that matters and the one this board could not previously show: a
 * table held for seven o'clock, still Pending or Confirmed at twenty past, with nobody
 * seated and nobody having cancelled it. That is a party standing at a door or a table
 * being held for people who are not coming, and it looked exactly like a booking for
 * next Tuesday.
 */
type Timing = "late" | "due" | "later" | "settled";

/** Bookings that have been dealt with are out of the running, whatever the clock says. */
function timingOf(reservation: Reservation, now: number | null): Timing {
  if (
    now === null ||
    reservation.status === "Seated" ||
    reservation.status === "Completed" ||
    reservation.status === "Cancelled"
  ) {
    return "settled";
  }

  const minutes = minutesBetween(now, reservation.reservedForUtc);

  if (minutes < 0) {
    return "late";
  }

  return minutes <= DUE_WITHIN_MINUTES ? "due" : "later";
}

/**
 * How far ahead counts as "about to happen".
 *
 * Half an hour: long enough to lay a table and check the kitchen knows, short enough
 * that everything in the evening is not shouting at once.
 */
const DUE_WITHIN_MINUTES = 30;

/** Whole minutes from one instant to another. Negative when the second is in the past. */
function minutesBetween(
  from: number | string | null,
  to: number | string | null,
): number {
  if (from === null || to === null) {
    return 0;
  }

  const start = typeof from === "number" ? from : new Date(from).getTime();
  const end = typeof to === "number" ? to : new Date(to).getTime();

  return Number.isNaN(start) || Number.isNaN(end)
    ? 0
    : Math.round((end - start) / 60_000);
}

/** How a board is read: by what still needs doing. */
type BookingView = "All" | "Pending" | "Confirmed" | "Seated" | "Closed";

const BOOKING_VIEWS: {
  value: BookingView;
  label: string;
  tone: "neutral" | "warning" | "danger";
}[] = [
  { value: "All", label: "All", tone: "neutral" },
  { value: "Pending", label: "Not confirmed", tone: "warning" },
  { value: "Confirmed", label: "Confirmed", tone: "neutral" },
  { value: "Seated", label: "Seated", tone: "neutral" },
  { value: "Closed", label: "Finished or cancelled", tone: "neutral" },
];

function inBookingView(reservation: Reservation, view: BookingView): boolean {
  switch (view) {
    case "Pending":
      return reservation.status === "Pending";
    case "Confirmed":
      return reservation.status === "Confirmed";
    case "Seated":
      return reservation.status === "Seated";
    case "Closed":
      return reservation.status === "Completed" || reservation.status === "Cancelled";
    default:
      return true;
  }
}

/** One count in the strip along the top. */
function BoardStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | undefined;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-l border-border bg-surface px-4 py-3">
      <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
        {label}
      </span>
      <span className="tabular text-xl leading-7 font-semibold text-text">
        {value ?? "—"}
      </span>
      <span className="text-2xs text-muted">{hint}</span>
    </div>
  );
}
