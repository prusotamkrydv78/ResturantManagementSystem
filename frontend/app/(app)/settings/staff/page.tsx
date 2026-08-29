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
  createStaff,
  deleteStaff,
  listStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from "@/features/staff/api";
import { ApiError } from "@/lib/api/client";
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
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Staff" },
        ]}
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
            <TableSkeleton rows={5} columns={4} />
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
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Added</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <Tr key={member.id}>
                      <Td>
                        <span className="font-medium text-text">{member.fullName}</span>
                        <span className="block truncate text-2xs text-muted">
                          {member.email}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone="primary">{member.role}</Badge>
                      </Td>
                      <Td>
                        {member.isActive ? (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Inactive
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap text-muted">
                        {formatDate(member.createdAtUtc)}
                      </Td>
                      <Td className="text-right">
                        <StaffActionsDialog member={member} onChanged={refresh} />
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
              <Select
                id="staff-role"
                value={role}
                onChange={(event) => setRole(event.target.value as StaffRole)}
              >
                {STAFF_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
              {isSubmitting ? "Adding…" : "Add staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit, role change, activate / deactivate                                   */
/* -------------------------------------------------------------------------- */

function StaffActionsDialog({
  member,
  onChanged,
}: {
  member: StaffMember;
  onChanged: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState(member.fullName);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<StaffRole>(member.role);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "none" | "save" | "status" | "password" | "delete"
  >("none");

  function reset() {
    setFullName(member.fullName);
    setEmail(member.email);
    setRole(member.role);
    setNewPassword("");
    setNotice(null);
    setError(null);
    setFieldErrors({});
  }

  async function run(
    action: "save" | "status" | "password" | "delete",
    work: () => Promise<unknown>,
    options?: { keepOpen?: boolean; notice?: string },
  ) {
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setBusy(action);

    try {
      await work();
      await onChanged();

      // A password reset keeps the dialog open: there is nothing to navigate to
      // afterwards, and closing it would leave no sign that anything happened.
      if (options?.keepOpen === true) {
        setNotice(options.notice ?? null);
      } else {
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

  const isDirty =
    fullName !== member.fullName || email !== member.email || role !== member.role;

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

      <DialogContent title={member.fullName} description={member.email}>

          {notice !== null && (
            <p
              role="status"
              className="rounded-md border border-success-border bg-success-soft px-3 py-2 text-sm text-success"
            >
              {notice}
            </p>
          )}
        <div className="flex flex-col gap-5 px-4 py-4">
          {error !== null && <FormError message={error} />}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Account status</h3>
              {member.isActive ? (
                <Badge tone="success" dot>
                  Active
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Inactive
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted">
              {member.isActive
                ? "Deactivating signs them out and blocks sign in. The account and its history are kept."
                : "This account cannot sign in. Reactivate to restore access."}
            </p>

            <Button
              variant={member.isActive ? "secondary" : "primary"}
              size="sm"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() => void run("status", () => setStaffActive(member.id, !member.isActive))}
            >
              {busy === "status"
                ? "Saving…"
                : member.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Details</h3>

            <Field
              htmlFor={`name-${member.id}`}
              label="Full name"
              required
              error={firstError(fieldErrors, "fullName")}
            >
              <Input
                id={`name-${member.id}`}
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={firstError(fieldErrors, "fullName") !== undefined}
              />
            </Field>

            <Field
              htmlFor={`email-${member.id}`}
              label="Email"
              required
              error={firstError(fieldErrors, "email")}
            >
              <Input
                id={`email-${member.id}`}
                type="email"
                required
                maxLength={256}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={firstError(fieldErrors, "email") !== undefined}
              />
            </Field>

            <Field htmlFor={`role-${member.id}`} label="Role" required>
              <Select
                id={`role-${member.id}`}
                value={role}
                onChange={(event) => setRole(event.target.value as StaffRole)}
              >
                {STAFF_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>

            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={busy !== "none" || !isDirty}
              onClick={() =>
                void run("save", () => updateStaff(member.id, { fullName, email, role }))
              }
            >
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Password</h3>
            <p className="text-xs text-muted">
              There is no self-service reset. Setting one here is the only way back in
              for somebody who has forgotten theirs.
            </p>

            <Field htmlFor={`password-${member.id}`} label="New password">
              <PasswordInput
                id={`password-${member.id}`}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>

            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={busy !== "none" || newPassword.trim() === ""}
              onClick={() =>
                void run(
                  "password",
                  () =>
                    resetStaffPassword(member.id, newPassword).then(() => {
                      setNewPassword("");
                    }),
                  { keepOpen: true, notice: "Password replaced." },
                )
              }
            >
              {busy === "password" ? "Saving…" : "Replace password"}
            </Button>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text">Remove</h3>
            <p className="text-xs text-muted">
              Deleting is only for an account added by mistake. Once somebody has taken
              an order, recorded a payment or moved stock it is refused, because those
              records name who did the work. Deactivate instead for somebody who worked
              and then left.
            </p>

            <Button
              size="sm"
              variant="danger"
              className="self-start"
              disabled={busy !== "none"}
              onClick={() =>
                void run("delete", () => deleteStaff(member.id))
              }
            >
              {busy === "delete" ? "Deleting…" : "Delete account"}
            </Button>
          </section>

          <section className="border-t border-border pt-4">
            <p className="text-xs text-muted">
              Works in{" "}
              <span className="font-medium text-text">{member.restaurantName}</span>. A
              staff member belongs to one restaurant and cannot be moved.
            </p>
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
