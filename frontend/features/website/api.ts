import { apiFetch } from "@/lib/api/client";
import type { DesignId } from "./designs";
import type { SampleContent } from "./sample-content";

/**
 * A restaurant's page, on the server.
 *
 * The content crosses the wire as whatever the templates need it to be. The server
 * stores it as opaque JSON and has no opinion about its shape, which is what lets a
 * design gain a section without a deployment on that side.
 */

/** What the manager's editor reads. */
export interface Site {
  design: DesignId | "";
  content: Partial<SampleContent>;
  isPublished: boolean;
  /** The draft has moved since the last time Publish was pressed. */
  hasUnpublishedChanges: boolean;
  /** Read-only here; only a platform admin changes a slug. */
  slug: string;
  updatedAtUtc: string;
  publishedAtUtc: string | null;
}

/**
 * What a visitor is served. Carries no publication state: a draft is a 404.
 *
 * The contact details travel with the page rather than in a second request. Every
 * design prints them — a restaurant page with no address and no telephone number is
 * not a restaurant page — and two requests to draw one page would mean the address
 * arriving after the fold it belongs above.
 */
export interface PublicSite {
  restaurantName: string;
  design: DesignId | "";
  content: Partial<SampleContent>;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

/** The published page at a restaurant's address, or a 404 if there is not one. */
export function getPublicSite(slug: string): Promise<PublicSite> {
  return apiFetch<PublicSite>(`/api/public/sites/${encodeURIComponent(slug)}`, {
    auth: false,
  });
}

/** The draft, created empty by the server the first time it is asked for. */
export function getSite(): Promise<Site> {
  return apiFetch<Site>("/api/site");
}

/**
 * Replaces the draft.
 *
 * Whole-record, not a patch. The editor is holding the page and knows what it says; a
 * merge on the server would be a second opinion about that.
 */
export function saveSiteDraft(
  design: DesignId,
  content: SampleContent,
): Promise<Site> {
  return apiFetch<Site>("/api/site", {
    method: "PUT",
    body: JSON.stringify({ design, content }),
  });
}

/** Publishes the draft as it stands, or takes the page down. */
export function setSitePublished(isPublished: boolean): Promise<Site> {
  return apiFetch<Site>("/api/site/published", {
    method: "PUT",
    body: JSON.stringify({ isPublished }),
  });
}

/* -------------------------------------------------------------------------- */
/* The picture library                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One picture.
 *
 * Carries the identifier and not an address. A page stores what goes in a photograph
 * slot for years, and storing `/api/media/...` there would bake today's route into
 * every page ever saved. See `mediaSrc` in photos.ts, which is where an address gets
 * built.
 */
export interface Media {
  id: string;
  fileName: string;
  contentType: string;
  byteCount: number;
  createdAtUtc: string;
}

export interface MediaLibrary {
  items: Media[];
  used: number;
  /** The server's limits, returned rather than duplicated here. */
  limit: number;
  bytesUsed: number;
  /** The largest single picture, so one can be refused before it is sent. */
  maxBytes: number;
}

export function listMedia(): Promise<MediaLibrary> {
  return apiFetch<MediaLibrary>("/api/media");
}

/**
 * Adds a picture, and the small copy of it the browser made.
 *
 * Sent as multipart rather than as a base64 string in JSON: a four megabyte photograph
 * becomes five and a half encoded that way, and the framework can reject an oversized
 * body before buffering it only if it arrives as a file.
 *
 * The thumbnail is optional at every level — this signature, the request, and the
 * server. A browser that could not make one uploads the picture alone and the library
 * serves the original to the grid, which is slower and entirely correct.
 */
export function uploadMedia(file: File, thumbnail?: File | null): Promise<Media> {
  const body = new FormData();

  body.append("file", file);

  if (thumbnail !== undefined && thumbnail !== null) {
    body.append("thumbnail", thumbnail);
  }

  return apiFetch<Media>("/api/media", { method: "POST", body });
}

export function deleteMedia(id: string): Promise<void> {
  return apiFetch<void>(`/api/media/${id}`, { method: "DELETE" });
}
