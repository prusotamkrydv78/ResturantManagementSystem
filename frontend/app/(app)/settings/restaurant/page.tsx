"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  Globe,
  Hash,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import {
  ErrorState,
  FormError,
  FormSuccess,
  Skeleton,
} from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getMyRestaurant, updateMyRestaurant } from "@/features/restaurants/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import type { Restaurant } from "@/types/restaurant";

/**
 * Restaurant profile for the signed-in manager.
 *
 * Neither the read nor the write carries a restaurant id: the API resolves the
 * record from the access token. The name and the slug are shown, but the slug is
 * not editable here because it is a platform-level identifier.
 *
 * The page keeps one shape in both of its modes. Editing used to replace all three
 * panels with a single form, so the manager, the restaurant id and the dates simply
 * left the screen the moment somebody clicked Edit - two thirds of the page vanishing
 * to change a phone number. The column on the right is the same in both modes now,
 * and only the panel being edited changes.
 */
export default function MyRestaurantPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <MyRestaurant />
    </RequireAuth>
  );
}

/**
 * How long the confirmation stays up.
 *
 * It used to stay forever: it was set on a successful save and cleared only when
 * somebody clicked Edit again, so "Restaurant details saved." sat at the top of the
 * page for the rest of the session, still claiming a save that happened an hour ago.
 */
const SAVED_FOR_MS = 6_000;

/** The editable fields, matching the update payload exactly. */
interface FormState {
  name: string;
  addressLine: string;
  city: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
}

function toForm(restaurant: Restaurant): FormState {
  return {
    name: restaurant.name,
    addressLine: restaurant.addressLine ?? "",
    city: restaurant.city ?? "",
    country: restaurant.country ?? "",
    contactEmail: restaurant.contactEmail ?? "",
    contactPhone: restaurant.contactPhone ?? "",
  };
}

