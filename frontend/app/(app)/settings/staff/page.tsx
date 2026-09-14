"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardGrid, CardGridSkeleton } from "@/components/ui/card-grid";
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
import { Choice } from "@/components/ui/choice";
import { PasswordInput } from "@/components/ui/password-input";
import { Surface } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { createStaff, listStaff } from "@/features/staff/api";
import { ApiError } from "@/lib/api/client";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { STAFF_ROLES } from "@/types/staff";
import type { StaffMember, StaffRole } from "@/types/staff";

/**
 * Staff roster for the signed-in manager restaurant.
 *
 * The role gate shapes the UI only; the API independently rejects anyone who is
 * not a restaurant manager, and scopes every result to their own restaurant.
 */
export default function StaffPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <StaffRoster />
    </RequireAuth>
  );
}

function StaffRoster() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    try {
      const loaded = await listStaff(search);
      setStaff(loaded);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load staff.");
    }
  }, [search]);

  // Searching goes back to the server, so it covers the whole roster rather than
  // only the rows already downloaded.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listStaff(search);
        if (!cancelled) {
          setStaff(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load staff.");
        }
      }
    }

    const timer = setTimeout(() => void load(), 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const activeCount = staff?.filter((member) => member.isActive).length ?? 0;
  const isSearching = search.trim() !== "";

  return (
    <>
      <PageHeader
        title="Staff"
        description="The people working in your restaurant, and what they do."
        actions={<CreateStaffDialog onCreated={refresh} />}
      />

      <PageBody>
        <Surface>
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <Input
                id="staff-search"
                type="search"
                placeholder="Search name or email"
                className="pl-8"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search staff"
              />
            </div>

            <p className="text-sm text-muted">
              {staff === null
                ? "Loading…"
                : `${staff.length} ${staff.length === 1 ? "person" : "people"}`}
              {staff !== null && staff.length > activeCount && (
                <> · {staff.length - activeCount} inactive</>
              )}
            </p>
          </div>

          {error !== null && <ErrorState message={error} onRetry={() => void refresh()} />}

          {staff === null ? (
            <CardGridSkeleton count={10} />
          ) : staff.length === 0 ? (
            isSearching ? (
              <EmptyState
                icon={<Search />}
                title="Nobody matches"
                description="Try a different name or email."
                action={
                  <Button variant="secondary" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users />}
                title="No staff yet"
                description="Add the people who work here. Each one gets their own login."
                action={<CreateStaffDialog onCreated={refresh} />}
              />
            )
          ) : (
            <CardGrid>
              {staff.map((member) => (
                <Card
                  key={member.id}
                  className={member.isActive ? "p-3.5" : "p-3.5 opacity-70"}
                >
                  <div className="flex items-start gap-3">
                    {/* Their photograph when there is one, initials when there is
                        not. The same circular mark either way, so a roster of mixed
                        rows still lines up. */}
                    {member.imageUrl === null ? (
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-2xs font-semibold text-muted"
                      >
                        {initialsOf(member.fullName)}
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={apiAssetSrc(member.imageUrl)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-10 shrink-0 rounded-full border border-border object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/settings/staff/${member.id}`}
                        className="block truncate font-medium text-text hover:underline"
                      >
                        {member.fullName}
                      </Link>
                      <span className="block truncate text-2xs text-muted">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{member.role}</Badge>
                    {/* Only when they cannot sign in. Active is the ordinary state
                        and a badge on every card would say nothing. */}
                    {!member.isActive && (
                      <Badge tone="neutral" dot>
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
                    <span className="text-2xs text-subtle">
                      Added {formatDate(member.createdAtUtc)}
                    </span>
                    <LinkButton
                      href={`/settings/staff/${member.id}`}
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

/**
 * Up to two initials for the avatar mark.
 *
 * Falls back to a question mark rather than rendering an empty circle: a name is
 * required by the API, but a record written before that rule would otherwise leave a
 * hole in the grid.
 */
function initialsOf(fullName: string): string {
  return (
    fullName
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
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

function CreateStaffDialog({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("Waiter");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("Waiter");
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await createStaff({ fullName, email, password, role });
      reset();
      setIsOpen(false);
      await onCreated();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to add this person.");
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
        <Button icon={<UserPlus />}>Add staff</Button>
      </DialogTrigger>

      <DialogContent
        title="Add staff"
        description="They get their own login for this restaurant."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            <Field
              htmlFor="staff-name"
              label="Full name"
              required
              error={firstError(fieldErrors, "fullName")}
            >
              <Input
                id="staff-name"
                required
                minLength={2}
                maxLength={100}
                autoFocus
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "fullName") !== undefined}
              />
            </Field>

            <Field
              htmlFor="staff-email"
              label="Email"
              required
              error={firstError(fieldErrors, "email")}
            >
              <Input
                id="staff-email"
                type="email"
                required
                maxLength={256}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={firstError(fieldErrors, "email") !== undefined}
              />
            </Field>

            <Field
              htmlFor="staff-password"
              label="Initial password"
              required
              hint="Any password you like. Tell them what you set, so they can sign in."
              error={firstError(fieldErrors, "password")}
            >
              <PasswordInput
                id="staff-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={firstError(fieldErrors, "password") !== undefined}
                aria-describedby={describedBy("staff-password", { hasHint: true })}
              />
            </Field>

            <Field htmlFor="staff-role" label="Role" required>
              <Choice
                id="staff-role"
                label="Role"
                value={role}
                onChange={setRole}
                options={STAFF_ROLES.map((option) => ({
                  value: option,
                  label: option,
                }))}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
