"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cog } from "lucide-react";
import { RequireAuth } from "@/features/auth/require-auth";
import {
  SETTINGS_SECTIONS,
  type SettingsLink,
} from "@/components/layout/settings-nav";
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

/**
 * Whether a link is the one being viewed.
 *
 * Prefix rather than equality, so a detail screen keeps its section selected: an
 * inventory item is still inventory.
 */
function useIsCurrent(): (link: SettingsLink) => boolean {
  const pathname = usePathname();

  return (link) =>
    pathname === link.href || pathname.startsWith(link.href + "/");
}

/** The settings navigation at desktop width. */
function SettingsRail() {
  const isCurrent = useIsCurrent();
  const pathname = usePathname();

  return (
    // Pinned to the viewport rather than stretched to the content. Staff and
    // inventory are long lists, and a rail that scrolls away with them costs the
    // direct navigation this whole area exists to provide. It also sidesteps a
    // percentage height that would only resolve if every ancestor had one.
    <aside className="hidden w-56 shrink-0 border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:overflow-y-auto">
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 border-b border-border px-4 py-3.5 transition-colors",
          pathname === "/settings" ? "text-text" : "text-muted hover:text-text",
        )}
      >
        <Cog className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold">Settings</span>
      </Link>

      <nav aria-label="Settings" className="flex flex-col gap-5 px-2 py-3">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <h2 className="px-2 pb-0.5 text-2xs font-semibold tracking-wider text-subtle uppercase">
              {section.title}
            </h2>

            {section.links.map((link) => {
              const Icon = link.icon;
              const active = isCurrent(link);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-muted hover:bg-surface-3 hover:text-text",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
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
