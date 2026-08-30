import { env } from "@/lib/config/env";

/**
 * Where the server itself should call the API.
 *
 * Different from the browser's answer, and it has to be. In the deployed setup the
 * browser is told `same-origin` and reaches the API through a rewrite in
 * `next.config.ts`; that rewrite is a browser-facing trick and means nothing to code
 * running on the server, which has no origin to be same as. Fetching "" from a
 * server component would simply fail.
 *
 * So the server uses the rewrite's own target, which is the real API address, and
 * falls back to whatever the browser was given when no proxy is configured — the
 * local setup, where the two are the same thing.
 */
export function serverApiUrl(): string {
  const proxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/$/, "");

  if (proxyTarget) {
    return proxyTarget;
  }

  // env.apiUrl is "" in same-origin mode. A server fetch cannot use that, so this
  // is the last resort rather than a working default, and it is the local address.
  return env.apiUrl || "http://localhost:5080";
}
