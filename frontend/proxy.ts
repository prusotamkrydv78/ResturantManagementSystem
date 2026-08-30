import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Maps a restaurant subdomain onto its page.
 *
 * `janakhotel.example.com` is rewritten to `/r/janakhotel`, so one renderer serves
 * both addresses and the path form keeps working. That matters for more than
 * tidiness: localhost has no subdomains, so without the path form a manager could
 * never preview their own page while writing it.
 *
 * A rewrite rather than a redirect. The visitor stays on the restaurant's own
 * address, which is the entire point of giving them one.
 *
 * Named `proxy` rather than `middleware`: the middleware convention is deprecated in
 * Next 16 and renamed, and only this export is picked up.
 */

/**
 * Hosts that are the platform itself rather than a restaurant.
 *
 * Everything before the first dot of anything else is treated as a slug, so this
 * list is what stops `www.example.com` being read as a restaurant called "www".
 */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "dashboard",
  "staging",
  "preview",
]);

/**
 * Host suffixes that never carry a restaurant subdomain.
 *
 * A Vercel preview deployment has a generated host with several dots in it, and
 * reading its first label as a slug would rewrite the whole preview to a restaurant
 * page that does not exist.
 */
const PLATFORM_SUFFIXES = [".vercel.app", ".localhost"];

/**
 * The restaurant slug a host is asking for, if it is asking for one.
 *
 * Returns null for the platform's own hosts, for anything without a subdomain, and
 * for a bare address like an IP or `localhost`.
 */
function slugFromHost(host: string): string | null {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  if (hostname === "" || hostname === "localhost") {
    return null;
  }

  // An IP address has no subdomain to read.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  if (PLATFORM_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return null;
  }

  const labels = hostname.split(".");

  // Needs at least sub.domain.tld. A bare apex is the platform, not a restaurant.
  if (labels.length < 3) {
    return null;
  }

  const candidate = labels[0] ?? "";

  if (candidate === "" || RESERVED_SUBDOMAINS.has(candidate)) {
    return null;
  }

  // Slugs are lower-case, alphanumeric and hyphenated. Anything else is not one,
  // and refusing here keeps a strange host out of a URL this builds.
  return /^[a-z0-9][a-z0-9-]*$/.test(candidate) ? candidate : null;
}

export function proxy(request: NextRequest) {
  const slug = slugFromHost(request.headers.get("host") ?? "");

  if (slug === null) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Only the root of a restaurant subdomain is its page. Everything else on that
  // host is left alone, so the API proxy and static assets still resolve.
  if (pathname !== "/") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/r/${slug}`;

  return NextResponse.rewrite(url);
}

export const config = {
  /**
   * Everything except the framework's own paths and the API rewrite.
   *
   * Narrow on purpose: this runs before every matching request, and a restaurant
   * subdomain only ever needs its root rewritten.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
