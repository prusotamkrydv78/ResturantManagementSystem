"use client";

import { useEffect, useState } from "react";
import { Info, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetailRow, Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { useAuth } from "@/features/auth/auth-context";
import { getPlatformOverview } from "@/features/platform/api";
import type { PlatformOverview } from "@/types/platform";

/**
 * Platform settings.
 *
 * Honest about what it is. There is no platform-wide configuration in this product — no
 * global currency, no global tax, no feature flags — so this screen does not invent a
 * form for one. What it does instead is the genuinely useful thing an administrator needs
 * from a settings page: see the shape of the estate - how many restaurants exist, who
 * runs them, and which ones nobody has been assigned to yet.
 *
 * It used to edit each restaurant timezone and the hour its service day began. Those are
 * gone: the product is hosted for Nepal only, so the day boundary is a constant and a
 * setting that can hold exactly one correct value is only a way to get it wrong.
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
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loadedOverview = await getPlatformOverview();

        if (!cancelled) {
          setOverview(loadedOverview);
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
        description="How many restaurants exist, who runs them, and how big they are."
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
                hint="Waiters and chefs"
              />
              <Stat
                label="Tables"
                value={overview.tableCount}
                hint="Across every restaurant"
              />
            </div>

            <Surface>
              <SurfaceHeader
                title="Restaurants on the platform"
                description="Who runs each one, and how big it is."
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
function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}
