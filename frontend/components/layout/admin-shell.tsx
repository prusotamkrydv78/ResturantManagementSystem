"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UtensilsCrossed,
} from "lucide-react";
import { Dialog, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ToastSoundToggle } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { navigationFor, roleLabel, type NavItem } from "@/components/layout/nav-config";
import { useAuth } from "@/features/auth/auth-context";
import { useRealtimeStatus } from "@/lib/realtime/realtime-context";
import { useAdminLiveUpdates } from "@/queries/admin";
import { useManagerLiveUpdates, usePrefetchManagerRoute } from "@/queries/manager";
import { LiveUpdatesBanner } from "@/lib/realtime/live-updates-banner";
import { cn } from "@/lib/utils/cn";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";

/** Where the console sidebar's fold is remembered. */
const COLLAPSED_KEY = "rms.nav.consoleCollapsed";

/**
 * The console frame: a floating ink sidebar and a slim bar across the top.
 *
 * Worn by the platform owner and, since the manager redesign, by restaurant
 * managers too - the two roles that run a business from a screen rather than work
 * a station on the floor. Waiters and chefs keep the dense operational shell.
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
  const { user } = useAuth();
  // Folded to an icon strip, for a manager who wants the width back. Remembered in
  // the browser, the way the old sidebar remembered its own fold.
  const [collapsed, setCollapsed] = useStoredPreference(COLLAPSED_KEY, false);
  const scrollRoot = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // The window no longer scrolls, so the router's own reset to the top on a new
  // page does not reach the column that does. Done here instead.
  useEffect(() => {
    scrollRoot.current?.scrollTo({ top: 0 });
    if (scrollRoot.current) {
      delete scrollRoot.current.dataset.scrolled;
    }
  }, [pathname]);

  // Marks the column while it moves and for a beat after, so the scrollbar can
  // fade in with the movement and away once it stops (see globals.css).
  useEffect(() => {
    const column = scrollRoot.current;

    if (!column) {
      return;
    }

    let timer = 0;
    const onScroll = () => {
      // The soft edge under the bar only once something has gone under it; at the
      // top of a page it would sit over the breadcrumb.
      if (column.scrollTop > 4) {
        column.dataset.scrolled = "";
      } else {
        delete column.dataset.scrolled;
      }

      column.dataset.scrolling = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => delete column.dataset.scrolling, 900);
    };

    column.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timer);
      column.removeEventListener("scroll", onScroll);
    };
  }, []);

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
    // A fixed frame: the window never scrolls, only the content column does. The
    // sidebar and the bar are plain parts of the layout rather than sticky ones,
    // which is what stops them shivering while the page moves under them.
    <div className="flex h-svh overflow-hidden bg-canvas lg:gap-2 lg:p-2">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col rounded-2xl bg-sidebar text-sidebar-fg transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-[4.25rem]" : "w-60",
        )}
      >
        <AdminBrand collapsed={collapsed} />
        <AdminNav collapsed={collapsed} />
        <AdminAccount collapsed={collapsed} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Always in view: it sits above the scrolling column rather than in it. */}
        <header className="z-30 flex h-12 shrink-0 items-center gap-2 bg-canvas px-4 lg:px-4">
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

          <Tooltip content={collapsed ? "Show sidebar" : "Hide sidebar"}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
              aria-pressed={collapsed}
              className="hidden rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-text lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-[18px]" aria-hidden="true" />
              )}
            </button>
          </Tooltip>

          <span className="lg:hidden">
            <BrandMark />
          </span>

          <ServiceDate />

          <div className="ml-auto flex items-center gap-1.5">
            <LiveIndicator />
            <ThemeToggle />
            <ToastSoundToggle className="rounded-full hover:bg-surface" />
          </div>
        </header>

        {/* Says so when the live connection has been lost for a while. */}
        <LiveUpdatesBanner />
        <main ref={scrollRoot} data-scroll-root className="group/scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {/* A soft edge under the bar: what scrolls up blurs and fades into it
              instead of being cut off by a hard line. A thin strip, masked from
              solid to clear, so the blur only ever works on a few pixels. */}
          <div
            aria-hidden="true"
            className="pointer-events-none sticky top-0 z-20 -mb-8 h-8 bg-linear-to-b from-canvas to-transparent opacity-0 backdrop-blur-[6px] transition-opacity duration-300 [mask-image:linear-gradient(to_bottom,black,transparent)] group-data-[scrolled]/scroll:opacity-100"
          />
          {children}
        </main>
      </div>

      {/* The platform figures follow the server's signals while the console is
          open. Only the platform owner is sent those signals. */}
      {user?.platformRole === "SuperAdmin" && <AdminLiveUpdates />}
      {/* The restaurant's screens follow the server's order and ticket signals
          from one place, rather than each page reloading itself. */}
      {user?.platformRole === "RestaurantManager" && <ManagerLiveUpdates />}
    </div>
  );
}

