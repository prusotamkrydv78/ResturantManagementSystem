"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Power,
  QrCode as QrCodeIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Notice,
  failure,
  fieldError,
  idle,
  type PanelState,
} from "@/components/ui/panel-state";
import { QrCode } from "@/components/ui/qr-code";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, Spinner } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  deleteTable,
  getTable,
  regenerateOrderingToken,
  setTableActive,
  setTableOrdering,
  updateTable,
} from "@/features/tables/api";
import { TABLE_CAPACITY, orderingLink } from "@/types/table";
import type { RestaurantTable } from "@/types/table";

/**
 * One table, and everything a manager does to it.
 *
 * A page rather than a dialog, for the reason the staff record is one: four
 * unrelated jobs live here — renaming it, taking it out of service, running the
 * code guests scan, and deleting it — and stacking them in a modal made one
 * scrolling column with a Close button at the bottom, which reads as a form to
 * fill in rather than as a record to work on. The ordering panel was the worst of
 * it: a QR code, a link, and two buttons, all inside a box a third of the height
 * of the screen.
 *
 * A page also removes a concept. In the dialog, switching ordering on had to pass
 * `keepOpen` so the modal did not shut before the manager could look at the code
 * it had just enabled. There is nothing to keep open here.
 *
 * The role gate shapes the UI only; the API independently rejects anyone who is
 * not a restaurant manager, and resolves the restaurant from their token rather
 * than from the identifier in this URL.
 */
export default function TablePage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <TableView />
    </RequireAuth>
  );
}

