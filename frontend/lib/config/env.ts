/**
 * Typed access to the public environment variables the app needs.
 * Kept in one place so a missing value fails loudly instead of silently.
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

/**
 * Set NEXT_PUBLIC_API_URL to this when the API is reached through the /api/*
 * rewrite in next.config.ts rather than called directly.
 *
 * Requests then go out as relative paths, so they land on whatever host is
 * serving the page. That is what keeps preview deployments working: every one
 * gets its own hostname, and a baked-in absolute URL would point them all at
 * production.
 */
const SAME_ORIGIN = "same-origin";

/**
 * NEXT_PUBLIC_* values are inlined into the bundle at BUILD time, not read from
 * the environment at runtime, so a missing value here is permanent for the
 * lifetime of the bundle.
 *
 * Falling back to localhost in production would produce a bundle that sends
 * every visitor's browser to its own machine, which fails as an opaque network
 * error on a screen that otherwise looks fine. Falling back to same-origin
 * means requests leave the browser as relative paths, which land on whatever
 * host served the page - the right answer for a build that did not declare an
 * upstream, and harmless for the host the page was served from.
 */
const resolved =
  apiUrl === SAME_ORIGIN
    ? ""
    : (apiUrl ?? (process.env.NODE_ENV === "production" ? SAME_ORIGIN : "http://localhost:5080"));

export const env = {
  /**
   * Base URL of the backend Web API, without a trailing slash. Empty when the
   * API is same-origin, which makes every request path relative.
   */
  apiUrl: resolved.replace(/\/$/, ""),
} as const;
