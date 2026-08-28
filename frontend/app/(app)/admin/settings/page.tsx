"use client";

import { useEffect, useState } from "react";
import { Clock, Info, Store } from "lucide-react";
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
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import {
  EmptyState,
  ErrorState,
  FormError,
  TableSkeleton,
} from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useAuth } from "@/features/auth/auth-context";
import {
  getPlatformOverview,
  listTimeZones,
  updateRestaurantSettings,
} from "@/features/platform/api";
import { ApiError } from "@/lib/api/client";
import { DAY_START_HOURS } from "@/types/restaurant";
import type { PlatformOverview, PlatformRestaurantSettings } from "@/types/platform";
import type { TimeZoneOption } from "@/types/restaurant";

/**
 * Platform settings.
 *
 * Honest about what it is. There is no platform-wide configuration in this product — no
 * global currency, no global tax, no feature flags — so this screen does not invent a
 * form for one. What it does instead is the genuinely useful thing an administrator needs
 * from a settings page: see the shape of the estate, and correct the operational
 * configuration a restaurant was set up with.
 *
 * That configuration is the timezone and the hour a service day begins, and it matters
 * more than it looks. Get it wrong and every dashboard figure, every report boundary and
 * every "today" in that restaurant is quietly wrong from its first day — and a restaurant
 * with no manager assigned yet has nobody who can fix it for themselves.
 */
export default function PlatformSettingsPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <PlatformSettings />
    </RequireAuth>
  );
}

