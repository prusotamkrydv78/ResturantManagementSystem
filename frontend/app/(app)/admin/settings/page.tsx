"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  Database,
  KeyRound,
  LogOut,
  Percent,
  ScrollText,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useAuth } from "@/features/auth/auth-context";
import {
  changeMyPassword,
  signOutEverywhere,
  updateMyProfile,
} from "@/features/auth/api";
import {
  getPlatformSettings,
  getPlatformSystem,
  listPlatformActivity,
  updatePlatformSettings,
} from "@/features/platform/api";
import { sinceLabel, useNow } from "@/lib/time/since";
import { Report, useAction } from "@/features/platform/use-action";
import { cn } from "@/lib/utils/cn";
import type { AuthUser } from "@/types/auth";
import type {
  PlatformActivity,
  PlatformSettings,
  PlatformSystem,
} from "@/types/platform";

/**
 * Platform settings.
 *
 * This page used to be honest about having nothing to configure, and re-rendered the
 * restaurants list instead. That was the right call when nothing on the platform was
 * configurable. It no longer is, and two of the things that were missing were holes
 * rather than gaps:
 *
 * The platform owner could not change their own password. They can reset any manager's;
 * nobody can reset theirs. If it leaked, the only remedy was a database edit.
 *
 * And nothing recorded who did what. Suspending a restaurant stops a business trading,
 * and the only trace was a line in the application log that nobody outside the server
 * can read.
 *
 * What is still deliberately absent: global currency, global tax, feature flags, SMTP.
 * None of them exist in the product, and a setting that can hold exactly one correct
 * value is only a way to get it wrong.
 */
export default function PlatformSettingsPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <PlatformSettingsView />
    </RequireAuth>
  );
}

function PlatformSettingsView() {
  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Your account, what new restaurants inherit, what has been done, and whether the deployment is healthy."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Settings" }]}
      />

      <PageBody>
        <SystemCard />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ProfileCard />
          <PasswordCard />
        </div>

        <DefaultsCard />
        <ActivityCard />
      </PageBody>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The deployment                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Whether the thing this runs on is healthy.
 *
 * First on the page, above everything editable, because a pending migration makes
 * every other answer on this screen provisional. This has already cost time on this
 * project: a database a migration behind serves every request perfectly until it
 * reaches the one column that is missing, and nothing in the product said a word.
 */
