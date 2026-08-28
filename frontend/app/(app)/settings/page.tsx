"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Globe, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
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
import {
  getMySettings,
  listTimeZones,
  updateMySettings,
} from "@/features/restaurants/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { DAY_START_HOURS } from "@/types/restaurant";
import type { RestaurantSettings, TimeZoneOption } from "@/types/restaurant";

/**
 * How the restaurant operates.
 *
 * Two settings, and both of them change numbers elsewhere rather than changing how
 * anything looks. That is why this screen shows the effect alongside the choice: the
 * offset the zone is worth right now, and the exact instant the running service day
 * began. A manager should be able to confirm the configuration is doing what they
 * meant without waiting until tomorrow to find out it was not.
 */
export default function SettingsPage() {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [zones, setZones] = useState<TimeZoneOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // The working copy. Separate from what is stored, so the screen can tell whether
  // anything has actually changed and leave Save disabled until it has.
  const [zoneId, setZoneId] = useState("");
  const [dayStartHour, setDayStartHour] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const adopt = useCallback((loaded: RestaurantSettings) => {
    setSettings(loaded);
    setZoneId(loaded.timeZoneId);
    setDayStartHour(loaded.dayStartHour);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedSettings, loadedZones] = await Promise.all([
          getMySettings(),
          listTimeZones(),
        ]);
        if (!cancelled) {
          adopt(loadedSettings);
          setZones(loadedZones);
          setError(null);
          setNoRestaurant(false);
        }
      } catch (caught) {
        if (!cancelled) {
          // Nothing assigned yet is a real state, not a failure.
          setNoRestaurant(isMissingRestaurant(caught));
          setError(
            isMissingRestaurant(caught)
              ? null
              : caught instanceof Error
                ? caught.message
                : "Unable to load your settings.",
          );
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
  }, [reloadKey, adopt]);

  const isDirty =
    settings !== null &&
    (zoneId !== settings.timeZoneId || dayStartHour !== settings.dayStartHour);

  async function save() {
    if (settings === null || !isDirty || isSaving) {
      return;
    }

    setSaveError(null);
    setFieldErrors({});
    setIsSaving(true);

    try {
      const updated = await updateMySettings({ timeZoneId: zoneId, dayStartHour });

      adopt(updated);
      setSavedAt(Date.now());
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
      }
      setSaveError(
        caught instanceof Error ? caught.message : "Could not save your settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="How this restaurant operates. These values decide what counts as today."
        crumbs={[{ label: "Workspace", href: "/dashboard" }, { label: "Settings" }]}
      />

      <PageBody>
        {isLoading ? (
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-1/2" />
          </Surface>
        ) : noRestaurant ? (
          <NoRestaurantAssigned area="Operational settings" />
        ) : error !== null ? (
          <Surface>
            <ErrorState
              message={error}
              onRetry={() => {
                setIsLoading(true);
                setReloadKey((key) => key + 1);
              }}
            />
          </Surface>
        ) : settings === null || zones === null ? (
          <NoRestaurantAssigned area="Operational settings" />
        ) : (
          <>
            <Surface>
              <SurfaceHeader
                title="The operational day"
                description="Where the restaurant is, and when its day begins"
              />

              <div className="flex flex-col gap-4 p-4">
                {saveError !== null && <FormError message={saveError} />}
                {savedAt !== null && !isDirty && (
                  <FormSuccess message="Settings saved. Today is measured from the new boundary." />
                )}

                <Field
                  label="Timezone"
                  htmlFor="timezone"
                  hint="Where the restaurant actually is. Daylight saving is handled by the zone itself."
                  error={fieldErrors.timeZoneId?.[0]}
                >
                  <Select
                    id="timezone"
                    value={zoneId}
                    onChange={(event) => setZoneId(event.target.value)}
                    aria-describedby={describedBy("timezone", {
                      hasHint: true,
                      hasError: fieldErrors.timeZoneId !== undefined,
                    })}
                  >
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {formatOffset(zone.currentUtcOffsetMinutes)} · {zone.id}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="A service day starts at"
                  htmlFor="day-start"
                  hint="Midnight for most restaurants. Later for anywhere that trades past it, so late takings count against the evening that earned them."
                  error={fieldErrors.dayStartHour?.[0]}
                >
                  <Select
                    id="day-start"
                    value={String(dayStartHour)}
                    onChange={(event) => setDayStartHour(Number(event.target.value))}
                    aria-describedby={describedBy("day-start", {
                      hasHint: true,
                      hasError: fieldErrors.dayStartHour !== undefined,
                    })}
                  >
                    {hours().map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHour(hour)}
                        {hour === 0 ? " (midnight)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void save()}
                    disabled={!isDirty || isSaving}
                    icon={<Save />}
                  >
                    {isSaving ? "Saving…" : isDirty ? "Save settings" : "Saved"}
                  </Button>
                  {isDirty && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setZoneId(settings.timeZoneId);
                        setDayStartHour(settings.dayStartHour);
                        setSaveError(null);
                        setFieldErrors({});
                      }}
                    >
                      Discard
                    </Button>
                  )}
                </div>
              </div>
            </Surface>

            {/* What the stored settings currently amount to. Computed by the server,
                so this is the same boundary the dashboard counts from rather than a
                second opinion worked out here. */}
            <Surface>
              <SurfaceHeader
                title="In effect now"
                description="What the saved settings mean at this moment"
              />
              <dl className="divide-y divide-border">
                <DetailRow label="Timezone">
                  <span className="flex items-center gap-2">
                    <Globe className="size-3.5 text-muted" aria-hidden="true" />
                    {settings.timeZoneDisplayName}
                  </span>
                </DetailRow>
                <DetailRow label="Offset from UTC">
                  {formatOffset(settings.currentUtcOffsetMinutes)}
                </DetailRow>
                <DetailRow label="Day starts at">
                  {formatHour(settings.dayStartHour)}
                </DetailRow>
                <DetailRow label="Current day began">
                  <span className="flex items-center gap-2">
                    <Clock className="size-3.5 text-muted" aria-hidden="true" />
                    {new Date(settings.serviceDayStartedAtUtc).toLocaleString()}
                  </span>
                </DetailRow>
              </dl>
            </Surface>

            {isDirty && (
              <p className="text-xs text-muted">
                Unsaved. Today figures on the dashboard will keep using the saved
                boundary until you save.
              </p>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

/** Every hour of the clock, for the day-boundary choice. */
function hours(): number[] {
  return Array.from(
    { length: DAY_START_HOURS.max - DAY_START_HOURS.min + 1 },
    (_, index) => DAY_START_HOURS.min + index,
  );
}

/** An offset as a person writes it, such as +05:45. */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  const hour = Math.floor(absolute / 60);
  const minute = absolute % 60;

  return `UTC${sign}${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** An hour of the clock as a label, such as 03:00. */
function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