function MyRestaurant() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getMyRestaurant();
        if (!cancelled) {
          setRestaurant(loaded);
          setForm(toForm(loaded));
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          // Not yet assigned a restaurant is a real state rather than a failure, so
          // it falls through to the empty state below instead of a red panel with a
          // retry that could never succeed.
          if (isMissingRestaurant(caught)) {
            setError(null);
          } else {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load your restaurant.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // The confirmation withdraws itself. Keyed on the timestamp so a second save
  // restarts the clock rather than inheriting the first one's remaining time.
  useEffect(() => {
    if (savedAt === null) {
      return;
    }

    const timer = setTimeout(() => setSavedAt(null), SAVED_FOR_MS);

    return () => clearTimeout(timer);
  }, [savedAt]);

  function startEditing() {
    if (restaurant !== null) {
      setForm(toForm(restaurant));
    }
    setSaveError(null);
    setFieldErrors({});
    setSavedAt(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (restaurant !== null) {
      setForm(toForm(restaurant));
    }
    setSaveError(null);
    setFieldErrors({});
    setIsEditing(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (form === null) {
      return;
    }

    setSaveError(null);
    setFieldErrors({});
    setIsSaving(true);

    try {
      // Blank inputs are sent as null so a value can be cleared, rather than
      // stored as an empty string.
      const updated = await updateMyRestaurant({
        name: form.name.trim(),
        addressLine: blankToNull(form.addressLine),
        city: blankToNull(form.city),
        country: blankToNull(form.country),
        contactEmail: blankToNull(form.contactEmail),
        contactPhone: blankToNull(form.contactPhone),
      });

      setRestaurant(updated);
      setForm(toForm(updated));
      setIsEditing(false);
      setSavedAt(Date.now());
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSaveError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setSaveError(
          caught instanceof Error ? caught.message : "Unable to save your changes.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  const update = (key: keyof FormState) => (value: string) =>
    setForm((current) => (current === null ? current : { ...current, [key]: value }));

  /** One field, wired the same way every time. */
  const field = (name: keyof FormState) => ({
    id: name,
    value: form?.[name] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      update(name)(event.target.value),
    "aria-invalid": hasError(fieldErrors, name),
    // Every field, not only the name. The others set aria-invalid and pointed at
    // nothing, so a screen reader announced "invalid" and never read the reason.
    "aria-describedby": describedBy(name, {
      hasError: hasError(fieldErrors, name),
    }),
  });

  return (
    <>
      <PageHeader
        title={restaurant?.name ?? "My restaurant"}
        description="Your restaurant profile. Guests see this information."
        actions={
          restaurant !== null ? (
            <div className="flex items-center gap-2">
              {/* Read from the record rather than asserted. This badge said "Active"
                  unconditionally, so a suspended restaurant - one that can take no
                  order from staff or guest - told its manager it was trading. */}
              {restaurant.isActive ? (
                <Badge tone="success" dot>
                  In service
                </Badge>
              ) : (
                <Badge tone="danger" dot>
                  Suspended
                </Badge>
              )}
              {!isEditing && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil />}
                  onClick={startEditing}
                >
                  Edit details
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <PageBody>
        {isLoading ? (
          // Shaped like the two columns that arrive, rather than three grey bars in
          // one box, so the page does not rearrange itself when the data lands.
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] xl:items-start">
            <div className="flex flex-col gap-4">
              <PanelSkeleton rows={5} />
              <PanelSkeleton rows={2} />
            </div>
            <PanelSkeleton rows={4} />
          </div>
        ) : error !== null ? (
          <Surface>
            <ErrorState message={error} onRetry={retry} />
          </Surface>
        ) : restaurant === null ? (
          <NoRestaurantAssigned />
        ) : (
          <>
            {/* What suspension actually means, said once, where it is discovered.
                The badge alone names the state; a manager whose restaurant stopped
                taking orders this morning needs the sentence as well, and this is
                the only screen of theirs that knows. */}
            {!restaurant.isActive && (
              <Surface className="border-danger-border bg-danger-soft">
                <p className="flex items-start gap-2.5 px-4 py-3 text-sm text-text">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <span>
                    This restaurant is suspended, so no new order can be opened by
                    staff or by a guest. Your details below can still be edited. Only
                    the platform administrator can put it back into service.
                  </span>
                </p>
              </Surface>
            )}

            {savedAt !== null && <FormSuccess message="Restaurant details saved." />}

            {!isEditing && <IdentityCard restaurant={restaurant} />}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] xl:items-start">
              <div className="flex flex-col gap-4">
                {isEditing && form !== null ? (
                  <Surface>
                    <SurfaceHeader
                      title="Edit details"
                      description="The slug and the manager assignment are set by the platform admin."
                    />

                    <form onSubmit={handleSubmit}>
                      <div className="flex flex-col gap-4 px-4 py-4">
                        {saveError !== null && <FormError message={saveError} />}

                        <Field
                          htmlFor="name"
                          label="Restaurant name"
                          required
                          error={firstError(fieldErrors, "name")}
                        >
                          <Input
                            {...field("name")}
                            required
                            minLength={2}
                            maxLength={200}
                            autoFocus
                          />
                        </Field>

                        <Field
                          htmlFor="addressLine"
                          label="Address"
                          error={firstError(fieldErrors, "addressLine")}
                        >
                          <Input {...field("addressLine")} maxLength={256} />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field
                            htmlFor="city"
                            label="City"
                            error={firstError(fieldErrors, "city")}
                          >
                            <Input {...field("city")} maxLength={100} />
                          </Field>

                          <Field
                            htmlFor="country"
                            label="Country"
                            error={firstError(fieldErrors, "country")}
                          >
                            <Input {...field("country")} maxLength={100} />
                          </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field
                            htmlFor="contactEmail"
                            label="Contact email"
                            error={firstError(fieldErrors, "contactEmail")}
                          >
                            <Input
                              {...field("contactEmail")}
                              type="email"
                              maxLength={256}
                            />
                          </Field>

                          <Field
                            htmlFor="contactPhone"
                            label="Contact phone"
                            error={firstError(fieldErrors, "contactPhone")}
                          >
                            <Input
                              {...field("contactPhone")}
                              type="tel"
                              maxLength={32}
                            />
                          </Field>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3">
                        <Button
                          variant="secondary"
                          onClick={cancelEditing}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                          {isSaving ? "Saving…" : "Save changes"}
                        </Button>
                      </div>
                    </form>
                  </Surface>
                ) : (
                  <Surface>
                    <SurfaceHeader
                      title="Details"
                      description="What guests, receipts and your website show"
                    />
                    <ul className="flex flex-col gap-0.5 px-2 pb-2">
                      <InfoRow icon={Store} label="Name" value={restaurant.name} onAdd={startEditing} />
                      <InfoRow icon={Hash} label="Slug" value={restaurant.slug} mono note="Set by the platform admin" />
                      <InfoRow icon={MapPin} label="Address" value={restaurant.addressLine} onAdd={startEditing} />
                      <InfoRow icon={Building2} label="City" value={restaurant.city} onAdd={startEditing} />
                      <InfoRow icon={Globe} label="Country" value={restaurant.country} onAdd={startEditing} />
                      <InfoRow icon={Mail} label="Email" value={restaurant.contactEmail} onAdd={startEditing} />
                      <InfoRow icon={Phone} label="Phone" value={restaurant.contactPhone} onAdd={startEditing} />
                    </ul>
                  </Surface>
                )}
              </div>

              {/* Stays put through both modes. None of it is editable here, which is
                  exactly why it should not disappear the moment editing starts. */}
              <ManagementPanel restaurant={restaurant} />
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

/** A panel of label/value rows, before it has any. */
function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <Surface>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 px-4 py-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
    </Surface>
  );
}

/** Profile completeness, counted from the optional fields rather than scored. */
function completeness(restaurant: Restaurant) {
  const fields = [
    restaurant.addressLine,
    restaurant.city,
    restaurant.country,
    restaurant.contactEmail,
    restaurant.contactPhone,
  ];

  return { filled: fields.filter((value) => value !== null && value !== "").length, total: fields.length };
}

/**
 * The restaurant as a guest meets it: the name, where it is, whether it is open, and
 * the ways to reach it, on the console's ink card. Email and phone are live links, so
 * the card doubles as a check that they actually work.
 */
function IdentityCard({ restaurant }: { restaurant: Restaurant }) {
  const { filled, total } = completeness(restaurant);
  const place = [restaurant.addressLine, restaurant.city, restaurant.country].filter(Boolean).join(", ");
  const initial = restaurant.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-contrast p-5 text-contrast-fg lg:flex-row lg:items-center lg:justify-between">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)" }}
      />

      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-3xl font-semibold text-accent-fg"
        >
          {initial}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{restaurant.name}</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-semibold",
                restaurant.isActive ? "bg-success/20 text-success" : "bg-danger/20 text-danger",
              )}
            >
              <span className={cn("size-1.5 rounded-full", restaurant.isActive ? "bg-success" : "bg-danger")} />
              {restaurant.isActive ? "In service" : "Suspended"}
            </span>
          </div>
          <p className="flex items-center gap-1.5 truncate text-sm text-contrast-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {place === "" ? "No address yet" : place}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {restaurant.contactEmail !== null && (
              <ContactChip href={`mailto:${restaurant.contactEmail}`} icon={Mail} label={restaurant.contactEmail} />
            )}
            {restaurant.contactPhone !== null && (
              <ContactChip href={`tel:${restaurant.contactPhone.replace(/\s+/g, "")}`} icon={Phone} label={restaurant.contactPhone} />
            )}
            {restaurant.subdomain !== null && (
              <ContactChip href="/settings/website" icon={Globe} label={`${restaurant.subdomain} · website`} />
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5 lg:w-56">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-contrast-muted">Profile</span>
          <span className="tabular font-semibold">
            {filled === total ? "Complete" : `${filled} of ${total}`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-contrast-raised">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${(filled / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function ContactChip({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-contrast-raised px-3 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-fg"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </a>
  );
}

/**
 * One detail, with its icon. Anything empty says so and offers to fill it in, which
 * opens the editor - a grey "Not set" was a dead end.
 */
function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
  note,
  onAdd,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  mono?: boolean;
  note?: string;
  onAdd?: () => void;
}) {
  const empty = value === null || value === "";

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          empty ? "bg-warning-soft text-warning" : "bg-panel text-panel-fg",
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">{label}</span>
        {empty ? (
          <span className="text-sm text-muted">Not added yet</span>
        ) : (
          <span className={cn("truncate text-sm font-medium text-text", mono && "font-mono")}>{value}</span>
        )}
      </span>
      {empty && onAdd !== undefined ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-3" aria-hidden="true" />
          Add
        </button>
      ) : note !== undefined ? (
        <span className="shrink-0 text-2xs text-subtle">{note}</span>
      ) : null}
    </li>
  );
}

