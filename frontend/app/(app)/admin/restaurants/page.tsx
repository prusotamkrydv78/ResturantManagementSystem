"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useEffect, useState } from "react";
import {
  Ban,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Store,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
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
import { Tooltip } from "@/components/ui/tooltip";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils/cn";
import { RequireAuth } from "@/features/auth/require-auth";
import { getPlatformPulse } from "@/features/platform/api";
import { FilterChip } from "@/features/platform/filter-chip";
import { formatDate, money } from "@/features/platform/format";
import { sinceLabel, timeOf, useNow } from "@/features/platform/since";
import {
  assignManagerToRestaurant,
  createManager,
  listManagers,
  unassignManager,
} from "@/features/managers/api";
import {
  getRestaurant,
  listRestaurantStaff,
  listRestaurants,
  setRestaurantActive,
  updateRestaurant,
} from "@/features/restaurants/api";
import type { Manager } from "@/types/manager";
import type { PlatformPulse, PlatformPulseRestaurant } from "@/types/platform";
import type { RestaurantSummary } from "@/types/restaurant";
import type { StaffMember } from "@/types/staff";

/**
 * Platform restaurant management: the list, and what can be done to a restaurant
 * that already exists. Creating one lives on its own page, because a restaurant and
 * its first manager are made together and that does not fit a dialog.
 *
 * The role gate here shapes the UI only. Every request is independently
 * authorised by the API, which remains the security boundary.
 */
export default function AdminRestaurantsPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <AdminRestaurants />
    </RequireAuth>
  );
}

