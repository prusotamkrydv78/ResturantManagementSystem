"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Store, Trash2, UserMinus, UserPlus } from "lucide-react";
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
  assignManagerToRestaurant,
  createManager,
  listManagers,
  unassignManager,
} from "@/features/managers/api";
import {
  createRestaurant,
  deleteRestaurant,
  getRestaurant,
  listRestaurants,
  updateRestaurant,
} from "@/features/restaurants/api";
import type { Manager } from "@/types/manager";
import type { RestaurantSummary } from "@/types/restaurant";

/**
 * Platform restaurant management: list, create, assign the initial manager.
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
  const [error, setError] = useState<string | null>(null);

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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const unassignedCount =
    restaurants?.filter((restaurant) => restaurant.managerEmail === null).length ?? 0;

  return (
    <>
      <PageHeader
        title="Restaurants"
        description="Create restaurants and assign the manager who will run each one."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Restaurants" }]}
        actions={<CreateRestaurantDialog onCreated={refresh} />}
      />

      <PageBody>
        {error !== null && restaurants === null ? (
          <Surface>
            <ErrorState message={error} onRetry={() => void refresh()} />
          </Surface>
        ) : (
          <Surface>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="text-sm text-muted">
                {restaurants === null
                  ? "Loading…"
                  : `${restaurants.length} ${restaurants.length === 1 ? "restaurant" : "restaurants"}`}
                {unassignedCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-warning">
                      {unassignedCount} awaiting a manager
                    </span>
                  </>
                )}
              </p>
            </div>

            {error !== null && (
              <ErrorState message={error} onRetry={() => void refresh()} />
            )}

            {restaurants === null ? (
              <TableSkeleton rows={4} columns={4} />
            ) : restaurants.length === 0 ? (
              <EmptyState
                icon={<Store />}
                title="No restaurants yet"
                description="Create the first restaurant, then assign someone to manage it."
                action={<CreateRestaurantDialog onCreated={refresh} />}
              />
            ) : (
              <RestaurantTable restaurants={restaurants} onChanged={refresh} />
            )}
          </Surface>
        )}
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function RestaurantTable({
  restaurants,
  onChanged,
}: {
  restaurants: RestaurantSummary[];
  onChanged: () => Promise<void>;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Restaurant</Th>
            <Th>Location</Th>
            <Th>Manager</Th>
            <Th className="text-right">Created</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((restaurant) => (
            <Tr key={restaurant.id}>
              <Td>
                <span className="font-medium text-text">{restaurant.name}</span>
                <span className="block font-mono text-2xs text-subtle">
                  {restaurant.slug}
                </span>
              </Td>
              <Td className="text-muted">{restaurant.city ?? "—"}</Td>
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
              <Td className="text-right whitespace-nowrap text-muted">
                {formatDate(restaurant.createdAtUtc)}
              </Td>
              <Td className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                  <EditRestaurantDialog
                    restaurant={restaurant}
                    onSaved={onChanged}
                  />
                  <DeleteRestaurantButton
                    restaurant={restaurant}
                    onDeleted={onChanged}
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

function CreateRestaurantDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setSlug("");
    setCity("");
    setContactEmail("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createRestaurant({
        name,
        // Omit blanks rather than sending empty strings, which would trip the
        // email and length validators on the API.
        ...(slug.trim() === "" ? {} : { slug: slug.trim() }),
        ...(city.trim() === "" ? {} : { city: city.trim() }),
        ...(contactEmail.trim() === "" ? {} : { contactEmail: contactEmail.trim() }),
      });

      reset();
      setIsOpen(false);
      await onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create restaurant.",
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
        <Button icon={<Plus />}>New restaurant</Button>
      </DialogTrigger>

      <DialogContent
        title="New restaurant"
        description="A manager can be assigned once the restaurant exists."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field htmlFor="restaurant-name" label="Name" required>
              <Input
                id="restaurant-name"
                required
                minLength={2}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field
              htmlFor="restaurant-slug"
              label="Slug"
              hint="Lower-case letters, digits and hyphens. Derived from the name when left blank."
            >
              <Input
                id="restaurant-slug"
                placeholder="derived from name"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                aria-describedby={describedBy("restaurant-slug", { hasHint: true })}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field htmlFor="restaurant-city" label="City">
                <Input
                  id="restaurant-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </Field>

              <Field htmlFor="restaurant-email" label="Contact email">
                <Input
                  id="restaurant-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create restaurant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
        <Button variant="secondary" size="sm" icon={<UserPlus />}>
          Assign
        </Button>
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
                    onChange={(event) => setUserId(event.target.value)}
                    disabled={availableManagers === null || availableManagers.length === 0}
                    aria-describedby={describedBy(`user-${restaurant.id}`, {
                      hasHint: true,
                    })}
                  >
                    <option value="">Select a manager</option>
                    {(availableManagers ?? []).map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.fullName} — {manager.email}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
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
        <Button variant="secondary" size="sm" icon={<Pencil />}>
          Edit
        </Button>
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
 * Delete a restaurant that was created by mistake.
 *
 * The refusal is the server's to make, so nothing is disabled here on a guess about
 * whether the restaurant has traded. A 409 comes back with the reason and it is shown
 * as-is.
 */
function DeleteRestaurantButton({
  restaurant,
  onDeleted,
}: {
  restaurant: RestaurantSummary;
  onDeleted: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    setError(null);
    setIsSubmitting(true);

    try {
      await deleteRestaurant(restaurant.id);
      setIsOpen(false);
      await onDeleted();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete the restaurant.",
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
        <Button variant="secondary" size="sm" icon={<Trash2 />}>
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent
        title={`Delete ${restaurant.name}?`}
        description="This cannot be undone."
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          {error !== null && <FormError message={error} />}
          <p className="text-sm text-muted">
            Only a restaurant that has never traded can be deleted, and only once its
            tables, staff, stock, customers and bookings are gone. Its menu goes with
            it. Anything else is refused with a reason.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="danger" disabled={isSubmitting} onClick={handleDelete}>
            {isSubmitting ? "Deleting…" : "Delete restaurant"}
          </Button>
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
        <Button variant="secondary" size="sm" icon={<UserMinus />}>
          Unassign
        </Button>
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
