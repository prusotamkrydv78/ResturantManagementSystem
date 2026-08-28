/**
 * Typed access to the public environment variables the app needs.
 * Kept in one place so a missing value fails loudly instead of silently.
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

// NEXT_PUBLIC_* values are inlined into the bundle at BUILD time, not read from
// the environment at runtime, so this check runs during `next build`.
//
// Falling back to localhost here would produce a bundle that sends every
// visitor's browser to its own machine, which fails as an opaque network error
// on a screen that otherwise looks fine. Refusing to build is the cheaper
// failure: it is noticed by whoever is deploying rather than by a waiter
// halfway through service.
if (!apiUrl && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. It is baked into the bundle at build time, "
      + "so it must be present in the environment that runs `next build` - "
      + "setting it only on the server that runs `next start` is too late.",
  );
}

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

export const env = {
  /**
   * Base URL of the backend Web API, without a trailing slash. Empty when the
   * API is same-origin, which makes every request path relative.
   */
  apiUrl:
    apiUrl === SAME_ORIGIN ? "" : (apiUrl || "http://localhost:5080").replace(/\/$/, ""),
} as const;
