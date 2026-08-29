"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Armchair,
  Copy,
  Pencil,
  Plus,
  QrCode as QrCodeIcon,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";
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
import {
  createTable,
  deleteTable,
  listTables,
  regenerateOrderingToken,
  setTableActive,
  setTableOrdering,
  updateTable,
} from "@/features/tables/api";
import { ApiError } from "@/lib/api/client";
import { orderingLink, TABLE_CAPACITY } from "@/types/table";
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
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Tables" }]}
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
            <TableSkeleton rows={5} columns={5} />
          ) : tables.length === 0 ? (
            <EmptyState
              icon={<Armchair />}
              title="No tables yet"
              description="Add the tables in your restaurant. Waiters and ordering will use them later."
              action={<CreateTableDialog onCreated={refresh} />}
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Table</Th>
                    <Th>Seats</Th>
                    <Th>Status</Th>
                    <Th>Self-service</Th>
                    <Th className="text-right">Added</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((table) => (
                    <Tr key={table.id}>
                      <Td>
                        <span className="font-medium text-text">{table.name}</span>
                      </Td>
                      <Td className="text-muted tabular">{table.capacity}</Td>
                      <Td>
                        {table.isActive ? (
                          <Badge tone="success" dot>
                            In service
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Out of service
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        {table.isOrderingEnabled ? (
                          <Badge tone="primary" dot>
                            Guests can order
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Off</Badge>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap text-muted">
                        {formatDate(table.createdAtUtc)}
                      </Td>
                      <Td className="text-right">
                        <TableActionsDialog table={table} onChanged={refresh} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
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

function TableActionsDialog({
  table,
  onChanged,
}: {
  table: RestaurantTable;
  onChanged: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<
    "none" | "save" | "status" | "ordering" | "token" | "delete"
  >("none");

  function reset() {
    setName(table.name);
    setCapacity(String(table.capacity));
    setError(null);
    setFieldErrors({});
  }

  async function run(
    action: "save" | "status" | "ordering" | "token" | "delete",
    work: () => Promise<unknown>,
    options?: { keepOpen?: boolean },
  ) {
    setError(null);
    setFieldErrors({});
    setBusy(action);

    try {
      await work();
      await onChanged();

      // The self-service actions leave the dialog open, because a manager who has
      // just switched ordering on is about to look at the code, and a manager who
      // regenerated a token needs to see that it changed.
      if (options?.keepOpen !== true) {
        setIsOpen(false);
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "The action failed.");
      }
    } finally {
      setBusy("none");
    }
  }

  const isDirty = name !== table.name || capacity !== String(table.capacity);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" icon={<Pencil />}>
          Manage
        </Button>
      </DialogTrigger>

      <DialogContent
        title={table.name}
        description={`Seats ${table.capacity}`}
      >
        <div className="flex flex-col gap-5 px-4 py-4">
          {error !== null && <FormError message={error} />}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Service status</h3>
              {table.isActive ? (
                <Badge tone="success" dot>
                  In service
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Out of service
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted">
              {table.isActive
                ? "Taking a table out of service keeps its record and hides it from future restaurant operations."
                : "This table is kept but not offered to restaurant operations."}
            </p>

            <Button
              variant={table.isActive ? "secondary" : "primary"}
              size="sm"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() =>
                void run("status", () => setTableActive(table.id, !table.isActive))
              }
            >
              {busy === "status"
                ? "Saving…"
                : table.isActive
                  ? "Take out of service"
                  : "Return to service"}
            </Button>
          </section>

          <OrderingSection table={table} busy={busy} run={run} />

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Details</h3>

            <Field
              htmlFor={`table-name-${table.id}`}
              label="Table name"
              required
              error={firstError(fieldErrors, "name")}
            >
              <Input
                id={`table-name-${table.id}`}
                required
                maxLength={32}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "name") !== undefined}
              />
            </Field>

            <Field
              htmlFor={`table-capacity-${table.id}`}
              label="Seats"
              required
              error={firstError(fieldErrors, "capacity")}
            >
              <Input
                id={`table-capacity-${table.id}`}
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

            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={busy !== "none" || !isDirty}
              onClick={() =>
                void run("save", () =>
                  updateTable(table.id, { name, capacity: Number(capacity) }),
                )
              }
            >
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
          </section>

          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Remove</h3>
            <p className="text-xs text-muted">
              Deleting is only for a table added by mistake. Once an order or a booking
              has been made against it the request is refused, because those records
              name the table. Take it out of service instead for a table that genuinely
              existed.
            </p>

            <Button
              size="sm"
              variant="danger"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() => void run("delete", () => deleteTable(table.id))}
            >
              {busy === "delete" ? "Deleting…" : "Delete table"}
            </Button>
          </section>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Self-service ordering                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The code a guest scans, and the switch that makes it work.
 *
 * Two separate things, deliberately. Every table has a token from the moment it is
 * created, so a manager who decides months later to put codes out has nothing to set
 * up; whether guests may actually order is a switch, off by default, that can be turned
 * off for an evening without invalidating a single printed card.
 *
 * The code is shown alongside the link rather than instead of it. A card can be
 * photographed and reprinted from the link, and a guest whose camera will not focus can
 * type it.
 */
function OrderingSection({
  table,
  busy,
  run,
}: {
  table: RestaurantTable;
  busy: "none" | "save" | "status" | "ordering" | "token" | "delete";
  run: (
    action: "save" | "status" | "ordering" | "token" | "delete",
    work: () => Promise<unknown>,
    options?: { keepOpen?: boolean },
  ) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const link = orderingLink(table.publicOrderingToken);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused, and there is nothing to fix: the link is
      // on screen and selectable either way, so this says nothing rather than
      // raising an error about a convenience.
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <QrCodeIcon className="size-4 text-muted" aria-hidden="true" />
          Guest ordering
        </h3>
        {table.isOrderingEnabled ? (
          <Badge tone="primary" dot>
            On
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Off
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted">
        {table.isOrderingEnabled
          ? "Guests at this table can scan the code and order for themselves. What they order arrives as an ordinary order and still has to be sent to the kitchen by your staff."
          : "Switch this on to let guests at this table order by scanning. It is off until you do."}
      </p>

      {!table.isActive && table.isOrderingEnabled && (
        <p className="rounded-md border border-warning-border bg-warning-soft px-2.5 py-2 text-sm text-warning">
          This table is out of service, so the code will not work until you put it
          back.
        </p>
      )}

      <Button
        variant={table.isOrderingEnabled ? "secondary" : "primary"}
        size="sm"
        className="self-start"
        disabled={busy !== "none"}
        onClick={() =>
          void run(
            "ordering",
            () => setTableOrdering(table.id, !table.isOrderingEnabled),
            { keepOpen: true },
          )
        }
      >
        {busy === "ordering"
          ? "Saving…"
          : table.isOrderingEnabled
            ? "Switch off"
            : "Switch on"}
      </Button>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-3 sm:flex-row sm:items-start">
        <QrCode
          value={link}
          size={140}
          title={`Ordering code for ${table.name}`}
          className="self-center border border-border sm:self-start"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Ordering link
          </p>
          <p className="font-mono text-xs break-all text-text">{link}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy />}
              onClick={() => void copy()}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw />}
              disabled={busy !== "none"}
              onClick={() =>
                void run("token", () => regenerateOrderingToken(table.id), {
                  keepOpen: true,
                })
              }
            >
              {busy === "token" ? "Issuing…" : "New code"}
            </Button>
          </div>

          <p className="text-xs text-muted">
            A new code stops every card already printed for this table from working.
            Use it if one has been photographed or has gone missing.
          </p>
        </div>
      </div>
    </section>
  );
}
