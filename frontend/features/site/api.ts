import { apiFetch } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import type {
  PublicSite,
  SaveSitePayload,
  Site,
  SiteImage,
  SiteTemplateOption,
} from "@/types/site";

/**
 * The restaurant website: the manager's editor calls, and the visitor's read.
 *
 * None of the manager calls send a restaurant id. The API derives it from the access
 * token, so a manager can only ever edit their own page.
 */

/** The caller's page. Creates an empty, unpublished one on first read. */
export function getSite(): Promise<Site> {
  return apiFetch<Site>("/api/site");
}

/** The designs on offer, from the server so the picker cannot drift from it. */
export function listSiteTemplates(): Promise<SiteTemplateOption[]> {
  return apiFetch<SiteTemplateOption[]>("/api/site/templates");
}

/** Saves content and design together. The whole page, not a patch. */
export function saveSite(payload: SaveSitePayload): Promise<Site> {
  return apiFetch<Site>("/api/site", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Publishes the page, or takes it back down. */
export function setSitePublished(isPublished: boolean): Promise<Site> {
  return apiFetch<Site>("/api/site/status", {
    method: "PUT",
    body: JSON.stringify({ isPublished }),
  });
}

/** The images the caller has uploaded, newest first. */
export function listSiteImages(): Promise<SiteImage[]> {
  return apiFetch<SiteImage[]>("/api/site/images");
}

/**
 * Uploads one image.
 *
 * Sent as FormData with no Content-Type of our own: only the browser knows the
 * multipart boundary it generated, so it has to set that header itself.
 */
export function uploadSiteImage(file: File): Promise<SiteImage> {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<SiteImage>("/api/site/images", { method: "POST", body });
}

/** Deletes one image. The page is not checked for references to it. */
export function deleteSiteImage(id: string): Promise<void> {
  return apiFetch<void>(`/api/site/images/${id}`, { method: "DELETE" });
}

/** The published page at a slug. Unauthenticated. */
export function getPublicSite(slug: string): Promise<PublicSite> {
  return apiFetch<PublicSite>(`/api/public/sites/${encodeURIComponent(slug)}`, {
    auth: false,
  });
}

/**
 * Turns a stored image reference into something a browser can load.
 *
 * The server hands back a root-relative path, because it has no idea which host the
 * page will be served from and an absolute URL baked into the content would break
 * the moment the platform moved. The API is frequently on a different origin from
 * the frontend, so the origin is put back on here, at the point of use.
 *
 * A URL a manager typed themselves is left exactly as it is: it already points
 * somewhere absolute, and prefixing it would corrupt it.
 */
export function siteImageSrc(url: string): string {
  const trimmed = url.trim();

  if (trimmed === "") {
    return "";
  }

  return trimmed.startsWith("/api/") ? `${env.apiUrl}${trimmed}` : trimmed;
}
