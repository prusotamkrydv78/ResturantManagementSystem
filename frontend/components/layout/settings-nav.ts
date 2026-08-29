import { Armchair, Boxes, Contact, Store, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The settings area, as data.
 *
 * One list, read by both the sub-navigation and the landing page, so the two can
 * never disagree about what the area contains. The main sidebar deliberately does
 * not read it: it carries a single row for the whole area, and the point of the
 * exercise was to stop these five screens competing with service for attention.
 */
export interface SettingsLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** What the screen is for, in the words somebody would use to look for it. */
  description: string;
}

export interface SettingsSection {
  title: string;
  /** Shown on the landing page only; the rail has no room for it. */
  description: string;
  links: SettingsLink[];
}

// Grouped by what the thing is, rather than by which service happens to own it.
// Somebody looking for "where do I add a waiter" is thinking about their people,
// not about an authentication boundary.
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Restaurant",
    description: "How the business presents itself",
    links: [
      {
        label: "My restaurant",
        href: "/settings/restaurant",
        icon: Store,
        description: "Name, address and the contact details guests see.",
      },
    ],
  },
  {
    title: "Your room",
    description: "The floor and the people working it",
    links: [
      {
        label: "Tables",
        href: "/settings/tables",
        icon: Armchair,
        description:
          "Add tables, take one out of service, and print the QR code guests order from.",
      },
      {
        label: "Staff",
        href: "/settings/staff",
        icon: Users,
        description:
          "Hire waiters and chefs, reset a password, and deactivate somebody who has left.",
      },
    ],
  },
  {
    title: "Stock and guests",
    description: "The records behind service",
    links: [
      {
        label: "Inventory",
        href: "/settings/inventory",
        icon: Boxes,
        description:
          "Ingredients, reorder levels, and the recipes that draw stock down as dishes sell.",
      },
      {
        label: "Customers",
        href: "/settings/customers",
        icon: Contact,
        description: "Regulars, their contact details and their booking history.",
      },
    ],
  },
];

/** Every settings link, flattened. Used to resolve the selected one. */
export const SETTINGS_LINKS: SettingsLink[] = SETTINGS_SECTIONS.flatMap(
  (section) => section.links,
);
