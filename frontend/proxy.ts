import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves a restaurant's website from its own subdomain.
 *
 * WHAT IT DOES
 *
 * `kanchan.eatery.np/` becomes `/r/kanchan` internally. The visitor's address bar
 * keeps the subdomain; nothing redirects. A rewrite rather than a redirect because the
 * subdomain *is* the address - sending somebody from the address they typed to a path
 * on another host would make the feature pointless and put the restaurant's name in a
 * URL that is not theirs.
 *
 * WHY THE BASE DOMAIN IS AN ENVIRONMENT VARIABLE AND NOT A SETTING
 *
 * A subdomain only resolves if a wildcard DNS record points at this deployment and a
 * wildcard certificate covers it. Both are arranged where the deployment is arranged,
 * and neither can be brought into existence by writing a row in a settings table. A
 * value in the database that claimed to control routing would be a lie the first time
 * somebody changed it and nothing happened.
 *
 * So the deployment decides, and the platform settings screen reports what it decided.
 *
 * WHY NO DATABASE LOOKUP HERE
 *
 * The label is passed through as-is and the API decides whether any restaurant answers
 * to it - a published site resolves on either its subdomain or its slug. Middleware
 * runs on every request to the origin, including assets; giving it a query to make
 * would put the database in front of the whole site to answer a question the page is
 * about to ask anyway.
 */

/**
 * The domain restaurant sites hang off. Unset means path addresses only.
 *
 * Any port is stripped, so this variable and its NEXT_PUBLIC_ twin can be set to the
 * same thing. In development that is <c>localhost:3000</c>, which the browser needs
 * in full to build a link and which is useless here: the Host header on the request
 * that arrives carries the port, and comparing a host against a base that also has
 * one would never match.
 */
const BASE_DOMAIN =
  process.env.SITE_BASE_DOMAIN?.trim().toLowerCase().split(":")[0] ?? "";

/**
 * Labels that are the platform rather than a restaurant.
 *
 * Kept in step with the reserved list the API validates against, which is the one that
 * actually prevents a restaurant being given `www`. This copy exists so that a label
 * slipped past an older build still fails to route rather than serving the wrong page.
 */
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "cdn",
  "dashboard",
  "dev",
  "mail",
  "staging",
  "static",
  "status",
  "www",
]);

export default function proxy(request: NextRequest) {
  if (BASE_DOMAIN === "") {
    return NextResponse.next();
  }

  // The port has to come off before anything is compared: a development host is
  // `kanchan.localhost:3000`, and `.endsWith(baseDomain)` is false against the port.
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";

  if (host === BASE_DOMAIN || !host.endsWith(`.${BASE_DOMAIN}`)) {
    return NextResponse.next();
  }

  const label = host.slice(0, -(BASE_DOMAIN.length + 1));

  // Only a single label. `a.b.eatery.np` is not a restaurant called "a.b" - it is
  // somebody probing, or a certificate that should not have matched.
  if (label === "" || label.includes(".") || RESERVED.has(label)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  url.pathname = `/r/${label}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  /**
   * Everything except the API proxy, Next's own assets and files with an extension.
   *
   * The API is excluded because a restaurant page calls it on the same origin, and
   * rewriting `/api/...` into `/r/kanchan/api/...` would break every request the page
   * it just served goes on to make.
   */
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
