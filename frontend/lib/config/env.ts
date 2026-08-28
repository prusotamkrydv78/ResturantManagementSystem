/**
 * Typed access to the public environment variables the app needs.
 * Kept in one place so a missing value fails loudly instead of silently.
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export const env = {
  /** Base URL of the backend Web API, without a trailing slash. */
  apiUrl: (apiUrl ?? "http://localhost:5080").replace(/\/$/, ""),
} as const;
