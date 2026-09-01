import { env } from "@/lib/config/env";

/**
 * Turns a root-relative API path into something an `img` or `a` tag can load.
 *
 * The server hands back a root-relative path, because it has no idea which host the
 * page will be served from and an absolute URL baked into stored content would break
 * the moment the platform moved. The API is frequently on a different origin from
 * the frontend, so the origin goes back on here, at the point of use.
 *
 * Anything already absolute is left exactly as it is: a URL a manager typed
 * themselves points somewhere real, and prefixing it would corrupt it.
 *
 * Shared by the website's picture library and by inventory photographs, because both
 * are bytes served from the API into a tag that cannot carry an access token, and
 * getting the origin wrong looks identical in both: a broken image and no error.
 */
export function apiAssetSrc(url: string): string {
  const trimmed = (url ?? "").trim();

  if (trimmed === "") {
    return "";
  }

  return trimmed.startsWith("/api/") ? `${env.apiUrl}${trimmed}` : trimmed;
}
