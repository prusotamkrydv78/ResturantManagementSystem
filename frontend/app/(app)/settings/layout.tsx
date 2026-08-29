"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, Cog } from "lucide-react";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  SETTINGS_SECTIONS,
  type SettingsLink,
} from "@/components/layout/settings-nav";
import { NavSection, useClosedSections } from "@/components/layout/nav-section";
import { RailLabel, Tooltip } from "@/components/ui/tooltip";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import { cn } from "@/lib/utils/cn";

/**
 * The settings area and its own navigation.
 *
 * A second rail rather than a trip back through the landing page each time: these
 * five screens are visited together - you add a table, then the waiter who works
 * it - and making every hop pass through a menu would undo the point of gathering
 * them. The main sidebar collapses itself while you are in here, so the two never
 * compete for the same edge of the screen.
 */
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <RequireAuth roles={["RestaurantManager"]}>
      <div className="flex min-h-full flex-col lg:flex-row">
        <SettingsRail />
        <SettingsTabs />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RequireAuth>
  );
}

/** Folds the same way the main sidebar does, and remembers it the same way. */
const RAIL_KEY = "rms.nav.settingsRailCollapsed";

/** Which of its headings are folded, remembered separately from the main sidebar. */
const SECTIONS_KEY = "rms.nav.settingsClosedSections";

/**
 * Whether a link is the one being viewed.
 *
 * Prefix rather than equality, so a detail screen keeps its section selected: an
 * inventory item is still inventory.
 */
function useIsCurrent(): (link: SettingsLink) => boolean {
  const pathname = usePathname();

  return (link) => pathname === link.href || pathname.startsWith(link.href + "/");
}

/** The settings navigation at desktop width. */
function SettingsRail() {
  const isCurrent = useIsCurrent();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useStoredPreference(RAIL_KEY, false);
  const [isSectionClosed, toggleSection] = useClosedSections(SECTIONS_KEY);

  const toggle = useCallback(
    () => setIsCollapsed(!isCollapsed),
    [isCollapsed, setIsCollapsed],
  );

  // Same bargain as the main sidebar: the folded panel is its own reopen target,
  // which is far easier to hit than the handle, and pressing a folded thing to
  // open it is what the shape already suggests.
  const expandOnEmptyClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!isCollapsed) {
        return;
      }

      if ((event.target as HTMLElement).closest("a,button,[role='tooltip']")) {
        return;
      }

      toggle();
    },
    [isCollapsed, toggle],
  );

  const isOnLanding = pathname === "/settings";

  return (
    // Pinned to the viewport rather than stretched to the content. Staff and
    // inventory are long lists, and a rail that scrolls away with them costs the
    // direct navigation this whole area exists to provide. It also sidesteps a
    // percentage height that would only resolve if every ancestor had one.
    <aside
      onClick={expandOnEmptyClick}
      className={cn(
        "relative hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col",
        isCollapsed ? "w-14 cursor-e-resize" : "w-56",
      )}
    >
      <RailLabel label="Settings" isCollapsed={isCollapsed}>
        <Link
          href="/settings"
          aria-current={isOnLanding ? "page" : undefined}
          aria-label={isCollapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2.5 border-b border-border py-3.5 transition-colors",
            isCollapsed ? "justify-center px-0" : "px-4",
            isOnLanding ? "text-text" : "text-muted hover:text-text",
          )}
        >
          <Cog className="size-4 shrink-0" aria-hidden="true" />
          {!isCollapsed && <span className="text-sm font-semibold">Settings</span>}
        </Link>
      </RailLabel>

      <nav
        aria-label="Settings"
        // Scrolls here rather than on the panel: a scroll container on the aside
        // would compute overflow-x to auto as well, and clip the handle that hangs
        // off its right edge.
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-2 py-3"
      >
        {SETTINGS_SECTIONS.map((section, sectionIndex) => {
          const links = section.links.map((link) => {
            const Icon = link.icon;
            const active = isCurrent(link);

            return (
              <RailLabel
                key={link.href}
                label={link.label}
                isCollapsed={isCollapsed}
              >
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={isCollapsed ? link.label : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md py-1.5 text-sm transition-colors",
                    isCollapsed ? "justify-center px-0" : "px-2",
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted hover:bg-surface-3 hover:text-text",
                  )}
                >
                  {active && isCollapsed && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!isCollapsed && (
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                  )}
                </Link>
              </RailLabel>
            );
          });

          // Folded to icons there is no heading to press, so there would be no way
          // back out of a closed section. The rail shows every icon and carries the
          // grouping with a rule instead.
          if (isCollapsed) {
            return (
              <div
                key={section.title}
                className={cn(
                  "flex flex-col gap-1",
                  sectionIndex > 0 && "border-t border-border pt-4",
                )}
              >
                {links}
              </div>
            );
          }

          return (
            <NavSection
              key={section.title}
              label={section.title}
              // h2 rather than the sidebar's h3: this rail is the page's own
              // navigation, not a level nested inside something else.
              as="h2"
              isOpen={!isSectionClosed(section.title)}
              onToggle={() => toggleSection(section.title)}
            >
              {links}
            </NavSection>
          );
        })}
      </nav>

      {/* Centred on this rail's own seam, matching the main sidebar handle. The
          two sit on different edges and never overlap, because this one only
          exists inside the area the other one folds for. */}
      <Tooltip
        content={isCollapsed ? "Expand settings menu" : "Collapse settings menu"}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed ? "Expand the settings menu" : "Collapse the settings menu"
          }
          className="absolute top-1/2 -right-3 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-subtle shadow-sm transition-colors hover:border-primary-border hover:bg-primary-soft hover:text-primary"
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </aside>
  );
}

/**
 * The same navigation below desktop width, as a scrolling strip.
 *
 * A rail would eat half a phone, and the mobile drawer already carries one row for
 * the whole area. Flattened out of its sections deliberately: five entries do not
 * need headings, and headings do not survive being laid on their side.
 */
function SettingsTabs() {
  const isCurrent = useIsCurrent();

  return (
    <nav
      aria-label="Settings"
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:hidden"
    >
      {SETTINGS_SECTIONS.flatMap((section) => section.links).map((link) => {
        const Icon = link.icon;
        const active = isCurrent(link);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary-soft font-medium text-primary"
                : "text-muted hover:bg-surface-3 hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
