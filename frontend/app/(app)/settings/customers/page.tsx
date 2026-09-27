"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarClock,
  ArchiveRestore,
  Contact,
  Pencil,
  Phone,
  Plus,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardGrid, CardGridSkeleton } from "@/components/ui/card-grid";
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
import { Surface } from "@/components/ui/surface";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils/cn";
import {
  EmptyState,
  ErrorState,
  FormError,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import {
  createCustomer,
  deleteCustomer,
  setCustomerActive,
  updateCustomer,
} from "@/features/customers/api";
import { useCustomers, useInvalidateRestaurant } from "@/queries/manager";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { CUSTOMER_LIMITS } from "@/types/customer";
import type { Customer } from "@/types/customer";

/**
 * The people the restaurant knows.
 *
 * A book of names, not a set of accounts: nobody signs in as a customer anywhere in
 * this product. What makes a row worth keeping is the history attached to it, which is
 * why somebody who has been in is archived rather than deleted.
 */
export default function CustomersPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <CustomerList />
    </RequireAuth>
  );
}

function CustomerList() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");

  // From the shared cache, per search and toggle.
  const customersQuery = useCustomers({ search: applied, includeInactive });
  const invalidate = useInvalidateRestaurant();
  const customers = customersQuery.data ?? null;
  const noRestaurant = customersQuery.error !== null && isMissingRestaurant(customersQuery.error);
  const error = customersQuery.data === undefined && customersQuery.error !== null && !isMissingRestaurant(customersQuery.error)
      ? customersQuery.error instanceof Error
        ? customersQuery.error.message
        : "Unable to load the customers."
      : null;
  const refresh = useCallback(() => {
    void invalidate(["restaurant", "setup", "customers"]);
  }, [invalidate]);

  const archived = customers?.filter((customer) => !customer.isActive).length ?? 0;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Regulars and anyone worth remembering. Your own records - nobody signs in here."
        actions={<CustomerDialog onSaved={refresh} />}
      />

      <PageBody>
        {noRestaurant ? (
          <NoRestaurantAssigned area="Customers" />
        ) : (
          <>
          {/* Over the whole book only: a search narrows the list, not the tiles. */}
          {customers !== null && customers.length > 0 && applied === "" && (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatTile icon={Contact} tone="indigo" label="Customers" value={customers.filter((customer) => customer.isActive).length} footnote={archived > 0 ? `${archived} archived` : "in your book"} />
              <StatTile icon={Repeat} tone="teal" label="Regulars" value={customers.filter((customer) => customer.orderCount >= 3).length} footnote="three orders or more" />
              <StatTile icon={CalendarClock} tone="peach" label="Have booked" value={customers.filter((customer) => customer.reservationCount > 0).length} footnote="made a reservation" />
              <StatTile icon={Phone} tone="sky" label="Reachable" value={customers.filter((customer) => customer.phone !== null || customer.email !== null).length} footnote="with a phone or email" />
            </div>
          )}

          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setApplied(search);
                }}
              >
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    className="pl-8"
                    placeholder="Name or phone number"
                    aria-label="Search customers"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
                {applied !== "" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setApplied("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </form>

              <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border-strong"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                />
                Show archived
                {archived > 0 && <span className="tabular">({archived})</span>}
              </label>
            </div>

            {error !== null && <ErrorState message={error} onRetry={refresh} />}

            {customers === null ? (
              <CardGridSkeleton count={10} />
            ) : customers.length === 0 ? (
              <EmptyState
                icon={<Contact />}
                title={applied === "" ? "No customers yet" : "Nobody matches that"}
                description={
                  applied === ""
                    ? "Record a customer when somebody books a table or asks you to remember them."
                    : "Search matches a name or a phone number. Try part of either."
                }
                action={applied === "" ? <CustomerDialog onSaved={refresh} /> : undefined}
              />
            ) : (
              <CardGrid>
                {customers.map((customer) => (
                  <Card
                    key={customer.id}
                    className={cn("gap-3 p-3.5", !customer.isActive && "opacity-70")}
                  >
                    {/* Who they are. */}
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                      >
                        {customer.name.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`/settings/customers/${customer.id}`}
                          className="truncate font-semibold text-text hover:underline"
                        >
                          {customer.name}
                        </Link>
                        <span className="truncate text-2xs text-muted">
                          {customer.phone ?? customer.email ?? "No contact details"}
                        </span>
                      </span>
                      {!customer.isActive && <Badge tone="neutral">Archived</Badge>}
                    </div>

                    {customer.notes !== null && (
                      <p className="line-clamp-2 text-xs text-muted italic">{customer.notes}</p>
                    )}

                    {/* The two counts are why a customer record is kept at all, so
                        they read as figures rather than as columns to scan down. */}
                    <dl className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-surface-2 px-2.5 py-2">
                        <dt className="text-2xs text-subtle">Visits</dt>
                        <dd className="tabular text-base font-semibold text-text">{customer.orderCount}</dd>
                      </div>
                      <div className="rounded-xl bg-surface-2 px-2.5 py-2">
                        <dt className="text-2xs text-subtle">Bookings</dt>
                        <dd className="tabular text-base font-semibold text-text">{customer.reservationCount}</dd>
                      </div>
                    </dl>

                    {/* When they were last in, on its own line, then the actions: a
                        short card could not hold both side by side without folding the
                        date into three lines and pushing a button off the edge. */}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
                      <span className="min-w-0 truncate text-2xs text-subtle">
                        {customer.lastVisitAtUtc === null
                          ? "Never been in"
                          : `Last in ${formatDate(customer.lastVisitAtUtc)}`}
                      </span>
                      <CustomerRowActions customer={customer} onSaved={refresh} />
                    </div>
                  </Card>
                ))}
              </CardGrid>
            )}
          </Surface>
          </>
        )}
      </PageBody>
    </>
  );
}