function PlatformSettings() {
  const { user } = useAuth();

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [zones, setZones] = useState<TimeZoneOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Both at once: the list is unusable without the zones, so failing to load
        // either is one failure rather than a screen that half works.
        const [loadedOverview, loadedZones] = await Promise.all([
          getPlatformOverview(),
          listTimeZones(),
        ]);

        if (!cancelled) {
          setOverview(loadedOverview);
          setZones(loadedZones);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load the platform.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = () => setReloadKey((key) => key + 1);

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="The shape of the estate, and how each restaurant is configured to operate."
        crumbs={[{ label: "Platform", href: "/dashboard" }, { label: "Settings" }]}
      />

      <PageBody>
        {error !== null && (
          <Surface>
            <ErrorState message={error} onRetry={refresh} />
          </Surface>
        )}

        {overview === null && error === null && (
          <Surface>
            <TableSkeleton rows={5} columns={5} />
          </Surface>
        )}

        {overview !== null && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Restaurants"
                value={overview.restaurantCount}
                hint={
                  overview.withoutManagerCount === 0
                    ? "All have a manager"
                    : `${overview.withoutManagerCount} without a manager`
                }
                tone={overview.withoutManagerCount === 0 ? "neutral" : "warning"}
              />
              <Stat
                label="Managers"
                value={overview.managerCount}
                hint={
                  overview.unassignedManagerCount === 0
                    ? "All assigned"
                    : `${overview.unassignedManagerCount} own no restaurant yet`
                }
              />
              <Stat
                label="Staff accounts"
                value={overview.staffCount}
                hint="Waiters, chefs and cashiers"
              />
              <Stat
                label="Tables"
                value={overview.tableCount}
                hint="Across every restaurant"
              />
            </div>

            <Surface>
              <SurfaceHeader
                title="Operational configuration"
                description="The timezone and service day each restaurant runs on. Every figure in that restaurant is counted against these."
                actions={
                  <Badge tone={overview.distinctTimeZoneCount > 1 ? "primary" : "neutral"}>
                    {overview.distinctTimeZoneCount}{" "}
                    {overview.distinctTimeZoneCount === 1 ? "timezone" : "timezones"}
                  </Badge>
                }
              />

              {overview.restaurants.length === 0 ? (
                <EmptyState
                  icon={<Store />}
                  title="No restaurants yet"
                  description="Create one under Restaurants, then assign it a manager."
                />
              ) : (
                <TableWrap>
                  <Table className="min-w-[48rem]">
                    <thead>
                      <tr>
                        <Th>Restaurant</Th>
                        <Th>Manager</Th>
                        <Th>Timezone</Th>
                        <Th>Day starts</Th>
                        <Th>Current day began</Th>
                        <Th>
                          <span className="sr-only">Actions</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.restaurants.map((restaurant) => (
                        <Tr key={restaurant.id}>
                          <Td>
                            <span className="font-medium text-text">
                              {restaurant.name}
                            </span>
                            <p className="font-mono text-2xs text-subtle">
                              {restaurant.slug}
                            </p>
                            <p className="text-2xs text-subtle">
                              {restaurant.tableCount}{" "}
                              {restaurant.tableCount === 1 ? "table" : "tables"} ·{" "}
                              {restaurant.staffCount} staff
                            </p>
                          </Td>
                          <Td className="text-muted">
                            {restaurant.managerName === null ? (
                              <Badge tone="warning">Unassigned</Badge>
                            ) : (
                              <>
                                {restaurant.managerName}
                                <p className="text-2xs text-subtle">
                                  {restaurant.managerEmail}
                                </p>
                              </>
                            )}
                          </Td>
                          <Td className="text-muted">
                            <span className="font-mono text-xs">
                              {restaurant.timeZoneId}
                            </span>
                            <p className="text-2xs text-subtle">
                              {formatOffset(restaurant.currentUtcOffsetMinutes)}
                            </p>
                          </Td>
                          <Td className="tabular text-muted">
                            {String(restaurant.dayStartHour).padStart(2, "0")}:00
                          </Td>
                          <Td className="text-xs whitespace-nowrap text-muted">
                            {formatDateTime(restaurant.serviceDayStartedAtUtc)}
                          </Td>
                          <Td className="text-right">
                            <SettingsDialog
                              restaurant={restaurant}
                              zones={zones}
                              onSaved={refresh}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Surface>

            <Surface>
              <SurfaceHeader title="This account" />
              <dl className="divide-y divide-border">
                <DetailRow label="Name">{user?.fullName ?? "—"}</DetailRow>
                <DetailRow label="Email">{user?.email ?? "—"}</DetailRow>
                <DetailRow label="Role">Platform administrator</DetailRow>
                <DetailRow label="Server clock" mono>
                  {formatDateTime(overview.serverUtcNow)}
                </DetailRow>
              </dl>
            </Surface>

            <p className="flex items-start gap-2 text-xs text-subtle">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                There is nothing else to configure at the platform level. This product has
                no global currency, tax rate or feature flags, so this page shows what
                exists rather than a form for settings that do not.
              </span>
            </p>
          </>
        )}
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Surface className="flex flex-col gap-0.5 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="text-2xl font-semibold text-text tabular">{value}</p>
      <p className={tone === "warning" ? "text-xs text-warning" : "text-xs text-muted"}>
        {hint}
      </p>
    </Surface>
  );
}

/**
 * Changing one restaurant timezone and service day.
 *
 * Both values are sent together rather than one at a time, so a save cannot leave the
 * pair half-applied. The zone list comes from the server, so the options offered can
 * never include something the validation would reject.
 */
function SettingsDialog({
  restaurant,
  zones,
  onSaved,
}: {
  restaurant: PlatformRestaurantSettings;
  zones: TimeZoneOption[] | null;
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoneId, setZoneId] = useState(restaurant.timeZoneId);
  const [hour, setHour] = useState(String(restaurant.dayStartHour));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setZoneId(restaurant.timeZoneId);
    setHour(String(restaurant.dayStartHour));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await updateRestaurantSettings(restaurant.id, {
        timeZoneId: zoneId,
        dayStartHour: Number(hour),
      });

      setIsOpen(false);
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Unable to save these settings.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDirty =
    zoneId !== restaurant.timeZoneId || hour !== String(restaurant.dayStartHour);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" icon={<Clock />}>
          Configure
        </Button>
      </DialogTrigger>

      <DialogContent
        title={restaurant.name}
        description="Every figure in this restaurant is counted against these two values."
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 px-4 py-4">
            {error !== null && <FormError message={error} />}

            {restaurant.managerName === null && (
              <p className="rounded-md border border-warning-border bg-warning-soft px-2.5 py-2 text-sm text-warning">
                This restaurant has no manager yet, so nobody else can correct these
                settings for it.
              </p>
            )}

            <Field
              htmlFor={`zone-${restaurant.id}`}
              label="Timezone"
              required
              hint="Only zones this server recognises are offered."
            >
              <Select
                id={`zone-${restaurant.id}`}
                required
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                aria-describedby={describedBy(`zone-${restaurant.id}`, {
                  hasHint: true,
                })}
              >
                {zones === null ? (
                  <option value={zoneId}>Loading…</option>
                ) : (
                  zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.id} · {formatOffset(zone.currentUtcOffsetMinutes)}
                    </option>
                  ))
                )}
              </Select>
            </Field>

            <Field
              htmlFor={`hour-${restaurant.id}`}
              label="A service day starts at"
              required
              hint="Local hour, 0 to 23. An order at 02:00 belongs to the previous day when this is set to 6."
            >
              <Input
                id={`hour-${restaurant.id}`}
                type="number"
                inputMode="numeric"
                required
                min={DAY_START_HOURS.min}
                max={DAY_START_HOURS.max}
                className="sm:max-w-32"
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                aria-describedby={describedBy(`hour-${restaurant.id}`, {
                  hasHint: true,
                })}
              />
            </Field>

            <dl className="divide-y divide-border rounded-md border border-border bg-surface-2">
              <DetailRow label="In force now">
                {restaurant.timeZoneDisplayName}
              </DetailRow>
              <DetailRow label="Current day began" mono>
                {formatDateTime(restaurant.serviceDayStartedAtUtc)}
              </DetailRow>
            </dl>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving…" : "Save settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** An offset in minutes, as somebody would write it. */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const total = Math.abs(minutes);
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const rest = String(total % 60).padStart(2, "0");

  return `UTC${sign}${hours}:${rest}`;
}

function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