function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[] | null>(null);
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);
  const [pulseFailed, setPulseFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [sort, setSort] = useState<SortKey>("name");
  const now = useNow();

  const refresh = useCallback(async () => {
    try {
      const loaded = await listRestaurants();
      setRestaurants(loaded);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load restaurants.",
      );
    }

    // Trading is read separately and allowed to fail separately. It is the one call
    // on this page that touches every order and payment on the platform, and if it
    // ever gets slow the list still has to load: assigning a manager to a restaurant
    // that cannot trade must not depend on a figure about restaurants that can.
    try {
      setPulse(await getPlatformPulse());
      setPulseFailed(false);
    } catch {
      setPulseFailed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listRestaurants();
        if (!cancelled) {
          setRestaurants(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load restaurants.",
          );
        }
      }
    }

    async function loadPulse() {
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

    void load();
    void loadPulse();

    return () => {
      cancelled = true;
    };
  }, []);

  // One row is a restaurant's configuration and its day, joined here rather than on
  // the server. They come from two endpoints that answer two different questions and
  // are allowed to fail apart, so the join has to survive either half being missing.
  const live = new Map(
    (pulse?.restaurants ?? []).map((row) => [row.id, row] as const),
  );

  const rows: Row[] = (restaurants ?? []).map((restaurant) => ({
    restaurant,
    today: live.get(restaurant.id),
  }));

  // Searched first, then counted, then filtered. The counts on the chips describe
  // what the search has left, so narrowing the search narrows the numbers with it —
  // a chip reading "4 suspended" while the search shows two rows is a chip lying.
  const term = search.trim().toLowerCase();
  const searched =
    term === ""
      ? rows
      : rows.filter((row) =>
          [
            row.restaurant.name,
            row.restaurant.slug,
            row.restaurant.city ?? "",
            row.restaurant.managerName ?? "",
            row.restaurant.managerEmail ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
        );

  const counts: Record<StatusFilter, number> = {
    All: searched.length,
    Trading: searched.filter((row) => matches(row, "Trading")).length,
    Quiet: searched.filter((row) => matches(row, "Quiet")).length,
    Unassigned: searched.filter((row) => matches(row, "Unassigned")).length,
    Suspended: searched.filter((row) => matches(row, "Suspended")).length,
  };

  const filtered = searched.filter((row) => matches(row, status));

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "busiest") {
      return (
        (b.today?.takingsToday ?? 0) - (a.today?.takingsToday ?? 0) ||
        (b.today?.ordersToday ?? 0) - (a.today?.ordersToday ?? 0) ||
        a.restaurant.name.localeCompare(b.restaurant.name)
      );
    }

    if (sort === "quietest") {
      // Never traded sorts first, because timeOf returns 0 for a missing date and
      // a restaurant nobody has ever ordered from is the longest silence there is.
      return (
        timeOf(a.today?.lastOrderAtUtc ?? "") - timeOf(b.today?.lastOrderAtUtc ?? "") ||
        a.restaurant.name.localeCompare(b.restaurant.name)
      );
    }

    return a.restaurant.name.localeCompare(b.restaurant.name);
  });

  return (
    <>
      <PageHeader
        title="Restaurants"
        description="Create restaurants and assign the manager who will run each one."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Restaurants" }]}
        actions={
          <LinkButton href="/admin/restaurants/new" icon={<Plus />}>
            New restaurant
          </LinkButton>
        }
      />

      <PageBody>
        {error !== null && restaurants === null ? (
          <Surface>
            <ErrorState message={error} onRetry={() => void refresh()} />
          </Surface>
        ) : (
          <Surface>
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative sm:max-w-xs sm:flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    id="restaurant-search"
                    type="search"
                    placeholder="Search name, slug, city or manager"
                    className="pl-8"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search restaurants"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    id="restaurant-sort"
                    className="sm:w-44"
                    value={sort}
                    onChange={(next) => setSort(next as SortKey)}
                    aria-label="Sort restaurants"
                    options={[
                      { value: "name", label: "By name" },
                      { value: "busiest", label: "Busiest today" },
                      { value: "quietest", label: "Quiet longest" },
                    ]}
                  />
                </div>
              </div>

              {/* Chips rather than a second dropdown, unlike the managers list next
                  door. The difference is the numbers: on this page how many
                  restaurants are trading, silent, unstaffed or suspended is the news
                  an operator came for, so the control that filters by it is also the
                  summary of it. A dropdown would hide four figures behind a click. */}
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.value}
                    active={status === filter.value}
                    count={counts[filter.value]}
                    tone={filter.tone}
                    onClick={() => setStatus(filter.value)}
                  >
                    {filter.label}
                  </FilterChip>
                ))}
              </div>

              {pulseFailed && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <TriangleAlert
                    className="size-3.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  Today&rsquo;s trading could not be read, so the last three columns
                  are blank. Everything else on this page still works.
                </p>
              )}
            </div>

            {error !== null && (
              <ErrorState message={error} onRetry={() => void refresh()} />
            )}

            {restaurants === null ? (
              <TableSkeleton rows={4} columns={6} />
            ) : restaurants.length === 0 ? (
              <EmptyState
                icon={<Store />}
                title="No restaurants yet"
                description="Create the first restaurant and hand it to a manager in one step."
                action={
                  <LinkButton href="/admin/restaurants/new" icon={<Plus />}>
                    New restaurant
                  </LinkButton>
                }
              />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title="No restaurants match"
                description="Try a different search term, or a different filter."
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
              <RestaurantTable rows={sorted} now={now} onChanged={refresh} />
            )}
          </Surface>
        )}
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

type StatusFilter = "All" | "Trading" | "Quiet" | "Unassigned" | "Suspended";
type SortKey = "name" | "busiest" | "quietest";

/** A restaurant and, when the pulse answered, what it has done today. */
interface Row {
  restaurant: RestaurantSummary;
  today: PlatformPulseRestaurant | undefined;
}

const FILTERS: {
  value: StatusFilter;
  label: string;
  tone: "neutral" | "warning" | "danger";
}[] = [
  { value: "All", label: "All", tone: "neutral" },
  { value: "Trading", label: "Trading today", tone: "neutral" },
  { value: "Quiet", label: "Quiet today", tone: "neutral" },
  { value: "Unassigned", label: "Awaiting a manager", tone: "warning" },
  { value: "Suspended", label: "Suspended", tone: "danger" },
];