function formatDate(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function firstError(
  errors: Record<string, string[]>,
  field: string,
): string | undefined {
  return errors[field]?.[0];
}

/* -------------------------------------------------------------------------- */
/* Create and edit                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One dialog for both recording and editing, because the fields are the same and two
 * copies of them would drift apart.
 */
function CustomerDialog({
  customer,
  onSaved,
  trigger,
}: {
  customer?: Customer;
  onSaved: () => void;
  trigger?: React.ReactNode;
}) {
  const isEdit = customer !== undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setNotes(customer?.notes ?? "");
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    // Blank is sent as null rather than as an empty string, so the phone uniqueness
    // rule does not treat two people who gave no number as the same person.
    const payload = {
      name,
      phone: phone.trim() === "" ? null : phone.trim(),
      email: email.trim() === "" ? null : email.trim(),
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    try {
      if (isEdit) {
        await updateCustomer(customer.id, payload);
      } else {
        await createCustomer(payload);
      }

      setIsOpen(false);
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Unable to save this customer.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldId = (field: string) =>
    isEdit ? `customer-${field}-${customer.id}` : `customer-${field}`;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button icon={<Plus />}>Add customer</Button>}
      </DialogTrigger>

      <DialogContent
        title={isEdit ? customer.name : "Add customer"}
        description="Only a name is required. Everything else is there so you recognise them next time."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor={fieldId("name")}
              label="Name"
              required
              error={firstError(fieldErrors, "name")}
            >
              <Input
                id={fieldId("name")}
                required
                autoFocus
                maxLength={CUSTOMER_LIMITS.name}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "name") !== undefined}
              />
            </Field>

            <Field
              htmlFor={fieldId("phone")}
              label="Phone"
              hint="Optional, but it has to be unique in your restaurant when given."
              error={firstError(fieldErrors, "phone")}
            >
              <Input
                id={fieldId("phone")}
                type="tel"
                maxLength={CUSTOMER_LIMITS.phone}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                aria-invalid={firstError(fieldErrors, "phone") !== undefined}
                aria-describedby={describedBy(fieldId("phone"), { hasHint: true })}
              />
            </Field>

            <Field
              htmlFor={fieldId("email")}
              label="Email"
              hint="Kept for your records. Nothing is ever sent to it."
              error={firstError(fieldErrors, "email")}
            >
              <Input
                id={fieldId("email")}
                type="email"
                maxLength={CUSTOMER_LIMITS.email}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={firstError(fieldErrors, "email") !== undefined}
                aria-describedby={describedBy(fieldId("email"), { hasHint: true })}
              />
            </Field>

            <Field
              htmlFor={fieldId("notes")}
              label="Notes"
              hint="A usual table, an allergy, anything worth knowing before they arrive."
              error={firstError(fieldErrors, "notes")}
            >
              <Textarea
                id={fieldId("notes")}
                maxLength={CUSTOMER_LIMITS.notes}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                aria-invalid={firstError(fieldErrors, "notes") !== undefined}
                aria-describedby={describedBy(fieldId("notes"), { hasHint: true })}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Archive and delete                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Archiving and deleting, side by side, because the choice between them is the point.
 *
 * Deleting is only offered to a row with nothing attached to it. Anybody who has eaten
 * here or booked a table can only be archived, since an order pointing at a row nobody
 * can look up loses the answer to who it was for.
 */
function CustomerRowActions({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<"none" | "status" | "delete">("none");
  const [error, setError] = useState<string | null>(null);

  const hasHistory = customer.orderCount > 0 || customer.reservationCount > 0;

  async function run(action: "status" | "delete", work: () => Promise<unknown>) {
    setError(null);
    setBusy(action);

    try {
      await work();
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy("none");
    }
  }

  const icon = "flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
        <CustomerDialog
          customer={customer}
          onSaved={onSaved}
          trigger={
            <button type="button" className={icon} aria-label={`Edit ${customer.name}`} title="Edit">
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          }
        />

        <button
          type="button"
          className={icon}
          aria-label={customer.isActive ? `Archive ${customer.name}` : `Restore ${customer.name}`}
          title={customer.isActive ? "Archive" : "Restore"}
          disabled={busy !== "none"}
          onClick={() => void run("status", () => setCustomerActive(customer.id, !customer.isActive))}
        >
          {customer.isActive ? (
            <Archive className="size-4" aria-hidden="true" />
          ) : (
            <ArchiveRestore className="size-4" aria-hidden="true" />
          )}
        </button>

        {!hasHistory && (
          <button
            type="button"
            className={cn(icon, "hover:bg-danger-soft hover:text-danger")}
            aria-label={`Delete ${customer.name}`}
            title="Delete"
            disabled={busy !== "none"}
            onClick={() => void run("delete", () => deleteCustomer(customer.id))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {error !== null && (
        <span role="alert" className="text-2xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
