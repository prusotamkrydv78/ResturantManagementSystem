"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, TriangleAlert, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { getPlatformPulse } from "@/features/platform/api";
import { FilterChip } from "@/features/platform/filter-chip";
import { formatDate, money } from "@/features/platform/format";
import { sinceLabel, timeOf, useNow } from "@/features/platform/since";
import { createManager, listManagers } from "@/features/managers/api";
import { listRestaurants } from "@/features/restaurants/api";
import type { Manager } from "@/types/manager";
import type { PlatformPulse, PlatformPulseRestaurant } from "@/types/platform";
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
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);
  const [pulseFailed, setPulseFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<ManagerBucket>("All");
  const [sort, setSort] = useState<ManagerSort>("name");
  const now = useNow();
  const router = useRouter();

  const load = useCallback(async (term: string) => {
    try {
      const [loadedManagers, loadedRestaurants] = await Promise.all([
        listManagers({ search: term, status: "All" }),
        listRestaurants(),
      ]);
      setManagers(loadedManagers);
      setRestaurants(loadedRestaurants);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load managers.");
    }

    try {
      setPulse(await getPlatformPulse());
      setPulseFailed(false);
    } catch {
      setPulseFailed(true);
    }
  }, []);

  // Search still goes to the server, so it covers every manager rather than only the
  // rows already downloaded. The buckets below are worked out here instead, for two
  // reasons: the endpoint has no filter for a suspended account, which is the bucket
  // most worth having, and counting on the client is what lets each chip carry its
  // own figure. The endpoint returns the whole list either way.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [loadedManagers, loadedRestaurants] = await Promise.all([
          listManagers({ search, status: "All" }),
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
  }, [search]);

  // Trading is read once and separately. It decorates this page rather than driving
  // it: a manager who cannot be found is a problem whether or not their restaurant's
  // takings loaded.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const loaded = await getPlatformPulse();
        if (!cancelled) {
          setPulse(loaded);
          setPulseFailed(false);
        }
      } catch {
        if (!cancelled) {
          setPulseFailed(true);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => load(search), [load, search]);

  /**
   * Open the manager this row is about.
   *
   * A convenience over the Manage button, not a replacement: the button is what makes
   * the row reachable by keyboard and what opens a manager in a new tab on a middle
   * click. This catches the other nine times out of ten.
   *
   * A click that landed on a control keeps that control meaning - the restaurant link
   * in the middle of the row goes to the restaurant, not to the manager - and a click
   * that ends a text selection is somebody copying an email address.
   */
  function open(event: React.MouseEvent<HTMLTableRowElement>, managerId: string) {
    if ((event.target as HTMLElement).closest("a, button, input, select, label")) {
      return;
    }

    if ((window.getSelection()?.toString() ?? "") !== "") {
      return;
    }

    router.push(`/admin/managers/${managerId}`);
  }

  const unassignedRestaurants = restaurants.filter(
    (restaurant) => restaurant.managerId === null,
  );

  const live = new Map(
    (pulse?.restaurants ?? []).map((row) => [row.id, row] as const),
  );

  const rows: ManagerRow[] = (managers ?? []).map((manager) => ({
    manager,
    today:
      manager.restaurant === null ? undefined : live.get(manager.restaurant.id),
  }));

  const counts: Record<ManagerBucket, number> = {
    All: rows.length,
    Assigned: rows.filter((row) => inBucket(row, "Assigned")).length,
    Unassigned: rows.filter((row) => inBucket(row, "Unassigned")).length,
    Suspended: rows.filter((row) => inBucket(row, "Suspended")).length,
  };

  const filtered = rows.filter((row) => inBucket(row, bucket));

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "busiest") {
      return (
        (b.today?.takingsToday ?? 0) - (a.today?.takingsToday ?? 0) ||
        a.manager.fullName.localeCompare(b.manager.fullName)
      );
    }

    if (sort === "newest") {
      return (
        timeOf(b.manager.createdAtUtc) - timeOf(a.manager.createdAtUtc) ||
        a.manager.fullName.localeCompare(b.manager.fullName)
      );
    }

    return a.manager.fullName.localeCompare(b.manager.fullName);
  });

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
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                id="manager-sort"
                className="sm:w-48"
                value={sort}
                onChange={(next) => setSort(next as ManagerSort)}
                aria-label="Sort managers"
                options={[
                  { value: "name", label: "By name" },
                  { value: "busiest", label: "Busiest restaurant" },
                  { value: "newest", label: "Recently added" },
                ]}
              />
            </div>

            {/* The same chips as the restaurants list, and for the same reason: how
                many managers are unstaffed or locked out is the news, and a dropdown
                hides three figures behind a click. It also gains a bucket the old
                dropdown could not offer at all - a suspended manager cannot sign in,
                and there was no way to ask which ones those were. */}
            <div className="flex flex-wrap gap-1.5">
              {MANAGER_BUCKETS.map((option) => (
                <FilterChip
                  key={option.value}
                  active={bucket === option.value}
                  count={counts[option.value]}
                  tone={option.tone}
                  onClick={() => setBucket(option.value)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>

            {pulseFailed && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <TriangleAlert
                  className="size-3.5 shrink-0 text-warning"
                  aria-hidden="true"
                />
                Today&rsquo;s trading could not be read, so the last two columns are
                blank. Everything else on this page still works.
              </p>
            )}
          </div>

          {error !== null && <ErrorState message={error} onRetry={() => void refresh()} />}

          {managers === null ? (
            <TableSkeleton rows={5} columns={5} />
          ) : managers.length === 0 && search.trim() === "" ? (
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
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No managers match"
              description="Try a different search term, or a different filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setBucket("All");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Manager</Th>
                    <Th>Restaurant</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Their day</Th>
                    <Th className="text-right">Last order</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ manager, today }) => (
                    <Tr
                      key={manager.id}
                      className="cursor-pointer"
                      onClick={(event) => open(event, manager.id)}
                    >
                      <Td>
                        <span className="font-medium text-text">{manager.fullName}</span>
                        <span className="block truncate text-2xs text-muted">
                          {manager.email}
                        </span>
                      </Td>

                      {/* The restaurant is the link, and only the restaurant.

                          The row is about a manager, and a manager has no page of
                          their own - almost everything worth knowing about one is
                          their restaurant, which does. Making the whole row jump to
                          a different subject would be a surprise; making the name of
                          that subject a link is just a link. */}
                      <Td className="text-muted">
                        {manager.restaurant === null ? (
                          <span className="text-subtle">—</span>
                        ) : (
                          <>
                            <Link
                              href={`/admin/restaurants/${manager.restaurant.id}`}
                              className="rounded text-text hover:text-primary hover:underline"
                            >
                              {manager.restaurant.name}
                            </Link>
                            <span className="block font-mono text-2xs text-subtle">
                              {manager.restaurant.slug}
                            </span>
                          </>
                        )}
                      </Td>

                      <Td>
                        {/* Suspension outranks assignment: a suspended account cannot
                            sign in, so saying only "Assigned" would be misleading. */}
                        {!manager.isActive ? (
                          <Badge tone="danger" dot>
                            Suspended
                          </Badge>
                        ) : manager.isAssigned ? (
                          <Badge tone="success" dot>
                            Assigned
                          </Badge>
                        ) : (
                          <Badge tone="warning" dot>
                            Unassigned
                          </Badge>
                        )}
                      </Td>

                      {/* What their restaurant has done today.

                          The column this replaces was the date the account was
                          created, which is worth knowing once. Whether the room this
                          person runs is taking money is worth knowing every day, and
                          it is the only thing on this screen that says anything about
                          how the job is going. */}
                      <Td className="text-right whitespace-nowrap">
                        {today === undefined || today.ordersToday === 0 ? (
                          <span className="text-subtle">—</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="tabular font-medium text-text">
                              {money(today.takingsToday)}
                            </span>
                            <span className="tabular text-2xs text-muted">
                              {today.ordersToday}{" "}
                              {today.ordersToday === 1 ? "order" : "orders"}
                              {today.openOrders > 0 && ` · ${today.openOrders} open`}
                            </span>
                          </div>
                        )}
                      </Td>

                      <Td className="text-right whitespace-nowrap text-muted">
                        {today === undefined ? (
                          <span className="text-subtle">—</span>
                        ) : (
                          <span
                            title={`Account created ${formatDate(manager.createdAtUtc)}`}
                          >
                            {sinceLabel(today.lastOrderAtUtc, now)}
                          </span>
                        )}
                      </Td>

                      <Td className="text-right">
                        <LinkButton
                          href={`/admin/managers/${manager.id}`}
                          variant="secondary"
                          size="sm"
                          icon={<Pencil />}
                        >
                          Manage
                        </LinkButton>
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

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

type ManagerBucket = "All" | "Assigned" | "Unassigned" | "Suspended";
type ManagerSort = "name" | "busiest" | "newest";

/** A manager and, when the pulse answered, what their restaurant has done today. */
interface ManagerRow {
  manager: Manager;
  today: PlatformPulseRestaurant | undefined;
}

const MANAGER_BUCKETS: {
  value: ManagerBucket;
  label: string;
  tone: "neutral" | "warning" | "danger";
}[] = [
  { value: "All", label: "All", tone: "neutral" },
  { value: "Assigned", label: "Running a restaurant", tone: "neutral" },
  { value: "Unassigned", label: "Unassigned", tone: "warning" },
  { value: "Suspended", label: "Suspended", tone: "danger" },
];

/**
 * Whether a manager belongs in a bucket.
 *
 * Suspended overlaps the other two on purpose. An account that cannot sign in is
 * still assigned to whatever restaurant it holds - that is exactly the situation
 * worth finding - so it appears under both rather than being quietly moved out of
 * the count an admin was reading.
 */
function inBucket(row: ManagerRow, bucket: ManagerBucket): boolean {
  switch (bucket) {
    case "Assigned":
      return row.manager.isAssigned;
    case "Unassigned":
      return !row.manager.isAssigned;
    case "Suspended":
      return !row.manager.isActive;
    default:
      return true;
  }
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
                onChange={setRestaurantId}
                disabled={restaurants.length === 0}
                aria-describedby={describedBy("new-manager-restaurant", { hasHint: true })}
                options={[
                  { value: "", label: "Assign later" },
                  ...restaurants.map((restaurant) => ({
                    value: restaurant.id,
                    label: restaurant.name,
                  })),
                ]}
              />
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