/** What the platform admin sets, on the lavender panel. The id can be copied. */
function ManagementPanel({ restaurant }: { restaurant: Restaurant }) {
  const [copied, setCopied] = useState(false);
  const manager = restaurant.manager;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(restaurant.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (an insecure origin, a denied permission): the id is on
      // screen and selectable, so there is nothing to recover.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-panel p-4 text-panel-fg">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-semibold tracking-tight">Management</h2>
        <p className="text-xs opacity-70">Set by the platform admin</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-surface p-3 text-text">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
        >
          {manager === null
            ? "?"
            : manager.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join("")}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">Manager</span>
          <span className="truncate text-sm font-semibold">{manager?.fullName ?? "Nobody assigned"}</span>
          {manager !== null && <span className="truncate text-xs text-muted">{manager.email}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-surface p-3 text-text">
        <span className="flex items-center justify-between gap-2">
          <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">Restaurant ID</span>
          <button
            type="button"
            onClick={() => void copyId()}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-2xs font-semibold transition-colors hover:bg-ink hover:text-surface"
          >
            {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
        <span className="font-mono text-xs break-all text-muted">{restaurant.id}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-3 text-text">
          <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">Created</span>
          <span className="text-xs font-medium">{formatDateTime(restaurant.createdAtUtc)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface p-3 text-text">
          <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">Last updated</span>
          <span className="text-xs font-medium">{formatDateTime(restaurant.updatedAtUtc)}</span>
        </div>
      </div>
    </div>
  );
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function hasError(errors: Record<string, string[]>, field: string): boolean {
  return errors[field] !== undefined;
}

function firstError(
  errors: Record<string, string[]>,
  field: string,
): string | undefined {
  return errors[field]?.[0];
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
