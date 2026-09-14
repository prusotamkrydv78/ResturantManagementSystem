"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Mail, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  assignManagerToRestaurant,
  getManager,
  resetManagerPassword,
  setManagerActive,
  unassignManager,
  updateManager,
} from "@/features/managers/api";
import { Report, useAction } from "@/features/platform/use-action";
import { listRestaurants } from "@/features/restaurants/api";
import type { Manager } from "@/types/manager";
import type { RestaurantSummary } from "@/types/restaurant";

/**
 * One manager, and everything that can be done to their account.
 *
 * This was a dialog, and it had outgrown one in the way dialogs usually do: four
 * separate jobs stacked down a scrolling panel, each with its own button, none of
 * them the dialog's obvious purpose. A dialog is for one decision you come back from.
 * Renaming an account, moving it to another restaurant, issuing a password and
 * locking it out are four decisions, and the last two are irreversible.
 *
 * As a page each one gets its own card, its own confirmation, and a URL somebody can
 * be sent. Nothing about the actions changed; only where they live.
 */
export default function ManagerEditPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <ManagerEdit />
    </RequireAuth>
  );
}

function ManagerEdit() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [manager, setManager] = useState<Manager | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    const [loadedManager, loadedRestaurants] = await Promise.all([
      getManager(id),
      listRestaurants(),
    ]);

    setManager(loadedManager);
    setRestaurants(loadedRestaurants);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedManager, loadedRestaurants] = await Promise.all([
          getManager(id),
          listRestaurants(),
        ]);
        if (!cancelled) {
          setManager(loadedManager);
          setRestaurants(loadedRestaurants);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load the manager.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (loadError !== null) {
    return (
      <>
        <PageHeader title="Manager" crumbs={CRUMBS} />
        <PageBody>
          <Surface>
            <ErrorState
              message={loadError}
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  if (manager === null) {
    return (
      <>
        <PageHeader title="Loading…" crumbs={CRUMBS} />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </Surface>
          <Surface className="h-56" />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={manager.fullName}
        description={manager.email}
        crumbs={[...CRUMBS, { label: manager.fullName }]}
        actions={
          <LinkButton href="/admin/managers" variant="secondary">
            Back to managers
          </LinkButton>
        }
      />

      <PageBody>
        <Surface className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Suspension outranks assignment: a suspended account cannot sign in,
                so saying only "Assigned" would be misleading. */}
            {!manager.isActive && (
              <Badge tone="danger" dot>
                Suspended
              </Badge>
            )}
            {manager.isAssigned ? (
              <Badge tone="success" dot>
                Assigned
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Unassigned
              </Badge>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Mail className="size-3.5 text-subtle" aria-hidden="true" />
              {manager.email}
            </span>
          </div>

          {manager.restaurant !== null && (
            <Link
              href={`/admin/restaurants/${manager.restaurant.id}`}
              className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline"
            >
              <Store className="size-3.5" aria-hidden="true" />
              {manager.restaurant.name}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </Surface>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <AccountCard manager={manager} onSaved={refresh} />
            <PasswordCard manager={manager} />
          </div>

          <div className="flex flex-col gap-4">
            <AssignmentCard
              manager={manager}
              restaurants={restaurants}
              onChanged={refresh}
            />
            <AccessCard
              manager={manager}
              onChanged={refresh}
              onSuspended={() => router.push("/admin/managers")}
            />
          </div>
        </div>
      </PageBody>
    </>
  );
}

const CRUMBS = [
  { label: "Platform", href: "/dashboard" },
  { label: "Managers", href: "/admin/managers" },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

/** Name and email. The only two things about a manager that are theirs alone. */
function AccountCard({
  manager,
  onSaved,
}: {
  manager: Manager;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(manager.fullName);
  const [email, setEmail] = useState(manager.email);
  const action = useAction();

  const unchanged = fullName === manager.fullName && email === manager.email;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    await action.run(async () => {
      await updateManager(manager.id, { fullName, email });
      await onSaved();
    }, "Saved.");
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Account details"
        description="What this person is called, and the address they sign in with."
      />
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex flex-col gap-4 p-4">
          <Report action={action} />

          <Field htmlFor="manager-name" label="Full name" required>
            <Input
              id="manager-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>

          <Field
            htmlFor="manager-email"
            label="Email"
            required
            hint="Changing this changes what they sign in with. Tell them."
          >
            <Input
              id="manager-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={describedBy("manager-email", { hasHint: true })}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            disabled={unchanged || action.busy}
            onClick={() => {
              setFullName(manager.fullName);
              setEmail(manager.email);
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={unchanged || action.busy}>
            {action.busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Surface>
  );
}

/**
 * Which restaurant they run.
 *
 * Moving a manager releases their previous restaurant in the same step, which is why
 * it is one control and not two. Restaurants that already have somebody are left out
 * of the list rather than offered and then refused by the server.
 */
function AssignmentCard({
  manager,
  restaurants,
  onChanged,
}: {
  manager: Manager;
  restaurants: RestaurantSummary[];
  onChanged: () => Promise<void>;
}) {
  const [restaurantId, setRestaurantId] = useState(manager.restaurant?.id ?? "");
  const action = useAction();

  const selectable = restaurants.filter(
    (restaurant) =>
      restaurant.managerId === null || restaurant.managerId === manager.id,
  );

  const changed = restaurantId !== (manager.restaurant?.id ?? "");

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Restaurant"
        description={
          manager.restaurant === null
            ? "This manager does not run a restaurant yet."
            : `Currently running ${manager.restaurant.name}.`
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Report action={action} />

        <Field
          htmlFor="manager-restaurant"
          label="Assigned to"
          hint="Moving a manager releases their previous restaurant in the same step."
        >
          <Select
            id="manager-restaurant"
            value={restaurantId}
            onChange={setRestaurantId}
            aria-describedby={describedBy("manager-restaurant", { hasHint: true })}
            options={[
              { value: "", label: "No restaurant" },
              ...selectable.map((restaurant) => ({
                value: restaurant.id,
                label: restaurant.name,
              })),
            ]}
          />
        </Field>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        {manager.isAssigned && (
          <Button
            variant="secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await unassignManager(manager.id);
                setRestaurantId("");
                await onChanged();
              }, "Restaurant released.")
            }
          >
            Unassign
          </Button>
        )}
        <Button
          disabled={!changed || restaurantId === "" || action.busy}
          onClick={() =>
            void action.run(async () => {
              await assignManagerToRestaurant(manager.id, restaurantId);
              await onChanged();
            }, "Assignment saved.")
          }
        >
          {action.busy ? "Saving…" : manager.isAssigned ? "Reassign" : "Assign"}
        </Button>
      </div>
    </Surface>
  );
}

/**
 * Issuing a password.
 *
 * There is no self-service reset in this product, so this is the only way back in for
 * a manager who has lost theirs. Typed rather than generated, and shown rather than
 * emailed, because the platform owner is going to have to tell them what it is.
 */
function PasswordCard({ manager }: { manager: Manager }) {
  const [password, setPassword] = useState("");
  const action = useAction();

  return (
    <Surface>
      <SurfaceHeader
        title="Password"
        description="There is no self-service reset. This is the only way back in for a manager who has lost theirs."
      />
      <div className="flex flex-col gap-4 p-4">
        <Report action={action} />

        <Field
          htmlFor="manager-password"
          label="New password"
          hint="Replaces the old one immediately. Tell them what you set."
        >
          <PasswordInput
            id="manager-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={describedBy("manager-password", { hasHint: true })}
          />
        </Field>
      </div>

      <div className="flex justify-end border-t border-border px-4 py-3">
        <Button
          variant="secondary"
          disabled={password.trim() === "" || action.busy}
          onClick={() =>
            void action.run(async () => {
              await resetManagerPassword(manager.id, { password });
              setPassword("");
            }, "Password replaced.")
          }
        >
          {action.busy ? "Saving…" : "Replace password"}
        </Button>
      </div>
    </Surface>
  );
}

/**
 * Suspending and restoring.
 *
 * Its own card at the bottom of the column, away from the fields somebody is editing.
 * Suspending revokes every session immediately, which is the most abrupt thing on
 * this page and the one worth a second of hesitation.
 */
function AccessCard({
  manager,
  onChanged,
  onSuspended,
}: {
  manager: Manager;
  onChanged: () => Promise<void>;
  /** Where to go afterwards, since a suspended account has nothing left to edit. */
  onSuspended: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = useAction();

  const suspending = manager.isActive;

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Account access"
        description={
          suspending
            ? "Suspending revokes their sessions immediately."
            : "This account is suspended and cannot sign in."
        }
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Report action={action} />

        <p className="text-sm text-muted">
          {suspending
            ? manager.isAssigned
              ? "A manager who still runs a restaurant has to be unassigned first."
              : "They will be signed out everywhere and will not be able to sign back in."
            : "Restoring lets them sign in again with their existing password."}
        </p>

        {confirming && suspending && (
          <p
            role="alert"
            className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            Suspend {manager.fullName}? They will be signed out immediately.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        {confirming && (
          <Button
            variant="secondary"
            disabled={action.busy}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        )}
        <Button
          variant={suspending ? "danger" : "secondary"}
          disabled={action.busy}
          onClick={() => {
            // Restoring is harmless and undoes itself; suspending signs somebody out
            // of a live service, so only that one asks twice.
            if (suspending && !confirming) {
              setConfirming(true);

              return;
            }

            void action.run(async () => {
              await setManagerActive(manager.id, { isActive: !manager.isActive });
              setConfirming(false);
              await onChanged();

              if (suspending) {
                onSuspended();
              }
            }, suspending ? "Account suspended." : "Account restored.");
          }}
        >
          {action.busy
            ? "Saving…"
            : suspending
              ? confirming
                ? "Yes, suspend"
                : "Suspend account"
              : "Restore account"}
        </Button>
      </div>
    </Surface>
  );
}