function SystemCard() {
  const [system, setSystem] = useState<PlatformSystem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPlatformSystem();
        if (!cancelled) {
          setSystem(loaded);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to read the system.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} />
      </Surface>
    );
  }

  if (system === null) {
    return (
      <Surface className="flex flex-col gap-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-64" />
      </Surface>
    );
  }

  const behind = system.pendingMigrations.length;
  const healthy = system.databaseReachable && behind === 0;

  return (
    <Surface className="flex flex-col">
      <SurfaceHeader
        title="Deployment"
        description="The build that is running, and whether its database agrees with it."
        actions={
          healthy ? (
            <Badge tone="success" dot>
              Healthy
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              Needs attention
            </Badge>
          )
        }
      />

      {!system.databaseReachable && (
        <p className="flex items-start gap-2 border-b border-border bg-danger-soft px-4 py-2.5 text-sm text-danger">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The API cannot open a connection to the database. Nothing else on this screen
          is trustworthy until that is fixed.
        </p>
      )}

      {behind > 0 && (
        <div className="flex flex-col gap-1.5 border-b border-border bg-warning-soft px-4 py-2.5">
          <p className="flex items-start gap-2 text-sm font-medium text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {behind} {behind === 1 ? "migration has" : "migrations have"} not been
            applied. The running build expects a schema this database does not have.
          </p>
          <ul className="flex flex-col gap-0.5 pl-6">
            {system.pendingMigrations.map((name) => (
              <li key={name} className="font-mono text-2xs text-warning">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="divide-y divide-border">
        <DetailRow label="Environment">{system.environment}</DetailRow>
        <DetailRow label="Version" mono>
          {system.version}
        </DetailRow>
        <DetailRow label="Database">
          <span className="inline-flex items-center gap-2">
            <Database className="size-3.5 text-subtle" aria-hidden="true" />
            {system.databaseReachable ? "Reachable" : "Unreachable"}
            <span className="text-muted">
              · {system.appliedMigrationCount} migrations applied
            </span>
          </span>
        </DetailRow>
        <DetailRow label="Service day">
          {system.serviceDayLabel}
          {/* Said out loud rather than left silent. It is not configurable, and a
              reader wondering whether it is deserves the answer either way. */}
          <span className="block text-xs text-muted">
            Fixed for the whole estate. Today is {system.localDate}.
          </span>
        </DetailRow>
        <DetailRow label="Server clock" mono>
          {system.serverUtcNow}
        </DetailRow>
      </dl>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* This account                                                               */
/* -------------------------------------------------------------------------- */

/** Name and email, editable at last. */
function ProfileCard() {
  const { user, refresh } = useAuth();

  if (user === null) {
    return (
      <Surface className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-full" />
      </Surface>
    );
  }

  // Keyed on the account, so the fields initialise from it rather than being seeded by
  // an effect that has to remember not to run twice. Signing in as somebody else
  // rebuilds the form; typing in it does not.
  return <ProfileForm key={user.id} user={user} onSaved={refresh} />;
}

function ProfileForm({
  user,
  onSaved,
}: {
  user: AuthUser;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const action = useAction();

  const unchanged = fullName === user.fullName && email === user.email;

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Your account"
        description="Platform administrator. Nobody else can maintain this one for you."
      />
      <form
        className="flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();

          void action.run(async () => {
            await updateMyProfile({ fullName, email });
            await onSaved();
          }, "Saved.");
        }}
      >
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Report action={action} />

          <Field htmlFor="account-name" label="Full name" required>
            <Input
              id="account-name"
              required
              minLength={2}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>

          <Field
            htmlFor="account-email"
            label="Email"
            required
            hint="This is what you sign in with. Changing it changes your credential."
          >
            <Input
              id="account-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={describedBy("account-email", { hasHint: true })}
            />
          </Field>
        </div>

        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="submit" disabled={unchanged || action.busy}>
            {action.busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Surface>
  );
}

/**
 * Replacing your own password, and ending your own sessions.
 *
 * Both end every session this account holds, which is the point of both. Said on the
 * card rather than discovered afterwards.
 */
function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const password = useAction();
  const sessions = useAction();

  return (
    <Surface className="flex h-full flex-col">
      <SurfaceHeader
        title="Password and sessions"
        description="There is no self-service reset on this platform. This is the only way to change it."
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Report action={password} />

        <Field htmlFor="current-password" label="Current password" required>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>

        <Field
          htmlFor="new-password"
          label="New password"
          required
          hint="Every session ends when this changes, including this browser. You will sign in again."
        >
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby={describedBy("new-password", { hasHint: true })}
          />
        </Field>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Report action={sessions} />
          <p className="flex items-start gap-2 text-xs text-muted">
            <LogOut className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden="true" />
            {/* The honest caveat. An access token is signed rather than stored, so
                nothing can recall one already issued; sessions end at the next
                refresh, which is minutes rather than instantly. */}
            Signing out everywhere revokes every device. An access token already issued
            stays valid until it expires, so this takes effect at the next refresh.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={sessions.busy}
            onClick={() =>
              void sessions.run(async () => {
                const result = await signOutEverywhere();

                sessions.say(
                  result.sessionsEnded === 0
                    ? "Nothing else was signed in."
                    : `${result.sessionsEnded} ${result.sessionsEnded === 1 ? "session" : "sessions"} ended.`,
                );
              })
            }
          >
            <KeyRound className="size-3.5" aria-hidden="true" />
            {sessions.busy ? "Signing out…" : "Sign out everywhere"}
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t border-border px-4 py-3">
        <Button
          type="button"
          disabled={current.trim() === "" || next.trim() === "" || password.busy}
          onClick={() =>
            void password.run(async () => {
              await changeMyPassword({ currentPassword: current, newPassword: next });
              setCurrent("");
              setNext("");
            }, "Password changed. Sign in again with the new one.")
          }
        >
          {password.busy ? "Saving…" : "Change password"}
        </Button>
      </div>
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* What a new restaurant inherits                                             */
/* -------------------------------------------------------------------------- */

/**
 * The two rates a new restaurant starts on.
 *
 * These were constants in the source, which meant changing either one — a budget
 * moves VAT, say — was a code edit and a redeploy. They are stored now, and they are
 * only ever a starting point: an existing restaurant keeps what it was set to, and
 * every order snapshots its rate at the moment it opens, so nothing here can reach
 * backwards into a bill that has been printed.
 */
function DefaultsCard() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [vat, setVat] = useState("");
  const [service, setService] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const action = useAction();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPlatformSettings();

        if (!cancelled) {
          setSettings(loaded);
          setVat(asPercent(loaded.defaultVatRate));
          setService(asPercent(loaded.defaultServiceChargeRate));
        }
      } catch {
        // The card renders its skeleton and the save button stays out of reach.
        // A settings screen that cannot read one section is not a broken screen.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const unchanged =
    settings !== null &&
    vat === asPercent(settings.defaultVatRate) &&
    service === asPercent(settings.defaultServiceChargeRate);

  return (
    <Surface className="flex flex-col">
      <SurfaceHeader
        title="What a new restaurant starts on"
        description="Defaults, not rules. Existing restaurants keep their own rates, and printed bills are never touched."
        actions={
          settings?.updatedAtUtc !== null && settings !== null ? (
            <span className="text-2xs text-subtle">
              Changed {new Date(settings.updatedAtUtc).toLocaleDateString()}
            </span>
          ) : undefined
        }
      />

      {settings === null ? (
        <div className="p-4">
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 p-4 sm:flex-row">
            <Report action={action} />

            <Field htmlFor="default-vat" label="VAT" className="sm:w-48">
              <Rate id="default-vat" value={vat} onChange={setVat} />
            </Field>

            <Field htmlFor="default-service" label="Service charge" className="sm:w-48">
              <Rate id="default-service" value={service} onChange={setService} />
            </Field>
          </div>

          <div className="flex justify-end border-t border-border px-4 py-3">
            <Button
              type="button"
              disabled={unchanged || action.busy}
              onClick={() =>
                void action.run(async () => {
                  await updatePlatformSettings({
                    defaultVatRate: fromPercent(vat),
                    defaultServiceChargeRate: fromPercent(service),
                  });
                  setReloadKey((key) => key + 1);
                }, "Saved. The next restaurant created will start on these.")
              }
            >
              {action.busy ? "Saving…" : "Save defaults"}
            </Button>
          </div>
        </>
      )}
    </Surface>
  );
}

/** A rate, typed as the percentage a person says rather than the fraction stored. */
function Rate({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <span className="relative flex items-center">
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        step={0.01}
        className="pr-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Percent
        className="pointer-events-none absolute right-2.5 size-3.5 text-subtle"
        aria-hidden="true"
      />
    </span>
  );
}

function asPercent(rate: number): string {
  return String(Math.round(rate * 10_000) / 100);
}

function fromPercent(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 10_000 : 0;
}

/* -------------------------------------------------------------------------- */
/* What has been done                                                         */
/* -------------------------------------------------------------------------- */

/** How each verb reads on screen, and how loudly. */
const ACTIONS: Record<string, { label: string; tone: "neutral" | "warning" | "danger" }> = {
  "restaurant.created": { label: "created restaurant", tone: "neutral" },
  "restaurant.updated": { label: "edited restaurant", tone: "neutral" },
  "restaurant.suspended": { label: "suspended restaurant", tone: "danger" },
  "restaurant.restored": { label: "restored restaurant", tone: "neutral" },
  "manager.created": { label: "created manager", tone: "neutral" },
  "manager.updated": { label: "edited manager", tone: "neutral" },
  "manager.assigned": { label: "assigned manager", tone: "neutral" },
  "manager.unassigned": { label: "unassigned manager", tone: "warning" },
  "manager.password_reset": { label: "reset the password for", tone: "warning" },
  "manager.suspended": { label: "suspended manager", tone: "danger" },
  "manager.restored": { label: "restored manager", tone: "neutral" },
  "platform.settings_updated": { label: "changed", tone: "warning" },
};

/**
 * Who did what, newest first.
 *
 * Recorded from now on, not retroactively: everything before this shipped went only
 * to the application log, and inventing entries for it would be fiction. An empty
 * list on a platform that has been running for months is expected, and says so.
 */
function ActivityCard() {
  const [rows, setRows] = useState<PlatformActivity[] | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listPlatformActivity(50);
        if (!cancelled) {
          setRows(loaded);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Surface className="flex flex-col">
      <SurfaceHeader
        title="Recent activity"
        description="What administrators have done on this platform, newest first."
      />

      {rows === null ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : rows.length === 0 ? (
        <p className="flex items-start gap-2 px-4 py-5 text-sm text-muted">
          <ScrollText className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
          Nothing recorded yet. Actions taken from now on appear here; anything done
          before this was added went only to the server log.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const look = ACTIONS[row.action] ?? { label: row.action, tone: "neutral" };

            return (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                    look.tone === "danger"
                      ? "bg-danger-soft text-danger"
                      : look.tone === "warning"
                        ? "bg-warning-soft text-warning"
                        : "bg-surface-3 text-muted",
                  )}
                >
                  {look.tone === "neutral" ? (
                    <CircleCheck className="size-3.5" />
                  ) : (
                    <TriangleAlert className="size-3.5" />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm text-text">
                    <span className="font-medium">{row.actorName}</span>{" "}
                    <span className="text-muted">{look.label}</span>{" "}
                    {row.subjectId === null ? (
                      <span className="font-medium">{row.subject}</span>
                    ) : (
                      <Link
                        href={subjectHref(row)}
                        className="rounded font-medium hover:text-primary hover:underline"
                      >
                        {row.subject}
                      </Link>
                    )}
                  </span>
                  {row.detail !== null && (
                    <span className="text-2xs text-subtle">{row.detail}</span>
                  )}
                </span>

                <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                  {sinceLabel(row.atUtc, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

/** Where a row points, worked out from the verb rather than stored twice. */
function subjectHref(row: PlatformActivity): string {
  return row.action.startsWith("manager.")
    ? `/admin/managers/${row.subjectId}`
    : `/admin/restaurants/${row.subjectId}`;
}
