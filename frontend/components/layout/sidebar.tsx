"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { navigationFor, roleLabel } from "@/components/layout/nav-config";
import { NavSection, useClosedSections } from "@/components/layout/nav-section";
import type { NavItem } from "@/components/layout/nav-config";
import { RailLabel, Tooltip } from "@/components/ui/tooltip";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import { cn } from "@/lib/utils/cn";

const SIDEBAR_KEY = "rms.nav.sidebarCollapsed";
const GROUPS_KEY = "rms.nav.collapsedGroups";

/**
 * The collapse preference again, for the settings area only, and defaulted the
 * other way.
 *
 * Settings brings its own navigation, so two full-width rails would be arguing
 * over the same edge of the screen; the main one folds to a rail on arrival. A
 * second key rather than forcing the collapse, because forcing it would leave the
 * toggle inert in there - somebody who wants both rails should be able to say so,
 * and be remembered. Leaving the area restores whatever they chose outside.
 */
const SETTINGS_SIDEBAR_KEY = "rms.nav.sidebarCollapsedInSettings";

/** Where the settings area begins. Its layout supplies the navigation inside it. */
const SETTINGS_ROOT = "/settings";

/** Product mark. Kept small: this is application chrome, not a logo splash. */
export function Brand({ isCollapsed = false }: { isCollapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-3.5",
        isCollapsed ? "justify-center px-0" : "px-3",
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg"
        aria-hidden="true"
      >
        <UtensilsCrossed className="size-4" />
      </span>
      {/* Hidden rather than unmounted, so the collapse does not reflow the row. */}
      {!isCollapsed && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-text">
            Restaurant OS
          </span>
          <span className="truncate text-2xs text-subtle">Management platform</span>
        </span>
      )}
    </div>
  );
}

function NavLink({
  item,
  currentPath,
  exactMatchElsewhere,
  isCollapsed,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  exactMatchElsewhere: boolean;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (item.status === "planned") {
    return (
      <RailLabel label={`${item.label} (soon)`} isCollapsed={isCollapsed}>
        <span
          aria-disabled="true"
          className={cn(
            "flex cursor-not-allowed items-center gap-2.5 rounded-md py-1.5 text-sm text-subtle",
            isCollapsed ? "justify-center px-0" : "px-3",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {!isCollapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 rounded border border-border px-1 text-2xs text-subtle">
                Soon
              </span>
            </>
          )}
        </span>
      </RailLabel>
    );
  }

  // Exact match wins. A nested route highlights its parent section too, unless
  // another entry matches the path exactly: /orders/new belongs to "New order",
  // not to "Orders". That second rule is also what keeps Settings selected across
  // the whole of its area, /settings/tables included.
  const isActive =
    currentPath === item.href ||
    (!exactMatchElsewhere &&
      item.href !== undefined &&
      item.href !== "/dashboard" &&
      currentPath.startsWith(item.href + "/"));

  return (
    <RailLabel label={item.label} isCollapsed={isCollapsed}>
      <Link
        href={item.href ?? "#"}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        // The accessible name is stated rather than left to the glyph, because the
        // label is the only thing naming this link once the text is gone. The
        // tooltip describes it as well, but a description is not a name.
        aria-label={isCollapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-md py-1.5 text-sm transition-colors",
          isCollapsed ? "justify-center px-0" : "px-3",
          isActive
            ? "bg-primary-soft font-medium text-primary"
            : "text-muted hover:bg-surface-3 hover:text-text",
        )}
      >
        {/* A rail of icons loses the selected row at a glance, so the active one
            also carries a marker on the edge it is anchored to. */}
        {isActive && isCollapsed && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
          />
        )}
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {!isCollapsed && (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        )}
      </Link>
    </RailLabel>
  );
}

/**
 * The navigation list. Shared by the desktop sidebar and the mobile drawer so
 * the two can never fall out of sync.
 *
 * Sections remember whether they are folded. The rail ignores that: with no
 * headings to click there would be no way to unfold a section, so a collapsed
 * sidebar always shows every icon.
 */
