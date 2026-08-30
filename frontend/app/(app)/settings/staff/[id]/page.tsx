"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Trash2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, Spinner } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  deleteStaff,
  getStaffMember,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from "@/features/staff/api";
import { ApiError } from "@/lib/api/client";
import { STAFF_ROLES } from "@/types/staff";
import type { StaffMember, StaffRole } from "@/types/staff";

/**
 * One staff member, and everything a manager does to their account.
 *
 * A page rather than a dialog. Four unrelated jobs live here — editing details,
 * suspending access, replacing a password, and deleting the account — and a dialog
 * made them one scrolling column with a Close button at the bottom, which reads as
 * a form to fill in rather than as a record to work on. A page also gives each of
 * them somewhere to report back to, gives the account its own address to link and
 * return to, and lets the destructive actions sit apart from the ordinary ones
 * instead of directly under them.
 *
 * The role gate shapes the UI only; the API independently rejects anyone who is not
 * a restaurant manager, and resolves the roster from their token rather than from
 * the identifier in this URL.
 */
export default function StaffMemberPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <StaffMemberView />
    </RequireAuth>
  );
}

function StaffMemberView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [member, setMember] = useState<StaffMember | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getStaffMember(id);

        if (!cancelled) {
          setMember(loaded);
          setLoadError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load this staff member.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Each panel reports its own result, so a save and a password reset cannot
  // overwrite each other's message. Passed down rather than held per panel because
  // the reloaded record has to reach all of them.
  const refresh = useCallback((next: StaffMember) => setMember(next), []);

  return (
    <>
      <PageHeader
        title={member?.fullName ?? "Staff member"}
        description={
          member === null
            ? undefined
            : `${member.role} · ${member.isActive ? "Active" : "Inactive"} · ${member.email}`
        }
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Staff", href: "/settings/staff" },
          { label: member?.fullName ?? "Staff member" },
        ]}
        actions={
          <LinkButton
            href="/settings/staff"
            variant="secondary"
            icon={<ArrowLeft />}
          >
            All staff
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

        {member === null && loadError === null && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {member !== null && (
          // Two columns where there is room. The details form is the thing being
          // worked on and takes the width; access, password and removal are
          // occasional and sit alongside rather than pushing the form down the page.
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <div className="flex flex-col gap-5">
              <DetailsPanel member={member} onSaved={refresh} />
              <AboutPanel member={member} />
            </div>

            <div className="flex flex-col gap-5">
              <StatusPanel member={member} onChanged={refresh} />
              <PasswordPanel member={member} />
              <DangerPanel
                member={member}
                onDeleted={() => router.replace("/settings/staff")}
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
  member,
  onSaved,
}: {
  member: StaffMember;
  onSaved: (next: StaffMember) => void;
}) {
  const [fullName, setFullName] = useState(member.fullName);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<StaffRole>(member.role);
  const [state, setState] = useState<PanelState>(idle);

  const isDirty =
    fullName !== member.fullName || email !== member.email || role !== member.role;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      const next = await updateStaff(member.id, { fullName, email, role });
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
        description="Their name, their login, and what they do on the floor."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="staff-name"
            label="Full name"
            required
            error={fieldError(state, "fullName")}
          >
            <Input
              id="staff-name"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={fieldError(state, "fullName") !== undefined}
            />
          </Field>

          <Field
            htmlFor="staff-email"
            label="Email"
            required
            hint="Also the name they sign in with."
            error={fieldError(state, "email")}
          >
            <Input
              id="staff-email"
              type="email"
              required
              maxLength={256}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldError(state, "email") !== undefined}
            />
          </Field>
        </div>

        <Field
          htmlFor="staff-role"
          label="Role"
          required
          hint="A waiter takes orders; a chef works the kitchen rail. Changing this takes effect the next time they sign in."
        >
          <Select
            id="staff-role"
            className="sm:max-w-64"
            value={role}
            onChange={(next) => setRole(next as StaffRole)}
            options={STAFF_ROLES.map((option) => ({
              value: option,
              label: option,
            }))}
          />
        </Field>

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
                setFullName(member.fullName);
                setEmail(member.email);
                setRole(member.role);
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
/* Access                                                                     */
/* -------------------------------------------------------------------------- */

function StatusPanel({
  member,
  onChanged,
}: {
  member: StaffMember;
  onChanged: (next: StaffMember) => void;
}) {
  const [state, setState] = useState<PanelState>(idle);

  async function toggle() {
    setState({ status: "busy" });

    try {
      const next = await setStaffActive(member.id, !member.isActive);
      onChanged(next);
      setState(idle);
    } catch (caught) {
      setState(failure(caught, "Unable to change access."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader
        title="Access"
        actions={
          member.isActive ? (
            <Badge tone="success" dot>
              Active
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Inactive
            </Badge>
          )
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          {member.isActive
            ? "Deactivating signs them out everywhere and blocks sign in. The account, and everything it has done, is kept."
            : "This account cannot sign in. Reactivating restores access with the same password."}
        </p>

        <Button
          variant={member.isActive ? "secondary" : "primary"}
          size="sm"
          className="self-start"
          icon={<UserCog />}
          disabled={state.status === "busy"}
          onClick={() => void toggle()}
        >
          {state.status === "busy"
            ? "Saving…"
            : member.isActive
              ? "Deactivate account"
              : "Activate account"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Password                                                                   */
/* -------------------------------------------------------------------------- */

function PasswordPanel({ member }: { member: StaffMember }) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<PanelState>(idle);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "busy" });

    try {
      await resetStaffPassword(member.id, password);
      setPassword("");
      setState({ status: "done", message: "Password replaced. Tell them the new one." });
    } catch (caught) {
      setState(failure(caught, "Unable to replace the password."));
    }
  }

  return (
    <Surface>
      <SurfaceHeader title="Password" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          There is no self-service reset. Setting one here is the only way back in for
          somebody who has forgotten theirs. They stay signed in on any device they are
          already using.
        </p>

        <Field
          htmlFor="staff-password"
          label="New password"
          error={fieldError(state, "password")}
        >
          <PasswordInput
            id="staff-password"
            autoComplete="new-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldError(state, "password") !== undefined}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            icon={<KeyRound />}
            disabled={state.status === "busy" || password.trim() === ""}
          >
            {state.status === "busy" ? "Saving…" : "Replace password"}
          </Button>

          <Notice state={state} />
        </div>
      </form>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Removal                                                                    */
/* -------------------------------------------------------------------------- */

function DangerPanel({
  member,
  onDeleted,
}: {
  member: StaffMember;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, setState] = useState<PanelState>(idle);

  async function handleDelete() {
    setState({ status: "busy" });

    try {
      await deleteStaff(member.id);
      onDeleted();
    } catch (caught) {
      setState(failure(caught, "Unable to delete this account."));
      setIsConfirming(false);
    }
  }

  return (
    <Surface className="border-danger-border">
      <SurfaceHeader title="Remove" className="border-danger-border" />

      <div className="flex flex-col gap-4 px-4 py-4">
        {state.status === "error" && <FormError message={state.message} />}

        <p className="text-sm text-muted">
          Deleting is only for an account added by mistake. Once somebody has taken an
          order it is refused, because that order records who took it. Deactivate
          instead for somebody who worked here and then left.
        </p>

        {/* Two presses rather than one. A page has no Cancel button to lean on the
            way a dialog does, and this is the one action here that cannot be undone. */}
        {isConfirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => void handleDelete()}
            >
              {state.status === "busy"
                ? "Deleting…"
                : `Yes, delete ${member.fullName}`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={state.status === "busy"}
              onClick={() => setIsConfirming(false)}
            >
              Keep the account
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
            Delete account
          </Button>
        )}
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Read-only facts                                                            */
/* -------------------------------------------------------------------------- */

function AboutPanel({ member }: { member: StaffMember }) {
  return (
    <Surface>
      <SurfaceHeader title="Record" description="Set when the account was made." />

      <dl className="divide-y divide-border">
        <DetailRow label="Works in">{member.restaurantName}</DetailRow>
        <DetailRow label="Added">{formatDate(member.createdAtUtc)}</DetailRow>
        <DetailRow label="Account id" mono>
          {member.id}
        </DetailRow>
      </dl>

      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        A staff member belongs to one restaurant and cannot be moved to another. To
        move somebody, delete or deactivate them here and have the other manager add
        them.
      </p>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared panel state                                                         */
/* -------------------------------------------------------------------------- */

/**
 * What one panel is doing.
 *
 * Per panel rather than per page: four independent actions live on this screen, and
 * a single shared message meant a password reset silently cleared the confirmation
 * from a save that had just succeeded above it.
 */
type PanelState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "done"; message: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string[]> };

const idle: PanelState = { status: "idle" };

function failure(caught: unknown, fallback: string): PanelState {
  if (caught instanceof ApiError) {
    return {
      status: "error",
      message: caught.message,
      fieldErrors: caught.fieldErrors,
    };
  }

  return {
    status: "error",
    message: caught instanceof Error ? caught.message : fallback,
    fieldErrors: {},
  };
}

function fieldError(state: PanelState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors[field]?.[0] : undefined;
}

/** The confirmation beside a button, once its action has succeeded. */
function Notice({ state }: { state: PanelState }) {
  if (state.status !== "done") {
    return null;
  }

  return (
    <p role="status" className="text-sm text-success">
      {state.message}
    </p>
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
