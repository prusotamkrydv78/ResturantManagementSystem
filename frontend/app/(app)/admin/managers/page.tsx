"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Search, UserPlus, Users } from "lucide-react";
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
import { Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
  createManager,
  listManagers,
  unassignManager,
  updateManager,
  assignManagerToRestaurant,
} from "@/features/managers/api";
import { listRestaurants } from "@/features/restaurants/api";
import type { Manager, ManagerFilter } from "@/types/manager";
import type { RestaurantSummary } from "@/types/restaurant";

/**
 * Restaurant manager administration.
 *
 * The role gate shapes the UI only; the API independently rejects anyone who is
 * not a Super Admin.
 */
export default function ManagersPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <Managers />
    </RequireAuth>
  );
}

function Managers() {
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ManagerFilter>("All");

  const load = useCallback(async (term: string, filter: ManagerFilter) => {
    try {
      const [loadedManagers, loadedRestaurants] = await Promise.all([
        listManagers({ search: term, status: filter }),
        listRestaurants(),
      ]);
      setManagers(loadedManagers);
      setRestaurants(loadedRestaurants);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load managers.");
    }
  }, []);

  // Refetch on the server whenever the query changes, so search works across the
  // whole set rather than only the rows already downloaded.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [loadedManagers, loadedRestaurants] = await Promise.all([
          listManagers({ search, status }),
          listRestaurants(),
        ]);
        if (!cancelled) {
          setManagers(loadedManagers);
          setRestaurants(loadedRestaurants);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load managers.",
          );
        }
      }
    }

    const timer = setTimeout(() => void run(), 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, status]);

  const refresh = useCallback(() => load(search, status), [load, search, status]);

  const unassignedRestaurants = restaurants.filter(
    (restaurant) => restaurant.managerId === null,
  );

  const isFiltered = search.trim() !== "" || status !== "All";

  return (
    <>
      <PageHeader
        title="Managers"
        description="Restaurant managers on the platform, and the restaurant each one runs."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Managers" }]}
        actions={
          <CreateManagerDialog
            restaurants={unassignedRestaurants}
            onCreated={refresh}
          />
        }
      />

      <PageBody>
        <Surface>
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="manager-search"
                  type="search"
                  placeholder="Search name or email"
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search managers"
                />
              </div>

              <Select
                id="manager-status"
                className="sm:w-44"
                value={status}
                onChange={(event) => setStatus(event.target.value as ManagerFilter)}
                aria-label="Filter by assignment"
              >
                <option value="All">All managers</option>
                <option value="Assigned">Assigned</option>
                <option value="Unassigned">Unassigned</option>
              </Select>
            </div>

            <p className="text-sm text-muted">
              {managers === null
                ? "Loading…"
                : `${managers.length} ${managers.length === 1 ? "manager" : "managers"}`}
            </p>
          </div>

          {error !== null && <ErrorState message={error} onRetry={() => void refresh()} />}

          {managers === null ? (
            <TableSkeleton rows={5} columns={4} />
          ) : managers.length === 0 ? (
            isFiltered ? (
              <EmptyState
                icon={<Search />}
                title="No managers match"
                description="Try a different search term or clear the filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStatus("All");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users />}
                title="No managers yet"
                description="Create a manager, then assign them the restaurant they will run."
                action={
                  <CreateManagerDialog
                    restaurants={unassignedRestaurants}
                    onCreated={refresh}
                  />
                }
              />
            )
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Manager</Th>
                    <Th>Restaurant</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Created</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map((manager) => (
                    <Tr key={manager.id}>
                      <Td>
                        <span className="font-medium text-text">{manager.fullName}</span>
                        <span className="block truncate text-2xs text-muted">
                          {manager.email}
                        </span>
                      </Td>
                      <Td className="text-muted">
                        {manager.restaurant === null ? (
                          "—"
                        ) : (
                          <>
                            <span className="text-text">{manager.restaurant.name}</span>
                            <span className="block font-mono text-2xs text-subtle">
                              {manager.restaurant.slug}
                            </span>
                          </>
                        )}
                      </Td>
                      <Td>
                        {manager.isAssigned ? (
                          <Badge tone="success" dot>
                            Assigned
                          </Badge>
                        ) : (
                          <Badge tone="warning" dot>
                            Unassigned
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap text-muted">
                        {formatDate(manager.createdAtUtc)}
                      </Td>
                      <Td className="text-right">
                        <ManagerActionsDialog
                          manager={manager}
                          restaurants={restaurants}
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

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

function CreateManagerDialog({
  restaurants,
  onCreated,
}: {
  restaurants: RestaurantSummary[];
  onCreated: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRestaurantId("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createManager({
        fullName,
        email,
        password,
        ...(restaurantId === "" ? {} : { restaurantId }),
      });

      reset();
      setIsOpen(false);
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create manager.");
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
        <Button icon={<UserPlus />}>Create manager</Button>
      </DialogTrigger>

      <DialogContent
        title="Create manager"
        description="Creates a restaurant manager account. A restaurant can be assigned now or later."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field htmlFor="new-manager-name" label="Full name" required>
              <Input
                id="new-manager-name"
                required
                minLength={2}
                autoFocus
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>

            <Field htmlFor="new-manager-email" label="Email" required>
              <Input
                id="new-manager-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field
              htmlFor="new-manager-password"
              label="Temporary password"
              required
              hint="Any password you like. Tell them what you set, so they can sign in."
            >
              <PasswordInput
                id="new-manager-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={describedBy("new-manager-password", { hasHint: true })}
              />
            </Field>

            <Field
              htmlFor="new-manager-restaurant"
              label="Restaurant"
              hint={
                restaurants.length === 0
                  ? "Every restaurant already has a manager."
                  : "Only restaurants without a manager can be chosen."
              }
            >
              <Select
                id="new-manager-restaurant"
                value={restaurantId}
                onChange={(event) => setRestaurantId(event.target.value)}
                disabled={restaurants.length === 0}
                aria-describedby={describedBy("new-manager-restaurant", { hasHint: true })}
              >
                <option value="">Assign later</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create manager"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail and actions                                                         */
/* -------------------------------------------------------------------------- */

function ManagerActionsDialog({
  manager,
  restaurants,
  onChanged,
}: {
  manager: Manager;
  restaurants: RestaurantSummary[];
  onChanged: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState(manager.fullName);
  const [email, setEmail] = useState(manager.email);
  const [restaurantId, setRestaurantId] = useState(manager.restaurant?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"none" | "save" | "assign" | "unassign">("none");

  function reset() {
    setFullName(manager.fullName);
    setEmail(manager.email);
    setRestaurantId(manager.restaurant?.id ?? "");
    setError(null);
  }

  async function run(action: "save" | "assign" | "unassign", work: () => Promise<void>) {
    setError(null);
    setBusy(action);

    try {
      await work();
      await onChanged();
      setIsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy("none");
    }
  }

  // A manager can be moved to any restaurant that is free, plus the one they
  // already hold. Occupied restaurants are excluded rather than offered and then
  // rejected by the server.
  const selectable = restaurants.filter(
    (restaurant) =>
      restaurant.managerId === null || restaurant.managerId === manager.id,
  );

  const assignmentChanged = restaurantId !== (manager.restaurant?.id ?? "");

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

      <DialogContent title={manager.fullName} description={manager.email}>
        <div className="flex flex-col gap-5 px-4 py-4">
          {error !== null && <FormError message={error} />}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text">Current assignment</h3>
              {manager.isAssigned ? (
                <Badge tone="success" dot>
                  Assigned
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  Unassigned
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted">
              {manager.restaurant === null
                ? "This manager does not run a restaurant yet."
                : `Currently running ${manager.restaurant.name}.`}
            </p>

            <Field
              htmlFor={`assign-${manager.id}`}
              label="Restaurant"
              hint="Moving a manager releases their previous restaurant in the same step."
            >
              <Select
                id={`assign-${manager.id}`}
                value={restaurantId}
                onChange={(event) => setRestaurantId(event.target.value)}
                aria-describedby={describedBy(`assign-${manager.id}`, { hasHint: true })}
              >
                <option value="">No restaurant</option>
                {selectable.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!assignmentChanged || restaurantId === "" || busy !== "none"}
                onClick={() =>
                  void run("assign", () =>
                    assignManagerToRestaurant(manager.id, restaurantId).then(() => undefined),
                  )
                }
              >
                {busy === "assign"
                  ? "Saving…"
                  : manager.isAssigned
                    ? "Reassign"
                    : "Assign"}
              </Button>

              {manager.isAssigned && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy !== "none"}
                  onClick={() =>
                    void run("unassign", () =>
                      unassignManager(manager.id).then(() => undefined),
                    )
                  }
                >
                  {busy === "unassign" ? "Removing…" : "Unassign"}
                </Button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Account details</h3>

            <Field htmlFor={`name-${manager.id}`} label="Full name" required>
              <Input
                id={`name-${manager.id}`}
                required
                minLength={2}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>

            <Field htmlFor={`email-${manager.id}`} label="Email" required>
              <Input
                id={`email-${manager.id}`}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={
                busy !== "none" ||
                (fullName === manager.fullName && email === manager.email)
              }
              onClick={() =>
                void run("save", () =>
                  updateManager(manager.id, { fullName, email }).then(() => undefined),
                )
              }
            >
              {busy === "save" ? "Saving…" : "Save changes"}
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
