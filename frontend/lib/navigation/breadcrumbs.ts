/**
 * Where you are, worked out from where you are.
 *
 * The trail used to be typed out on every screen: forty-one hand-written arrays, each
 * restating the same trunk, each free to disagree with the others. And they did. The
 * new-order screen claimed "Workspace › New order" and skipped Orders entirely; a
 * receipt hung off Billing as though the bill it belongs to were not a page; one detail
 * screen offered three different trails depending on whether it had finished loading.
 * None of that was a decision anybody made - it is what happens when the same fact is
 * written down in forty-one places and only one of them is ever in front of you.
 *
 * So the trail is derived from the route, and a route's label is written down once,
 * here. A screen still names the thing it is showing - only the page knows that the
 * record under this id is called Ram's Kitchen - but it no longer describes the path
 * that leads to it, because the URL already does.
 */

/** One step in the trail. */
export interface Crumb {
  label: string;
  /** Omitted for the current page, which is not a link to itself. */
  href?: string;
}

/**
 * What each route is called, keyed by its pattern as Next writes it.
 *
 * Only routes that exist appear here, and that is load-bearing rather than tidy: a path
 * segment with no entry is a folder rather than a page, and gets skipped instead of
 * being rendered as a link to a 404. `/menu/categories` is the live example - a section
 * is edited at `/menu/categories/{id}` and there has never been a screen listing them.
 *
 * Labels for a detail screen are the generic noun, not a placeholder to be ashamed of:
 * it is what the crumb reads while the record loads, and what it keeps saying if the
 * screen never gets a name to use.
 */
const ROUTES: Record<string, string> = {
  // Platform
  "/admin/restaurants": "Restaurants",
  "/admin/restaurants/new": "New",
  "/admin/restaurants/[id]": "Restaurant",
  "/admin/managers": "Managers",
  "/admin/managers/[id]": "Manager",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",

  // Service
  "/floor": "Floor",
  "/kitchen": "Kitchen",
  "/pass": "Pass",
  "/orders": "Orders",
  "/orders/new": "New order",
  "/orders/[id]": "Order",
  "/billing": "Billing",
  "/billing/history": "History",
  "/billing/[id]": "Bill",
  "/billing/[id]/receipt": "Receipt",
  "/reservations": "Reservations",
  "/reviews": "Reviews",
  "/reports": "Reports",

  // The menu. There is no page at /menu/categories, so none is claimed.
  "/menu": "Menu",
  "/menu/[id]": "Item",
  "/menu/categories/[id]": "Section",

  // Setup
  "/settings": "Settings",
  "/settings/restaurant": "My restaurant",
  "/settings/website": "Website",
  "/settings/tables": "Tables",
  "/settings/tables/[id]": "Table",
  "/settings/staff": "Staff",
  "/settings/staff/[id]": "Member",
  "/settings/inventory": "Inventory",
  "/settings/inventory/[id]": "Ingredient",
  "/settings/customers": "Customers",
  "/settings/customers/[id]": "Customer",
};

/** Where every trail starts. Both roles land on /dashboard; they call it different things. */
const HOME = "/dashboard";

/**
 * What the front door is called from here.
 *
 * An administrator running twenty restaurants and a manager running one are both at
 * /dashboard, and neither would recognise the other's word for it. Keyed off the URL
 * rather than off the signed-in role, because the URL is what is actually on screen -
 * a manager who somehow reached an admin path should see the admin trail, not a trail
 * describing the area they are not in.
 */
function rootLabel(pathname: string): string {
  return pathname.startsWith("/admin") ? "Platform" : "Workspace";
}

/**
 * The value of every dynamic segment, so a real path can be read back as a pattern.
 *
 * Taken from the router rather than guessed. Deciding a segment is an id because it
 * looks like one works until a restaurant is called `new`, and the router already
 * knows the answer for certain.
 */
function patternsOf(
  params: Record<string, string | string[] | undefined>,
): Map<string, string> {
  const byValue = new Map<string, string>();

  for (const [name, value] of Object.entries(params)) {
    // A catch-all route gives an array, and an optional one gives nothing at all.
    // Neither exists today; folding them in costs two lines and means this does not
    // quietly mis-key the day one does.
    for (const single of Array.isArray(value) ? value : [value ?? ""]) {
      if (single.length > 0) {
        byValue.set(single, `[${name}]`);
      }
    }
  }

  return byValue;
}

/**
 * The trail for a path.
 *
 * @param pathname The live path, from the router.
 * @param params The route's dynamic segments, from the router.
 * @param name What the page calls the record it is showing, when it knows. Replaces the
 * generic label on the last step only, because that is the only step whose name lives
 * outside this file.
 */
export function crumbsFor(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  name?: string,
): Crumb[] {
  // The front door is not below anything, so it gets no trail rather than a trail of
  // one step pointing at itself.
  if (pathname === HOME) {
    return [];
  }

  const patterns = patternsOf(params);
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  const trail: Crumb[] = [{ label: rootLabel(pathname), href: HOME }];

  let path = "";
  let pattern = "";

  for (const segment of segments) {
    path += `/${segment}`;
    pattern += `/${patterns.get(segment) ?? segment}`;

    const label = ROUTES[pattern];

    // No entry means no page. `/admin` and `/menu/categories` are both folders, and a
    // crumb for either would be a link to nothing.
    if (label === undefined) {
      continue;
    }

    trail.push({ label, href: path });
  }

  // A route nobody registered still has to render as something. The segment itself is a
  // poor label but an honest one, and it is visible enough that the missing entry gets
  // noticed rather than silently leaving the page with no trail at all.
  if (trail[trail.length - 1]?.href !== pathname) {
    trail.push({ label: name ?? humanise(segments[segments.length - 1] ?? "") });

    return trail;
  }

  const last = trail[trail.length - 1];

  if (last !== undefined) {
    trail[trail.length - 1] = { label: name ?? last.label };
  }

  return trail;
}

/** A URL segment as words, for the routes this file has not been told about. */
function humanise(segment: string): string {
  const spaced = segment.replace(/-/g, " ");

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
