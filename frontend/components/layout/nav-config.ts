import {
  Armchair,
  Boxes,
  CalendarClock,
  ChartNoAxesColumn,
  Cog,
  Contact,
  LayoutGrid,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Plus,
  ReceiptText,
  ScrollText,
  Store,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PlatformRole } from "@/types/auth";
import type { StaffRole } from "@/types/staff";

/**
 * Navigation is data, not markup.
 *
 * `planned` entries render disabled and labelled, never as working links, so nothing
 * pretends to be built. Nothing is planned at the moment: every row in every role points
 * at a screen that exists. The status stays in the type because listing a disabled row is
 * still the honest way to settle an information architecture before the screen lands.
 */
export interface NavItem {
  label: string;
  /** Present only for available items. */
  href?: string;
  icon: LucideIcon;
  status: "available" | "planned";
}

export interface NavGroup {
  /** Omitted for the first group, which needs no heading. */
  label?: string;
  items: NavItem[];
}

const SUPER_ADMIN_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
      },
      {
        label: "Restaurants",
        href: "/admin/restaurants",
        icon: Store,
        status: "available",
      },
      {
        label: "Managers",
        href: "/admin/managers",
        icon: Users,
        status: "available",
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        label: "Reports",
        href: "/admin/reports",
        icon: ChartNoAxesColumn,
        status: "available",
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Cog,
        status: "available",
      },
    ],
  },
];

// The manager workspace lists only areas that exist. There are no branches in this
// product, and no placeholder rows for features that have not been built. Billing
// sits directly under the restaurant, above the setup areas, because settling a
// table is the thing a manager does repeatedly during service. Reservations and
// customers follow it, since both are consulted during service rather than set up
// once; the setup areas stay below them.
const MANAGER_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
      },
      {
        label: "My restaurant",
        href: "/my-restaurant",
        icon: Store,
        status: "available",
      },
      {
        label: "Floor",
        href: "/floor",
        icon: LayoutGrid,
        status: "available",
      },
      {
        label: "Billing",
        href: "/billing",
        icon: ReceiptText,
        status: "available",
      },
      {
        label: "Reservations",
        href: "/reservations",
        icon: CalendarClock,
        status: "available",
      },
      {
        label: "Customers",
        href: "/customers",
        icon: Contact,
        status: "available",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: ChartNoAxesColumn,
        status: "available",
      },
      {
        label: "Menu",
        href: "/menu",
        icon: ScrollText,
        status: "available",
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        status: "available",
      },
      {
        label: "Tables",
        href: "/tables",
        icon: Armchair,
        status: "available",
      },
      {
        label: "Staff",
        href: "/staff",
        icon: Users,
        status: "available",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Cog,
        status: "available",
      },
    ],
  },
];

// A waiter gets the one operational thing that exists. Manager setup areas are
// not shown to them, and nothing is listed that has not been built.
const WAITER_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
      },
      {
        label: "Floor",
        href: "/floor",
        icon: LayoutGrid,
        status: "available",
      },
      {
        label: "Orders",
        href: "/orders",
        icon: ClipboardList,
        status: "available",
      },
      {
        label: "New order",
        href: "/orders/new",
        icon: Plus,
        status: "available",
      },
    ],
  },
];

// A chef gets the rail and nothing else. Manager setup areas, the waiter order
// screens and the admin areas are all somebody else job.
const CHEF_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
      },
      {
        label: "Kitchen",
        href: "/kitchen",
        icon: ChefHat,
        status: "available",
      },
    ],
  },
];

const BASIC_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
      },
    ],
  },
];

/**
 * Navigation for a role. Visibility is presentation only; the API authorises.
 *
 * Staff branch on their operational role, because a waiter and a chef reach the
 * product through the same platform role but do different jobs.
 */
export function navigationFor(
  role: PlatformRole | undefined,
  staffRole?: StaffRole | null,
): NavGroup[] {
  switch (role) {
    case "SuperAdmin":
      return SUPER_ADMIN_NAV;
    case "RestaurantManager":
      return MANAGER_NAV;
    case "Staff":
      // A cashier falls through to the basic navigation: the role exists on the
      // staff record, but nothing has been built for it, and a disabled row would
      // only promise otherwise.
      switch (staffRole) {
        case "Waiter":
          return WAITER_NAV;
        case "Chef":
          return CHEF_NAV;
        default:
          return BASIC_NAV;
      }
    default:
      return BASIC_NAV;
  }
}

/** Human label shown in the account area. */
export function roleLabel(
  role: PlatformRole | undefined,
  staffRole?: StaffRole | null,
): string {
  if (role === "Staff" && staffRole != null) {
    return staffRole;
  }

  switch (role) {
    case "SuperAdmin":
      return "Platform admin";
    case "RestaurantManager":
      return "Restaurant manager";
    case "Staff":
      return "Restaurant staff";
    default:
      return "Member";
  }
}
