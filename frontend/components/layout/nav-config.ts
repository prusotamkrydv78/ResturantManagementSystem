import {
  CalendarClock,
  ChartNoAxesColumn,
  ChefHat,
  ClipboardList,
  Cog,
  Gauge,
  HandPlatter,
  LayoutGrid,
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
        icon: Gauge,
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
// product, and no placeholder rows for features that have not been built.
//
// Ordered and trimmed by one question: does this change while the restaurant is
// trading? What answers yes is a sidebar row. What answers no lives on the settings
// hub, which is one row at the bottom.
//
// Eleven rows meant the screen needed mid-service carried the same visual weight as
// the one edited twice a year. Two of the survivors say they are live in the code
// already, by refreshing on a timer - Overview every thirty seconds and Floor on the
// kitchen interval - and nothing that was cut polls at all. Billing does not poll but
// earns its place by repetition: settling a table is the action repeated all evening.
// Menu stays for a narrower reason: marking a dish off is a mid-service job.
//
// Nothing was removed from the product. Tables, Staff, Inventory, Customers and the
// restaurant profile moved under /settings, which has a rail of its own, so they are
// a click away rather than a row each. One entry covers all five because they nest:
// /settings/tables already starts with /settings.
const MANAGER_NAV: NavGroup[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: Gauge,
        status: "available",
      },
      {
        // A grid of tables, for the room. Overview takes a dial rather than the
        // dashboard glyph it used to: side by side in a rail the two were both a
        // square cut into squares, and an icon that has to be read twice is not
        // doing the job an icon is for.
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
        label: "Menu",
        href: "/menu",
        icon: ScrollText,
        status: "available",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: ChartNoAxesColumn,
        status: "available",
      },
    ],
  },
  {
    // Its own group rather than a seventh row, so the rule above it separates the
    // things done during service from the place everything else was put.
    items: [
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
        icon: Gauge,
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
        label: "Pass",
        href: "/pass",
        icon: HandPlatter,
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
        icon: Gauge,
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
        icon: Gauge,
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
      // The default still stands rather than being exhaustive over StaffRole: a
      // staff account read back from an older record could carry a role this
      // build no longer knows, and basic navigation is the safe landing for it.
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

/**
 * Where a signed-in account belongs when it has not asked for anywhere in particular.
 *
 * Derived from the navigation rather than written down again, so the front door and
 * the sidebar can never disagree about where a role starts. Every role happens to
 * begin at the same overview today; the moment one does not, this follows without
 * anybody remembering to change it.
 */
export function homeFor(
  role: PlatformRole | undefined,
  staffRole?: StaffRole | null,
): string {
  const first = navigationFor(role, staffRole)[0]?.items[0]?.href;

  // A nav with no rows at all should still land somewhere real rather than nowhere.
  return first ?? "/dashboard";
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
