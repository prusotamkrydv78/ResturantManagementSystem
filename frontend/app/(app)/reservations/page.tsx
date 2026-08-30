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
import { Button } from "@/components/ui/button";
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
  TableSkeleton,
} from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
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
  const [reloadKey, setReloadKey] = useState(0);

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Today" value={board?.todayCount} hint="Bookings for today" />
              <Stat
                label="Covers today"
                value={board?.todayGuestCount}
                hint="Guests expected, cancellations excluded"
              />
              <Stat label="Still to come" value={board?.upcomingCount} hint="Not yet due" />
              <Stat label="Seated now" value={board?.seatedCount} hint="Parties in" />
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

              {error !== null && <ErrorState message={error} onRetry={refresh} />}

              {board === null ? (
                <TableSkeleton rows={5} columns={5} />
              ) : board.reservations.length === 0 ? (
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
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Expected</Th>
                        <Th>Customer</Th>
                        <Th className="text-right">Guests</Th>
                        <Th>Table</Th>
                        <Th>Status</Th>
                        <Th>
                          <span className="sr-only">Actions</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.reservations.map((reservation) => (
                        <Tr key={reservation.id}>
                          <Td className="whitespace-nowrap">
                            <span className="font-medium text-text">
                              {formatTime(reservation.reservedForUtc)}
                            </span>
                            <span className="ml-1.5 text-xs text-muted">
                              {formatDay(reservation.reservedForUtc)}
                            </span>
                            <p className="text-xs text-muted">
                              until {formatTime(reservation.endsAtUtc)}
                            </p>
                          </Td>
                          <Td>
                            <span className="font-medium text-text">
                              {reservation.customerName}
                            </span>
                            {reservation.customerPhone !== null && (
                              <p className="text-xs text-muted">
                                {reservation.customerPhone}
                              </p>
                            )}
                            {reservation.notes !== null && (
                              <p className="mt-0.5 line-clamp-2 max-w-xs text-xs text-muted">
                                {reservation.notes}
                              </p>
                            )}
                          </Td>
                          <Td className="text-right tabular text-muted">
                            {reservation.guestCount}
                          </Td>
                          <Td className="text-muted">
                            {reservation.tableName ?? "Not decided"}
                            {reservation.tableCapacity !== null &&
                              reservation.guestCount > reservation.tableCapacity && (
                                <p className="text-xs text-warning">
                                  Seats {reservation.tableCapacity}
                                </p>
                              )}
                          </Td>
                          <Td>
                            <Badge tone={toneFor(reservation.status)} dot>
                              {reservation.status}
                            </Badge>
                            {reservation.cancellationReason !== null && (
                              <p className="mt-0.5 max-w-xs text-xs text-muted">
                                {reservation.cancellationReason}
                              </p>
                            )}
                          </Td>
                          <Td className="text-right">
                            <ReservationActions
                              reservation={reservation}
                              onChanged={refresh}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | undefined;
  hint: string;
}) {
  return (
    <Surface className="flex flex-col gap-0.5 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="text-2xl font-semibold text-text tabular">
        {value === undefined ? "—" : value}
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </Surface>
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
        await createReservation({ ...payload, customerId });
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
              <Field
                htmlFor={fieldId("customer")}
                label="Customer"
                required
                hint="Only people already on your books. Add them under Customers first."
                error={firstError(fieldErrors, "customerId")}
              >
                <Select
                  id={fieldId("customer")}
                  required
                  value={customerId}
                  onChange={setCustomerId}
                  aria-describedby={describedBy(fieldId("customer"), { hasHint: true })}
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
            <Button type="submit" disabled={isSubmitting || customerId === ""}>
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