function AdminLiveUpdates() {
  useAdminLiveUpdates();

  return null;
}

function ManagerLiveUpdates() {
  useManagerLiveUpdates();

  return null;
}

/** The lime tile and the name, and which console this is. */
function AdminBrand({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();

  return (
    <div className={cn("flex items-center gap-3 pt-4 pb-3", collapsed ? "justify-center px-2" : "px-4")}>
      <BrandMark />
      <span className={cn("flex min-w-0 flex-col leading-tight", collapsed && "sr-only")}>
        <span className="truncate text-base font-semibold tracking-tight text-sidebar-fg">
          Restaurant OS
        </span>
        <span className="truncate text-2xs text-sidebar-muted">
          {user?.platformRole === "SuperAdmin" ? "Platform console" : "Restaurant console"}
        </span>
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
function AdminNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { user } = useAuth();
  // A manager's links warm the cache for their screen on hover or focus, so the
  // page opens filled in. The platform owner's screens are small enough not to need it.
  const prefetchRoute = usePrefetchManagerRoute();
  const prefetch = user?.platformRole === "RestaurantManager" ? prefetchRoute : undefined;
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
          {group.label !== undefined &&
            (collapsed ? (
              <span aria-hidden="true" className="mx-3 mb-1 h-px bg-sidebar-hover" />
            ) : (
              <span className="px-3 pb-1 text-2xs font-medium tracking-wider text-sidebar-muted uppercase">
                {group.label}
              </span>
            ))}
          {group.items.map((item) => (
            <AdminNavLink
              key={item.label}
              item={item}
              isActive={isActive(item, pathname, exactMatchElsewhere)}
              onNavigate={onNavigate}
              collapsed={collapsed}
              onPrefetch={prefetch}
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
  collapsed = false,
  onPrefetch,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onPrefetch?: (href: string | undefined) => void;
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

  const link = (
    <Link
      href={item.href ?? "#"}
      onClick={onNavigate}
      onPointerEnter={() => onPrefetch?.(item.href)}
      onFocus={() => onPrefetch?.(item.href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl py-2 text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-accent font-semibold text-accent-fg"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );

  // Folded, the name moves into a tooltip so the icon strip is still readable.
  return collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link;
}

/** Who is signed in, and the way out. */
function AdminAccount({ collapsed = false }: { collapsed?: boolean }) {
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
    <div
      className={cn(
        "m-2.5 flex items-center gap-3 rounded-xl bg-sidebar-hover p-2.5",
        collapsed && "flex-col gap-2 px-1.5",
      )}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className={cn("flex min-w-0 flex-1 flex-col leading-tight", collapsed && "sr-only")}>
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

/**
 * Whether the figures on screen are following the server.
 *
 * A console that updates by itself has to say so, or nobody can tell a quiet
 * platform from a screen that stopped listening. Green and "Live" while connected;
 * the banner under the header takes over if the connection is lost for long.
 */
function LiveIndicator() {
  const status = useRealtimeStatus();

  if (status === null || !status.enabled) {
    return null;
  }

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-(--surface-shadow) sm:inline-flex"
      title={
        status.connected
          ? "Figures update the moment trading moves."
          : "Reconnecting. Figures will refresh when the connection is back."
      }
    >
      <span className="relative flex size-2">
        {status.connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            status.connected ? "bg-success" : "bg-subtle",
          )}
        />
      </span>
      {status.connected ? "Live" : "Connecting"}
    </span>
  );
}