function TableView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getTable(id);

        if (!cancelled) {
          setTable(loaded);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load this table.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const refresh = useCallback((next: RestaurantTable) => setTable(next), []);

  return (
    <>
      <PageHeader
        title={table?.name ?? "Table"}
        description={
          table === null
            ? undefined
            : `Seats ${table.capacity} · ${
                table.isActive ? "In service" : "Out of service"
              } · Guest ordering ${table.isOrderingEnabled ? "on" : "off"}`
        }
        crumb={table?.name}
        actions={
          <LinkButton
            href="/settings/tables"
            variant="secondary"
            icon={<ArrowLeft />}
          >
            All tables
          </LinkButton>
        }
      />

      <PageBody>
        {loadError !== null && (
          <ErrorState
            message={loadError}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        )}

        {table === null && loadError === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {table !== null && (
          // The ordering panel is the widest thing here — a code, a link and two
          // buttons — so it takes the main column with the details form. Service
          // status and removal are occasional and sit alongside.
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <div className="flex flex-col gap-5">
              <DetailsPanel table={table} onSaved={refresh} />
              <OrderingPanel table={table} onChanged={refresh} />
            </div>

            <div className="flex flex-col gap-5">
              <ServicePanel table={table} onChanged={refresh} />
              <RecordPanel table={table} />
              <DangerPanel
                table={table}
                onDeleted={() => router.replace("/settings/tables")}
              />
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Details                                                                    */
/* -------------------------------------------------------------------------- */

function DetailsPanel({
  table,
  onSaved,
}: {
  table: RestaurantTable;
  onSaved: (next: RestaurantTable) => void;
}) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [state, setState] = useState<PanelState>(idle);

  const isDirty = name !== table.name || capacity !== String(table.capacity);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      const next = await updateTable(table.id, {
        name,
        capacity: Number(capacity),
      });
      onSaved(next);
      setState({ status: "done", message: "Saved." });
    } catch (caught) {
      setState(failure(caught, "Unable to save these changes."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Details"
        description="What this table is called on every screen, and how many it seats."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="table-name"
            label="Table name"
            required
            error={fieldError(state, "name")}
          >
            <Input
              id="table-name"
              required
              maxLength={32}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldError(state, "name") !== undefined}
            />
          </Field>

          <Field
            htmlFor="table-capacity"
            label="Seats"
            required
            error={fieldError(state, "capacity")}
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
              aria-invalid={fieldError(state, "capacity") !== undefined}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" disabled={state.status === "busy" || !isDirty}>
            {state.status === "busy" ? "Saving…" : "Save changes"}
          </Button>

          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={state.status === "busy"}
              onClick={() => {
                setName(table.name);
                setCapacity(String(table.capacity));
                setState(idle);
              }}
            >
              Discard
            </Button>
          )}

          <Notice state={state} />
        </div>
      </form>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Guest ordering                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The code a guest scans, and the switch that makes it work.
 *
 * Two separate things, deliberately. Every table has a token from the moment it is
 * created, so a manager who decides months later to put codes out has nothing to
 * set up; whether guests may actually order is a switch, off by default, that can
 * be turned off for an evening without invalidating a single printed card.
 *
 * The code is shown alongside the link rather than instead of it. A card can be
 * photographed and reprinted from the link, and a guest whose camera will not focus
 * can be read it.
 */
function OrderingPanel({
  table,
  onChanged,
}: {
  table: RestaurantTable;
  onChanged: (next: RestaurantTable) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);
  const [copied, setCopied] = useState(false);

  const link = orderingLink(table.publicOrderingToken);

  async function run(work: () => Promise<RestaurantTable>, message: string) {
    setState({ status: "busy" });

    try {
      onChanged(await work());
      setState({ status: "done", message });
    } catch (caught) {
      setState(failure(caught, "The action failed."));
    }
  }

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
    <Surface>
      <SurfaceHeader
        title="Guest ordering"
        actions={
          table.isOrderingEnabled ? (
            <Badge tone="primary" dot>
              On
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Off
            </Badge>
          )
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={table.isOrderingEnabled ? "secondary" : "primary"}
            size="sm"
            icon={<QrCodeIcon />}
            disabled={state.status === "busy"}
            onClick={() =>
              void run(
                () => setTableOrdering(table.id, !table.isOrderingEnabled),
                table.isOrderingEnabled ? "Switched off." : "Switched on.",
              )
            }
          >
            {state.status === "busy"
              ? "Saving…"
              : table.isOrderingEnabled
                ? "Switch off"
                : "Switch on"}
          </Button>

          <Notice state={state} />
        </div>

        <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-2 p-4 sm:flex-row sm:items-start">
          <QrCode
            value={link}
            size={160}
            title={`Ordering code for ${table.name}`}
            className="self-center border border-border sm:self-start"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-2xs font-medium tracking-wide text-muted uppercase">
              Ordering link
            </p>
            <p className="font-mono text-xs break-all text-text">{link}</p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
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
                disabled={state.status === "busy"}
                onClick={() =>
                  void run(
                    () => regenerateOrderingToken(table.id),
                    "New code issued.",
                  )
                }
              >
                New code
              </Button>
            </div>

            <p className="text-xs text-muted">
              A new code stops every card already printed for this table from
              working. Use it if one has been photographed or has gone missing.
            </p>
          </div>
        </div>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Service status                                                             */
/* -------------------------------------------------------------------------- */

function ServicePanel({
  table,
  onChanged,
}: {
  table: RestaurantTable;
  onChanged: (next: RestaurantTable) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);

  async function toggle() {
    setState({ status: "busy" });

    try {
      onChanged(await setTableActive(table.id, !table.isActive));
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Unable to change service status."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Service status"
        actions={
          table.isActive ? (
            <Badge tone="success" dot>
              In service
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Out of service
            </Badge>
          )
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          {table.isActive
            ? "Taking a table out of service keeps its record and hides it from future restaurant operations."
            : "This table is kept but not offered to restaurant operations."}
        </p>

        <Button
          variant={table.isActive ? "secondary" : "primary"}
          size="sm"
          className="self-start"
          icon={<Power />}
          disabled={state.status === "busy"}
          onClick={() => void toggle()}
        >
          {state.status === "busy"
            ? "Saving…"
            : table.isActive
              ? "Take out of service"
              : "Return to service"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Removal                                                                    */
/* -------------------------------------------------------------------------- */

function DangerPanel({
  table,
  onDeleted,
}: {
  table: RestaurantTable;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, setState] = useState<PanelState>(idle);

  async function handleDelete() {
    setState({ status: "busy" });

    try {
      await deleteTable(table.id);
      onDeleted();
    } catch (caught) {
      setState(failure(caught, "Unable to delete this table."));
      setIsConfirming(false);
    }
  }

  return (
    <Surface className="border-danger-border">
      <SurfaceHeader title="Remove" className="border-danger-border" />

      <div className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          Deleting is only for a table added by mistake. Once an order or a booking
          has been made against it the request is refused, because those records name
          the table. Take it out of service instead for a table that genuinely
          existed.
        </p>

        {/* Two presses rather than one. A page has no Cancel button to lean on the
            way a dialog does, and this is the one action here that cannot be
            undone. */}
        {isConfirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => void handleDelete()}
            >
              {state.status === "busy" ? "Deleting…" : `Yes, delete ${table.name}`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => setIsConfirming(false)}
            >
              Keep the table
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            className="self-start"
            icon={<Trash2 />}
            onClick={() => setIsConfirming(true)}
          >
            Delete table
          </Button>
        )}
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Read-only facts                                                            */
/* -------------------------------------------------------------------------- */

function RecordPanel({ table }: { table: RestaurantTable }) {
  return (
    <Surface>
      <SurfaceHeader title="Record" />

      <dl className="divide-y divide-border">
        <DetailRow label="Added">{formatDate(table.createdAtUtc)}</DetailRow>
        <DetailRow label="Table id" mono>
          {table.id}
        </DetailRow>
      </dl>
    </Surface>
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