export function SidebarNav({
  onNavigate,
  isCollapsed = false,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const groups = navigationFor(user?.platformRole, user?.staffRole);

  const [isSectionClosed, toggleSection] = useClosedSections(GROUPS_KEY);

  // Whether some entry addresses this exact path, which decides if a parent
  // section should also light up.
  const exactMatchElsewhere = groups
    .flatMap((group) => group.items)
    .some((item) => item.href === pathname);

  return (
    <nav
      aria-label="Main"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-2 py-2"
    >
      {groups.map((group, groupIndex) => {
        const items = group.items.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            currentPath={pathname}
            exactMatchElsewhere={exactMatchElsewhere}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ));

        // The rail has no headings, so the grouping is carried by a rule instead.
        // Without it eleven icons read as one undifferentiated column.
        if (isCollapsed) {
          return (
            <div
              key={group.label ?? `group-${groupIndex}`}
              className={cn(
                "flex flex-col gap-1",
                groupIndex > 0 && "border-t border-border pt-4",
              )}
            >
              {items}
            </div>
          );
        }

        // A group with no heading has nothing to click, and is the one that should
        // always be there anyway: it is what the role opens the product for.
        //
        // Bound to a local rather than read off `group` inside the handler, because
        // the narrowing from the check above does not survive into a closure.
        const { label } = group;

        if (label === undefined) {
          return (
            <div key={`group-${groupIndex}`} className="flex flex-col gap-1">
              {items}
            </div>
          );
        }

        return (
          <NavSection
            key={label}
            label={label}
            indentClassName="px-3"
            isOpen={!isSectionClosed(label)}
            onToggle={() => toggleSection(label)}
          >
            {items}
          </NavSection>
        );
      })}
    </nav>
  );
}

/** Account area pinned to the bottom of the sidebar. */
export function UserPanel({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { user, signOut } = useAuth();

  const initials =
    user?.fullName
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const label = roleLabel(user?.platformRole, user?.staffRole);

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-border px-2 py-3">
        <Tooltip
          content={
            <span className="flex flex-col">
              <span>{user?.fullName ?? "Signed in"}</span>
              <span className="text-subtle">{label}</span>
            </span>
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-2xs font-semibold text-muted">
            {initials}
          </span>
        </Tooltip>

        <Tooltip content="Sign out">
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 border-t border-border px-3 py-3">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-2xs font-semibold text-muted"
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-text">
          {user?.fullName ?? "Signed in"}
        </span>
        <span className="truncate text-2xs text-subtle">{label}</span>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sign out"
        title="Sign out"
        className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Persistent desktop sidebar, which collapses to a rail of icons.
 *
 * A rail rather than nothing at all: hiding the navigation outright would buy
 * about forty more pixels of content and cost every destination, which is a bad
 * trade on the one screen somebody keeps open all evening. Collapsed, the product
 * is still one click from anywhere.
 */
export function Sidebar() {
  const pathname = usePathname();
  const inSettings =
    pathname === SETTINGS_ROOT || pathname.startsWith(SETTINGS_ROOT + "/");

  // Both are read every render rather than one being chosen first, because hooks
  // cannot be called conditionally. Only one of them is applied.
  const [collapsedOutside, setCollapsedOutside] = useStoredPreference(
    SIDEBAR_KEY,
    false,
  );
  const [collapsedInSettings, setCollapsedInSettings] = useStoredPreference(
    SETTINGS_SIDEBAR_KEY,
    true,
  );

  const isCollapsed = inSettings ? collapsedInSettings : collapsedOutside;

  const toggle = useCallback(() => {
    if (inSettings) {
      setCollapsedInSettings(!collapsedInSettings);
    } else {
      setCollapsedOutside(!collapsedOutside);
    }
  }, [
    inSettings,
    collapsedInSettings,
    collapsedOutside,
    setCollapsedInSettings,
    setCollapsedOutside,
  ]);

  // Anywhere on the folded rail that is not already a link reopens it. The whole
  // panel becomes the target that way, which is a great deal easier to hit than a
  // twenty-four pixel circle, and it matches what the shape suggests: a folded
  // thing opens when you press it.
  //
  // Guarded on what was actually pressed rather than by stopping propagation in
  // every child, so adding a control to the rail later cannot silently start
  // reopening it. Only while collapsed: clicking the open sidebar must not fold
  // it, or every miss between two rows would.
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

  return (
    <aside
      onClick={expandOnEmptyClick}
      className={cn(
        // Pinned to the viewport. Without this the panel is an ordinary flex item
        // as tall as the page beside it, so on any long screen its contents sit at
        // the top and scroll out of sight - navigation you have to scroll back up
        // to reach is not navigation. The settings rail was already pinned, which
        // is what made the two disagree on the same screen.
        "relative hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-svh",
        isCollapsed ? "w-16 cursor-e-resize" : "w-60",
      )}
    >
      <Brand isCollapsed={isCollapsed} />
      <SidebarNav isCollapsed={isCollapsed} />
      <UserPanel isCollapsed={isCollapsed} />

      {/* Centred on the seam between the sidebar and the content, which is the
          edge it moves. Halfway down puts it near the pointer wherever somebody is
          reading rather than making them travel to a corner, and it straddles the
          border so it reads as a handle on the panel instead of a button floating
          inside it.

          Left visible rather than revealed on hover: a control nobody can see is a
          control nobody finds, and this one is worth about forty-four pixels of
          content to a manager on a laptop. It stays quiet through colour instead. */}
      <Tooltip content={isCollapsed ? "Expand the sidebar" : "Collapse the sidebar"}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand the sidebar" : "Collapse the sidebar"}
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
