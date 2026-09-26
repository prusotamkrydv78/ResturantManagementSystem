"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LogOut, Menu, Monitor, Moon, Sun, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ToastSoundToggle } from "@/components/ui/toast";
import { navigationFor, roleLabel, type NavItem } from "@/components/layout/nav-config";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/lib/theme/use-theme";
import { THEMES, THEME_LABELS, type ThemePreference } from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

/**
 * The platform owner's frame: a floating sidebar and a slim bar across the top.
 *
 * WHY A SEPARATE SHELL
 *
 * The super admin reads the estate; everybody else works a service. The operational
 * shell is dense on purpose - a waiter's screen should waste nothing - and the
 * platform console is the opposite case: glanced at a few times a day, on a large
 * screen, to see whether things are healthy and where to act. So it gets its own
 * frame and its own surface (see the data-surface="admin" block in globals.css)
 * without changing a pixel for anybody else.
 *
 * The surface is switched on while this is mounted and off when it is not, so
 * signing out, or an account change, puts the application's own look back.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // A layout effect, so the surface is in place before the first paint rather than
  // flashing the operational look for a frame.
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.surface = "admin";

    return () => {
      delete root.dataset.surface;
    };
  }, []);

  return (
    <div className="flex min-h-svh bg-canvas lg:gap-2 lg:p-2">
      <aside className="sticky top-2 hidden h-[calc(100svh-1rem)] w-60 shrink-0 flex-col rounded-2xl bg-sidebar text-sidebar-fg lg:flex">
        <AdminBrand />
        <AdminNav />
        <AdminAccount />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-4 pt-2 lg:px-4 lg:pt-1">
          <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-text lg:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DrawerContent title="Navigation">
              <div className="flex h-full flex-col bg-sidebar text-sidebar-fg">
                <AdminBrand />
                <AdminNav onNavigate={() => setIsDrawerOpen(false)} />
                <AdminAccount />
              </div>
            </DrawerContent>
          </Dialog>

          <span className="lg:hidden">
            <BrandMark />
          </span>

          <ServiceDate />

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeSwitch />
            <ToastSoundToggle className="rounded-full hover:bg-surface" />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** The lime tile and the name. */
function AdminBrand() {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
      <BrandMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-base font-semibold tracking-tight text-sidebar-fg">
          Restaurant OS
        </span>
        <span className="truncate text-2xs text-sidebar-muted">Platform console</span>
      </span>
    </div>
  );
}

function BrandMark() {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg"
      aria-hidden="true"
    >
      <UtensilsCrossed className="size-[18px]" />
    </span>
  );
}

/**
 * The navigation, from the same table every role's sidebar reads.
 *
 * The current page is a filled lavender pill, which is the one place in the frame
 * that colour means "you are here".
 */
function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const groups = navigationFor(user?.platformRole, user?.staffRole);

  // A page listed in its own right wins over a parent that merely prefixes it.
  const exactMatchElsewhere = groups
    .flatMap((group) => group.items)
    .some((item) => item.href === pathname);

  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-1">
      {groups.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
          {group.label !== undefined && (
            <span className="px-3 pb-1 text-2xs font-medium tracking-wider text-sidebar-muted uppercase">
              {group.label}
            </span>
          )}
          {group.items.map((item) => (
            <AdminNavLink
              key={item.label}
              item={item}
              isActive={isActive(item, pathname, exactMatchElsewhere)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function isActive(item: NavItem, pathname: string, exactMatchElsewhere: boolean): boolean {
  return (
    pathname === item.href ||
    (!exactMatchElsewhere &&
      item.href !== undefined &&
      item.href !== "/dashboard" &&
      pathname.startsWith(item.href + "/"))
  );
}

function AdminNavLink({
  item,
  isActive: active,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (item.status === "planned") {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-muted"
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="rounded-full bg-sidebar-hover px-2 py-0.5 text-2xs">Soon</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href ?? "#"}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-semibold text-accent-fg"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

/** Who is signed in, and the way out. */
function AdminAccount() {
  const { user, signOut } = useAuth();

  if (user === null) {
    return null;
  }

  const initials =
    user.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <div className="m-2.5 flex items-center gap-3 rounded-xl bg-sidebar-hover p-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-sidebar-fg">{user.fullName}</span>
        <span className="truncate text-2xs text-sidebar-muted">
          {roleLabel(user.platformRole, user.staffRole)}
        </span>
      </span>
      <Tooltip content="Sign out">
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar hover:text-sidebar-fg"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * Today, as the restaurants count it.
 *
 * Every daily figure on the platform closes at midnight in Nepal, so the date shown
 * is Nepal's rather than the viewer's - an admin abroad sees the day the numbers
 * belong to.
 */
function ServiceDate() {
  const [label] = useState(() =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kathmandu",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()),
  );

  return (
    <span className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs text-muted shadow-(--surface-shadow) sm:inline-flex">
      <CalendarDays className="size-3.5 text-subtle" aria-hidden="true" />
      <span className="font-medium text-text">{label}</span>
      <span className="text-subtle">· service day</span>
    </span>
  );
}

const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Three icons in a pill.
 *
 * Icons with tooltips rather than labelled segments, which is what used to be
 * squeezed into the sidebar footer and clipped its last word under the bell.
 */
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-full bg-surface p-1 shadow-(--surface-shadow)"
    >
      {THEMES.map((option) => {
        const Icon = THEME_ICONS[option];
        const selected = option === theme;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={THEME_LABELS[option]}
            title={THEME_LABELS[option]}
            onClick={() => setTheme(option)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors",
              selected ? "bg-ink text-surface" : "text-subtle hover:text-text",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
