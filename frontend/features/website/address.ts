import type { Restaurant } from "@/types/restaurant";

/**
 * Where a restaurant's published website lives.
 *
 * Two answers, and which one is true depends on the deployment rather than on the
 * restaurant. A subdomain only resolves when a wildcard DNS record points at this
 * origin and a wildcard certificate covers it; neither is something the product can
 * arrange, so the base domain is build-time configuration and the path address is
 * always there as the one that cannot fail.
 *
 * Read from NEXT_PUBLIC_SITE_BASE_DOMAIN, which is inlined into the bundle when the
 * frontend is built. It has to match SITE_BASE_DOMAIN on the server, which is what
 * the proxy actually routes on — this one only decides what the manager is shown.
 */
const BASE_DOMAIN =
  process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN?.trim().toLowerCase() ?? "";

/**
 * Which scheme the address is reached over.
 *
 * Derived from the domain rather than read from the browser, and that is deliberate:
 * this string ends up in an href rendered on the server as well as in the browser,
 * and reading window.location would make the two disagree and hydration complain.
 *
 * Local development is the only case that is not HTTPS, and it announces itself.
 */
const SCHEME =
  BASE_DOMAIN.startsWith("localhost") || BASE_DOMAIN.startsWith("127.0.0.1")
    ? "http"
    : "https";

/** Whether this deployment serves restaurant sites from their own subdomains. */
export const HAS_SITE_DOMAIN = BASE_DOMAIN !== "";

/**
 * The address to show a manager, and the one to put on a card.
 *
 * Falls back to the path form whenever there is no base domain or the restaurant has
 * not been given a label — never to a broken hostname. A page that is published is
 * reachable at its slug regardless, so there is always an address to give.
 */
export function siteAddress(restaurant: Restaurant): {
  href: string;
  label: string;
  isSubdomain: boolean;
} {
  const label = restaurant.subdomain ?? restaurant.slug;

  if (BASE_DOMAIN === "" || restaurant.subdomain === null) {
    return { href: `/r/${label}`, label: `/r/${label}`, isSubdomain: false };
  }

  // The base domain carries its own port when there is one, so this is the authority
  // a visitor would type, not a domain that still needs one bolted on.
  const host = `${restaurant.subdomain}.${BASE_DOMAIN}`;

  return { href: `${SCHEME}://${host}`, label: host, isSubdomain: true };
}
