"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { navigationFor, roleLabel } from "@/components/layout/nav-config";
import type { NavItem } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils/cn";

/** Product mark. Kept small: this is application chrome, not a logo splash. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3.5">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg"
        aria-hidden="true"
      >
        <UtensilsCrossed className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-text">
          Restaurant OS
        </span>
        <span className="truncate text-2xs text-subtle">Management platform</span>
      </span>
    </div>
  );
}

function NavLink({
  item,
  currentPath,
  exactMatchElsewhere,
}: {
  item: NavItem;
  currentPath: string;
  exactMatchElsewhere: boolean;
}) {
  const Icon = item.icon;

  if (item.status === "planned") {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-subtle"
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 rounded border border-border px-1 text-2xs text-subtle">
          Soon
        </span>
      </span>
    );
  }

  // Exact match wins. A nested route highlights its parent section too, unless
  // another entry matches the path exactly: /orders/new belongs to "New order",
  // not to "Orders".
  const isActive =
    currentPath === item.href ||
    (!exactMatchElsewhere &&
      item.href !== undefined &&
      item.href !== "/dashboard" &&
      currentPath.startsWith(item.href + "/"));

  return (
    <Link
      href={item.href ?? "#"}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary-soft font-medium text-primary"
          : "text-muted hover:bg-surface-3 hover:text-text",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

/**
 * The navigation list. Shared by the desktop sidebar and the mobile drawer so
 * the two can never fall out of sync.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const groups = navigationFor(user?.platformRole, user?.staffRole);

  // Whether some entry addresses this exact path, which decides if a parent
  // section should also light up.
  const exactMatchElsewhere = groups
    .flatMap((group) => group.items)
    .some((item) => item.href === pathname);

  return (
    <nav
      aria-label="Main"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 py-2"
      onClick={onNavigate}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-1">
          {group.label !== undefined && (
            <h3 className="px-3 pt-1 pb-0.5 text-2xs font-semibold tracking-wider text-subtle uppercase">
              {group.label}
            </h3>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              currentPath={pathname}
              exactMatchElsewhere={exactMatchElsewhere}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Account area pinned to the bottom of the sidebar. */
export function UserPanel() {
  const { user, signOut } = useAuth();

  const initials =
    user?.fullName
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

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
        <span className="truncate text-2xs text-subtle">
          {roleLabel(user?.platformRole, user?.staffRole)}
        </span>
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

/** Persistent desktop sidebar. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <Brand />
      <SidebarNav />
      <UserPanel />
    </aside>
  );
}
