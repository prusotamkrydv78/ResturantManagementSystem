"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Armchair, Plus, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardGrid, CardGridSkeleton } from "@/components/ui/card-grid";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { createTable, listTables } from "@/features/tables/api";
import { ApiError } from "@/lib/api/client";
import { TABLE_CAPACITY } from "@/types/table";
import type { RestaurantTable } from "@/types/table";

/**
 * Tables for the signed-in manager restaurant.
 *
 * A management list, not a floor plan: there is no layout, position or seating
 * map in this version. The role gate shapes the UI only; the API independently
 * scopes every result to the caller restaurant.
 */
export default function TablesPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <Tables />
    </RequireAuth>
  );
}

function Tables() {
  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const loaded = await listTables();
      setTables(loaded);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load tables.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listTables();
        if (!cancelled) {
          setTables(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load tables.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = tables?.filter((table) => table.isActive).length ?? 0;
  const seats = tables
    ?.filter((table) => table.isActive)
    .reduce((total, table) => total + table.capacity, 0);

  return (
    <>
      <PageHeader
        title="Tables"
        description="The tables in your restaurant and how many people each one seats."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Tables" },
        ]}
        actions={<CreateTableDialog onCreated={refresh} />}
      />

      <PageBody>
        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="text-sm text-muted">
              {tables === null
                ? "Loading…"
                : `${tables.length} ${tables.length === 1 ? "table" : "tables"}`}
              {tables !== null && tables.length > activeCount && (
                <> · {tables.length - activeCount} out of service</>
              )}
            </p>
            {tables !== null && tables.length > 0 && (
              <p className="text-sm text-muted">
                {seats} {seats === 1 ? "seat" : "seats"} in service
              </p>
            )}
          </div>

          {error !== null && <ErrorState message={error} onRetry={() => void refresh()} />}

          {tables === null ? (
            <CardGridSkeleton count={10} />
          ) : tables.length === 0 ? (
            <EmptyState
              icon={<Armchair />}
              title="No tables yet"
              description="Add the tables in your restaurant. Waiters and ordering will use them later."
              action={<CreateTableDialog onCreated={refresh} />}
            />
          ) : (
            <CardGrid>
              {tables.map((table) => (
                <Card key={table.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/settings/tables/${table.id}`}
                      className="min-w-0 text-base font-medium text-text hover:underline"
                    >
                      {table.name}
                    </Link>

                    {/* The seat count as a figure rather than a column. It is the
                        one number anybody looks a table up by. */}
                    <span className="flex shrink-0 items-center gap-1 text-muted">
                      <Armchair className="size-3.5" aria-hidden="true" />
                      <span className="tabular text-sm">{table.capacity}</span>
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {table.isActive ? (
                      <Badge tone="success" dot>
                        In service
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        Out of service
                      </Badge>
                    )}

                    {/* Only when it is on. Off is the default for every table, and a
                        grid of "Off" chips would say nothing about any of them. */}
                    {table.isOrderingEnabled && (
                      <Badge tone="primary" dot>
                        Guests can order
                      </Badge>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
                    <span className="text-2xs text-subtle">
                      Added {formatDate(table.createdAtUtc)}
                    </span>
                    <LinkButton
                      href={`/settings/tables/${table.id}`}
                      variant="secondary"
                      size="sm"
                      icon={<SlidersHorizontal />}
                    >
                      Manage
                    </LinkButton>
                  </div>
                </Card>
              ))}
            </CardGrid>
          )}
        </Surface>
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
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

function CreateTableDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setCapacity("2");
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await createTable({ name, capacity: Number(capacity) });
      reset();
      setIsOpen(false);
      await onCreated();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to add this table.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button icon={<Plus />}>Add table</Button>
      </DialogTrigger>

      <DialogContent
        title="Add table"
        description="Names only need to be unique inside your own restaurant."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor="table-name"
              label="Table name"
              required
              hint="Whatever your staff call it, such as Table 1, A1 or Outdoor 2."
              error={firstError(fieldErrors, "name")}
            >
              <Input
                id="table-name"
                required
                maxLength={32}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "name") !== undefined}
                aria-describedby={describedBy("table-name", { hasHint: true })}
              />
            </Field>

            <Field
              htmlFor="table-capacity"
              label="Seats"
              required
              error={firstError(fieldErrors, "capacity")}
            >
              <Input
                id="table-capacity"
                type="number"
                inputMode="numeric"
                required
                min={TABLE_CAPACITY.min}
                max={TABLE_CAPACITY.max}
                className="sm:max-w-32"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                aria-invalid={firstError(fieldErrors, "capacity") !== undefined}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit and in-service toggle                                                 */
/* -------------------------------------------------------------------------- */