/**
 * Whether a row belongs in a bucket.
 *
 * The buckets overlap on purpose and are not a status field. A suspended restaurant
 * with no manager is in two of them, because an admin looking for either would
 * expect to find it, and inventing a single winning state would hide it from one of
 * the two searches that were going to be run.
 */
function matches(row: Row, filter: StatusFilter): boolean {
  const { restaurant, today } = row;

  switch (filter) {
    case "Trading":
      return today !== undefined && (today.ordersToday > 0 || today.openOrders > 0);
    case "Quiet":
      return (
        restaurant.isActive &&
        restaurant.managerId !== null &&
        today !== undefined &&
        today.ordersToday === 0 &&
        today.openOrders === 0
      );
    case "Unassigned":
      return restaurant.managerId === null;
    case "Suspended":
      return !restaurant.isActive;
    default:
      return true;
  }
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function RestaurantTable({
  rows,
  now,
  onChanged,
}: {
  rows: Row[];
  now: number | null;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();

  /**
   * Open the restaurant this row is about.
   *
   * A convenience on top of the link in the name cell, not a replacement for it. The
   * link is what makes the row reachable by keyboard, and what lets a middle click
   * open a restaurant in a new tab while the list stays where it is; neither is
   * something a click handler can offer. This only catches the other nine times out
   * of ten, when somebody clicks the row because the whole row is what they see.
   *
   * Two things it deliberately refuses. A click that landed on a control keeps that
   * control's meaning - suspending a restaurant should not also navigate away from
   * the confirmation. And a click that ends a text selection is somebody copying a
   * slug, not somebody asking to leave the page.
   */
  function open(event: React.MouseEvent<HTMLTableRowElement>, id: string) {
    if ((event.target as HTMLElement).closest("a, button, input, select, label")) {
      return;
    }

    if ((window.getSelection()?.toString() ?? "") !== "") {
      return;
    }

    router.push(`/admin/restaurants/${id}`);
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Restaurant</Th>
            <Th>Manager</Th>
            <Th className="text-right">Today</Th>
            <Th className="text-right">Now</Th>
            <Th className="text-right">Last order</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ restaurant, today }) => (
            <Tr
              key={restaurant.id}
              className="cursor-pointer"
              onClick={(event) => open(event, restaurant.id)}
            >
              <Td>
                <div className="flex items-center gap-2">
                  {/* The name is the way in. Everything this row summarises has a
                      fuller answer one click away, and a table of restaurants where
                      nothing is clickable makes a reader hunt for the verb. */}
                  <Link
                    href={`/admin/restaurants/${restaurant.id}`}
                    className="rounded font-medium text-text hover:text-primary hover:underline"
                  >
                    {restaurant.name}
                  </Link>
                  {/* Against the name rather than in the manager column: a suspended
                      restaurant is not trading at all, which outranks who runs it. */}
                  {!restaurant.isActive && (
                    <Badge tone="danger" dot>
                      Suspended
                    </Badge>
                  )}
                </div>
                {/* The slug and the city on one line. The slug is what appears in a
                    guest's URL, the city is how a person says which restaurant they
                    mean, and neither deserves a column of its own. */}
                <span className="block text-2xs text-subtle">
                  <span className="font-mono">{restaurant.slug}</span>
                  {restaurant.city !== null && ` · ${restaurant.city}`}
                </span>
              </Td>
              <Td>
                {restaurant.managerId === null ? (
                  <Badge tone="warning" dot>
                    Unassigned
                  </Badge>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text">{restaurant.managerName}</span>
                    <span className="truncate text-2xs text-muted">
                      {restaurant.managerEmail}
                    </span>
                  </div>
                )}
              </Td>

              {/* What it took today, and what is running right now.

                  This column is the whole reason the page changed. It used to end on
                  the date the restaurant was created, which answers a question
                  nobody asks twice; whether a restaurant is trading is the question
                  an operator has every single day, and this was the one screen
                  listing every restaurant that could not answer it. */}
              <Td className="text-right whitespace-nowrap">
                {today === undefined ? (
                  <span className="text-subtle">—</span>
                ) : today.ordersToday === 0 ? (
                  <span className="text-subtle">—</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="tabular font-medium text-text">
                      {money(today.takingsToday)}
                    </span>
                    <span className="tabular text-2xs text-muted">
                      {today.ordersToday}{" "}
                      {today.ordersToday === 1 ? "order" : "orders"}
                    </span>
                  </div>
                )}
              </Td>

              <Td className="text-right whitespace-nowrap">
                {today === undefined ||
                (today.openOrders === 0 && today.platesAtPass === 0) ? (
                  <span className="text-subtle">—</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="tabular text-text">
                      {today.openOrders} open
                    </span>
                    {today.platesAtPass > 0 && (
                      <span className="tabular text-2xs text-warning">
                        {today.platesAtPass} at the pass
                      </span>
                    )}
                  </div>
                )}
              </Td>

              <Td className="text-right whitespace-nowrap text-muted">
                {today === undefined ? (
                  <span className="text-subtle">—</span>
                ) : (
                  <span title={`Created ${formatDate(restaurant.createdAtUtc)}`}>
                    {sinceLabel(today.lastOrderAtUtc, now)}
                  </span>
                )}
              </Td>

              {/* Icon only, with a tooltip and a label for anything that is not a
                  pointer. Four buttons carrying their own words pushed the table
                  past the width of the window the moment the trading columns
                  arrived, and the words were the part that could be given back. */}
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {restaurant.managerId === null ? (
                    <AssignManagerDialog
                      restaurant={restaurant}
                      onAssigned={onChanged}
                    />
                  ) : (
                    <UnassignManagerButton
                      restaurant={restaurant}
                      onUnassigned={onChanged}
                    />
                  )}
                  <RestaurantStaffDialog restaurant={restaurant} />
                  <EditRestaurantDialog restaurant={restaurant} onSaved={onChanged} />
                  <RestaurantStatusButton
                    restaurant={restaurant}
                    onChanged={onChanged}
                  />
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

/**
 * One icon button in a row of them.
 *
 * The words came off these four buttons when the trading columns went on. What the
 * words were doing is still done: the tooltip says it to a pointer, the aria-label
 * says it to everything else, and the label is the long form - "Suspend JanakHotel",
 * not "Suspend" - because a screen reader moving through a table of forty rows has
 * no column header to tell it which restaurant this button belongs to.
 *
 * Forwarded, because Radix passes the trigger props through asChild and drops them
 * on the floor if the child cannot take a ref.
 */
const RowAction = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    tip: string;
    tone?: "neutral" | "danger";
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function RowAction(
  { label, tip, tone = "neutral", className, children, ...rest },
  ref,
) {
  return (
    <Tooltip content={tip} side="top">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...rest}
        // Merged rather than replaced: asChild hands the trigger its own classes
        // through this prop, and overwriting them takes the open state with it.
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md border border-border",
          "text-muted transition-colors [&_svg]:size-4",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          tone === "danger"
            ? "hover:border-danger-border hover:bg-danger-soft hover:text-danger"
            : "hover:bg-surface-3 hover:text-text",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
});


/* -------------------------------------------------------------------------- */
/* Assign manager                                                             */
/* -------------------------------------------------------------------------- */

function AssignManagerDialog({
  restaurant,
  onAssigned,
}: {
  restaurant: RestaurantSummary;
  onAssigned: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [availableManagers, setAvailableManagers] = useState<Manager[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load the pool of free managers when the dialog opens, so the picker never
  // offers someone who already runs a restaurant.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const loaded = await listManagers({ status: "Unassigned" });
        if (!cancelled) {
          setAvailableManagers(loaded);
        }
      } catch {
        if (!cancelled) {
          setAvailableManagers([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  function reset() {
    setMode("create");
    setFullName("");
    setEmail("");
    setPassword("");
    setUserId("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Two calls rather than one endpoint that branches on the payload. The dialog
      // already knows which mode it is in, so the choice belongs here; the server
      // used to infer it from which fields were present, which meant the assignment
      // rules had a second doorway into them.
      if (mode === "create") {
        await createManager({
          fullName,
          email,
          password,
          restaurantId: restaurant.id,
        });
      } else {
        await assignManagerToRestaurant(userId.trim(), restaurant.id);
      }

      reset();
      setIsOpen(false);
      await onAssigned();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to assign the manager.",
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
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <RowAction label={`Assign a manager to ${restaurant.name}`} tip="Assign a manager">
          <UserPlus />
        </RowAction>
      </DialogTrigger>

      <DialogContent
        title="Assign a manager"
        description={`${restaurant.name} will be run by this person.`}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-text">
                Where does the manager come from?
              </legend>

              <ModeOption
                name={`mode-${restaurant.id}`}
                checked={mode === "create"}
                onSelect={() => setMode("create")}
                autoFocus
                title="Create a new account"
                detail="Sets up login details for someone who is not registered yet."
              />
              <ModeOption
                name={`mode-${restaurant.id}`}
                checked={mode === "existing"}
                onSelect={() => setMode("existing")}
                title="Promote an existing user"
                detail="Uses an account that already exists on the platform."
              />
            </fieldset>

            {mode === "create" ? (
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <Field htmlFor={`name-${restaurant.id}`} label="Full name" required>
                  <Input
                    id={`name-${restaurant.id}`}
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </Field>

                <Field htmlFor={`email-${restaurant.id}`} label="Email" required>
                  <Input
                    id={`email-${restaurant.id}`}
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>

                <Field
                  htmlFor={`password-${restaurant.id}`}
                  label="Temporary password"
                  required
                  hint="Any password you like. Tell them what you set, so they can sign in."
                >
                  <PasswordInput
                    id={`password-${restaurant.id}`}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={describedBy(`password-${restaurant.id}`, {
                      hasHint: true,
                    })}
                  />
                </Field>
              </div>
            ) : (
              <div className="border-t border-border pt-4">
                <Field
                  htmlFor={`user-${restaurant.id}`}
                  label="Manager"
                  required
                  hint={
                    availableManagers === null
                      ? "Loading managers…"
                      : availableManagers.length === 0
                        ? "Every manager already runs a restaurant. Create a new one instead."
                        : "Only managers without a restaurant are listed."
                  }
                >
                  <Select
                    id={`user-${restaurant.id}`}
                    required
                    value={userId}
                    onChange={setUserId}
                    disabled={availableManagers === null || availableManagers.length === 0}
                    aria-describedby={describedBy(`user-${restaurant.id}`, {
                      hasHint: true,
                    })}
                    options={[
                      { value: "", label: "Select a manager" },
                      ...(availableManagers ?? []).map((manager) => ({
                        value: manager.id,
                        label: `${manager.fullName} — ${manager.email}`,
                      })),
                    ]}
                  />
                </Field>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            {/* Guarded here rather than by the browser. The dropdown is no longer a
                native control, so a required attribute has nothing to block on. */}
            <Button type="submit" disabled={isSubmitting || userId === ""}>
              {isSubmitting ? "Assigning…" : "Assign manager"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Removes the current manager.
 *
 * Changing who runs a restaurant is deliberately two explicit steps from here:
 * unassign, then assign. Moving a manager between restaurants in one atomic step
 * is done from the Managers page, where the server handles it in a single call.
 */
/**
 * Edit any restaurant, including its slug.
 *
 * The list row carries only a summary, so the full record is fetched when the dialog
 * opens rather than kept in the table. Editing a field the form never showed would
 * otherwise blank it: the API takes a whole object, not a patch.
 */
function EditRestaurantDialog({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantSummary;
  onSaved: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [city, setCity] = useState(restaurant.city ?? "");
  const [country, setCountry] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const full = await getRestaurant(restaurant.id);

        if (cancelled) return;

        setName(full.name);
        setSlug(full.slug);
        setCity(full.city ?? "");
        setCountry(full.country ?? "");
        setAddressLine(full.addressLine ?? "");
        setContactEmail(full.contactEmail ?? "");
        setContactPhone(full.contactPhone ?? "");
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the restaurant.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, restaurant.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await updateRestaurant(restaurant.id, {
        name: name.trim(),
        // Only sent when it actually differs. The slug is what guest ordering links
        // are built from, so an unchanged value is left out entirely rather than
        // re-submitted.
        ...(slug.trim() === restaurant.slug ? {} : { slug: slug.trim() }),
        // Blanks are cleared rather than omitted here: unlike create, an edit that
        // empties a field means the field should end up empty.
        city: blankToNull(city),
        country: blankToNull(country),
        addressLine: blankToNull(addressLine),
        contactEmail: blankToNull(contactEmail),
        contactPhone: blankToNull(contactPhone),
      });

      setIsOpen(false);
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save the restaurant.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <RowAction label={`Edit ${restaurant.name}`} tip="Edit">
          <Pencil />
        </RowAction>
      </DialogTrigger>

      <DialogContent
        title={`Edit ${restaurant.name}`}
        description="Changing the slug breaks any guest ordering link already handed out."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field htmlFor={`edit-name-${restaurant.id}`} label="Name" required>
              <Input
                id={`edit-name-${restaurant.id}`}
                required
                minLength={2}
                autoFocus
                disabled={isLoading}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field
              htmlFor={`edit-slug-${restaurant.id}`}
              label="Slug"
              hint="Unique across the whole platform."
            >
              <Input
                id={`edit-slug-${restaurant.id}`}
                disabled={isLoading}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                aria-describedby={describedBy(`edit-slug-${restaurant.id}`, {
                  hasHint: true,
                })}
              />
            </Field>

            <Field htmlFor={`edit-address-${restaurant.id}`} label="Address">
              <Input
                id={`edit-address-${restaurant.id}`}
                disabled={isLoading}
                value={addressLine}
                onChange={(event) => setAddressLine(event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field htmlFor={`edit-city-${restaurant.id}`} label="City">
                <Input
                  id={`edit-city-${restaurant.id}`}
                  disabled={isLoading}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </Field>

              <Field htmlFor={`edit-country-${restaurant.id}`} label="Country">
                <Input
                  id={`edit-country-${restaurant.id}`}
                  disabled={isLoading}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </Field>

              <Field htmlFor={`edit-email-${restaurant.id}`} label="Contact email">
                <Input
                  id={`edit-email-${restaurant.id}`}
                  type="email"
                  disabled={isLoading}
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </Field>

              <Field htmlFor={`edit-phone-${restaurant.id}`} label="Contact phone">
                <Input
                  id={`edit-phone-${restaurant.id}`}
                  disabled={isLoading}
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Empty input means "clear this field", which the API expects as null. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Suspend or restore a restaurant.
 *
 * This is how a restaurant leaves service; there is no delete. The confirmation spells
 * out what suspending does and does not do, because "suspended" on its own reads as
 * harsher than it is: nobody is locked out and nothing in the kitchen is abandoned.
 */
function RestaurantStatusButton({
  restaurant,
  onChanged,
}: {
  restaurant: RestaurantSummary;
  onChanged: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suspending = restaurant.isActive;

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);

    try {
      await setRestaurantActive(restaurant.id, { isActive: !restaurant.isActive });
      setIsOpen(false);
      await onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to change the restaurant status.",
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
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <RowAction
          label={`${suspending ? "Suspend" : "Restore"} ${restaurant.name}`}
          tip={suspending ? "Suspend" : "Restore"}
          tone={suspending ? "danger" : "neutral"}
        >
          {suspending ? <Ban /> : <RotateCcw />}
        </RowAction>
      </DialogTrigger>

      <DialogContent
        title={
          suspending ? `Suspend ${restaurant.name}?` : `Restore ${restaurant.name}?`
        }
        description={
          suspending
            ? "It will stop taking new orders."
            : "It will be able to take orders again."
        }
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          {error !== null && <FormError message={error} />}

          {suspending ? (
            <>
              <p className="text-sm text-muted">
                No waiter will be able to open an order and the guest QR links will
                stop working.
              </p>
              <p className="text-sm text-muted">
                Everything already running still finishes: open orders take items, go
                to the kitchen and settle as normal. Nobody is signed out, so the
                manager and staff can still close the night and read their history.
                Nothing is deleted, and this can be undone at any time.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Waiters will be able to open orders again and the guest QR links will
              start working.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant={suspending ? "danger" : "primary"}
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting
              ? "Saving…"
              : suspending
                ? "Suspend restaurant"
                : "Restore restaurant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The roster of one restaurant, read-only.
 *
 * No add, edit or suspend here even though the Super Admin can reach the accounts:
 * the manager works with these people and owns the roster. Two parties editing the
 * same list is how it stops being clear who hired whom.
 */
function RestaurantStaffDialog({ restaurant }: { restaurant: RestaurantSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setStaff(null);
      setError(null);

      try {
        const loaded = await listRestaurantStaff(restaurant.id);

        if (!cancelled) setStaff(loaded);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the staff.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, restaurant.id]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <RowAction label={`Staff at ${restaurant.name}`} tip="Staff">
          <Users />
        </RowAction>
      </DialogTrigger>

      <DialogContent
        title={`Staff at ${restaurant.name}`}
        description="Read-only. The manager of this restaurant hires and suspends."
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          {error !== null && <FormError message={error} />}

          {staff === null && error === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : staff !== null && staff.length === 0 ? (
            <p className="text-sm text-muted">
              Nobody has been added yet. Until a waiter and a chef exist, this
              restaurant cannot take an order or cook one.
            </p>
          ) : (
            staff !== null && (
              <ul className="flex flex-col divide-y divide-border">
                {staff.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-text">
                        {member.fullName}
                      </span>
                      <span className="block truncate text-2xs text-muted">
                        {member.email}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="neutral">{member.role}</Badge>
                      {member.isActive ? (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="danger" dot>
                          Suspended
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
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

function UnassignManagerButton({
  restaurant,
  onUnassigned,
}: {
  restaurant: RestaurantSummary;
  onUnassigned: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUnassign() {
    setError(null);
    setIsSubmitting(true);

    try {
      await unassignManager(restaurant.managerId!);
      setIsOpen(false);
      await onUnassigned();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to remove the manager.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <RowAction
          label={`Remove ${restaurant.managerName} from ${restaurant.name}`}
          tip="Remove the manager"
        >
          <UserMinus />
        </RowAction>
      </DialogTrigger>

      <DialogContent
        title="Remove the manager?"
        description={`${restaurant.managerName} will no longer run ${restaurant.name}.`}
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          {error !== null && <FormError message={error} />}
          <p className="text-sm text-muted">
            The account stays active and can be assigned to another restaurant. The
            restaurant stays active with no manager.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="danger" disabled={isSubmitting} onClick={handleUnassign}>
            {isSubmitting ? "Removing…" : "Remove manager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A radio presented as a selectable row, so the choice is easy to hit. */
function ModeOption({
  name,
  checked,
  onSelect,
  title,
  detail,
  autoFocus = false,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  autoFocus?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
        checked
          ? "border-primary-border bg-primary-soft"
          : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        autoFocus={autoFocus}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}
