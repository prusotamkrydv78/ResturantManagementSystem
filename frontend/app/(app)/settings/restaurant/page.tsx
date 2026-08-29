"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
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
 */
export default function MyRestaurantPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <MyRestaurant />
    </RequireAuth>
  );
}

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

  return (
    <>
      <PageHeader
        title={restaurant?.name ?? "My restaurant"}
        description="Your restaurant profile. Guests see this information."
        crumbs={[
          { label: "Workspace", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "My restaurant" },
        ]}
        actions={
          restaurant !== null && !isEditing ? (
            <div className="flex items-center gap-2">
              <Badge tone="success" dot>
                Active
              </Badge>
              <Button variant="secondary" size="sm" icon={<Pencil />} onClick={startEditing}>
                Edit details
              </Button>
            </div>
          ) : undefined
        }
      />

      <PageBody>
        {isLoading ? (
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </Surface>
        ) : error !== null ? (
          <Surface>
            <ErrorState message={error} onRetry={retry} />
          </Surface>
        ) : restaurant === null ? (
          <NoRestaurantAssigned />
        ) : isEditing && form !== null ? (
          <Surface>
            <SurfaceHeader
              title="Edit details"
              description="The slug and the manager assignment are managed by the platform admin."
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
                    id="name"
                    required
                    minLength={2}
                    maxLength={200}
                    autoFocus
                    value={form.name}
                    onChange={(event) => update("name")(event.target.value)}
                    aria-invalid={hasError(fieldErrors, "name")}
                    aria-describedby={describedBy("name", {
                      hasError: hasError(fieldErrors, "name"),
                    })}
                  />
                </Field>

                <Field
                  htmlFor="addressLine"
                  label="Address"
                  error={firstError(fieldErrors, "addressLine")}
                >
                  <Input
                    id="addressLine"
                    maxLength={256}
                    value={form.addressLine}
                    onChange={(event) => update("addressLine")(event.target.value)}
                    aria-invalid={hasError(fieldErrors, "addressLine")}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    htmlFor="city"
                    label="City"
                    error={firstError(fieldErrors, "city")}
                  >
                    <Input
                      id="city"
                      maxLength={100}
                      value={form.city}
                      onChange={(event) => update("city")(event.target.value)}
                      aria-invalid={hasError(fieldErrors, "city")}
                    />
                  </Field>

                  <Field
                    htmlFor="country"
                    label="Country"
                    error={firstError(fieldErrors, "country")}
                  >
                    <Input
                      id="country"
                      maxLength={100}
                      value={form.country}
                      onChange={(event) => update("country")(event.target.value)}
                      aria-invalid={hasError(fieldErrors, "country")}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    htmlFor="contactEmail"
                    label="Contact email"
                    error={firstError(fieldErrors, "contactEmail")}
                  >
                    <Input
                      id="contactEmail"
                      type="email"
                      maxLength={256}
                      value={form.contactEmail}
                      onChange={(event) => update("contactEmail")(event.target.value)}
                      aria-invalid={hasError(fieldErrors, "contactEmail")}
                    />
                  </Field>

                  <Field
                    htmlFor="contactPhone"
                    label="Contact phone"
                    error={firstError(fieldErrors, "contactPhone")}
                  >
                    <Input
                      id="contactPhone"
                      type="tel"
                      maxLength={32}
                      value={form.contactPhone}
                      onChange={(event) => update("contactPhone")(event.target.value)}
                      aria-invalid={hasError(fieldErrors, "contactPhone")}
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3">
                <Button variant="secondary" onClick={cancelEditing} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Surface>
        ) : (
          <>
            {savedAt !== null && <FormSuccess message="Restaurant details saved." />}

            <Surface>
              <SurfaceHeader title="Profile" description="Identity and location" />
              <dl className="divide-y divide-border">
                <DetailRow label="Name">{restaurant.name}</DetailRow>
                <DetailRow label="Slug" mono>
                  {restaurant.slug}
                </DetailRow>
                <DetailRow label="Address">
                  {restaurant.addressLine ?? <Unset />}
                </DetailRow>
                <DetailRow label="City">{restaurant.city ?? <Unset />}</DetailRow>
                <DetailRow label="Country">
                  {restaurant.country ?? <Unset />}
                </DetailRow>
              </dl>
            </Surface>

            <Surface>
              <SurfaceHeader title="Contact" description="How guests reach you" />
              <dl className="divide-y divide-border">
                <DetailRow label="Email">
                  {restaurant.contactEmail ?? <Unset />}
                </DetailRow>
                <DetailRow label="Phone">
                  {restaurant.contactPhone ?? <Unset />}
                </DetailRow>
              </dl>
            </Surface>

            <Surface>
              <SurfaceHeader
                title="Management"
                description="Set by the platform admin"
              />
              <dl className="divide-y divide-border">
                <DetailRow label="Manager">
                  {restaurant.manager === null ? (
                    <Unset />
                  ) : (
                    <span className="flex flex-col">
                      <span>{restaurant.manager.fullName}</span>
                      <span className="text-xs text-muted">
                        {restaurant.manager.email}
                      </span>
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Restaurant ID" mono>
                  {restaurant.id}
                </DetailRow>
                <DetailRow label="Created">
                  {formatDateTime(restaurant.createdAtUtc)}
                </DetailRow>
                <DetailRow label="Last updated">
                  {formatDateTime(restaurant.updatedAtUtc)}
                </DetailRow>
              </dl>
            </Surface>
          </>
        )}
      </PageBody>
    </>
  );
}

/** Marks a field the backend has no value for, without inventing one. */
function Unset() {
  return <span className="text-subtle">Not set</span>;
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
