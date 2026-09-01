"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Contact,
  Plus,
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
  listCustomers,
  setCustomerActive,
  updateCustomer,
} from "@/features/customers/api";
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
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listCustomers({ search: applied, includeInactive });

        if (!cancelled) {
          setCustomers(loaded);
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
                : "Unable to load the customers.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [applied, includeInactive, reloadKey]);

  const archived = customers?.filter((customer) => !customer.isActive).length ?? 0;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Regulars, bookings and anyone worth remembering. Nobody signs in here; these are your own records."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Customers" },
        ]}
        actions={<CustomerDialog onSaved={refresh} />}
      />

      <PageBody>
        {noRestaurant ? (
          <NoRestaurantAssigned area="Customers" />
        ) : (
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
                    className={customer.isActive ? "p-3.5" : "p-3.5 opacity-70"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/settings/customers/${customer.id}`}
                        className="min-w-0 font-medium text-text hover:underline"
                      >
                        {customer.name}
                      </Link>
                      {!customer.isActive && <Badge tone="neutral">Archived</Badge>}
                    </div>

                    <p className="mt-0.5 truncate text-2xs text-muted">
                      {customer.phone ?? "No phone number"}
                    </p>

                    {customer.notes !== null && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted italic">
                        {customer.notes}
                      </p>
                    )}

                    {/* The two counts are why a customer record is kept at all, so
                        they read as figures rather than as columns to scan down. */}
                    <dl className="mt-3 flex gap-4">
                      <div>
                        <dt className="text-2xs text-subtle">Visits</dt>
                        <dd className="text-base font-semibold text-text tabular">
                          {customer.orderCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-2xs text-subtle">Bookings</dt>
                        <dd className="text-base font-semibold text-text tabular">
                          {customer.reservationCount}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
                      <span className="text-2xs text-subtle">
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

  return (
    <div className="flex items-center justify-end gap-1.5">
      {error !== null && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}

      <CustomerDialog
        customer={customer}
        onSaved={onSaved}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />

      <Button
        variant="ghost"
        size="sm"
        icon={customer.isActive ? <Archive /> : <ArchiveRestore />}
        disabled={busy !== "none"}
        onClick={() =>
          void run("status", () => setCustomerActive(customer.id, !customer.isActive))
        }
      >
        {busy === "status"
          ? "Saving…"
          : customer.isActive
            ? "Archive"
            : "Restore"}
      </Button>

      {!hasHistory && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 />}
          className="text-danger hover:bg-danger-soft hover:text-danger"
          disabled={busy !== "none"}
          onClick={() => void run("delete", () => deleteCustomer(customer.id))}
        >
          {busy === "delete" ? "Deleting…" : "Delete"}
        </Button>
      )}
    </div>
  );
}
