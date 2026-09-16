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

/** What a visitor is served. Carries no publication state: a draft is a 404. */
export interface PublicSite {
  restaurantName: string;
  design: DesignId | "";
  content: Partial<SampleContent>;
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

export interface Media {
  id: string;
  /** Relative, so it survives the platform moving or gaining a subdomain. */
  url: string;
  fileName: string;
  contentType: string;
  byteCount: number;
  createdAtUtc: string;
}

export interface MediaLibrary {
  items: Media[];
  used: number;
  /** The server's limit, returned rather than duplicated here. */
  limit: number;
  bytesUsed: number;
}

export function listMedia(): Promise<MediaLibrary> {
  return apiFetch<MediaLibrary>("/api/media");
}

/**
 * Adds a picture.
 *
 * Sent as multipart rather than as a base64 string in JSON: a four megabyte photograph
 * becomes five and a half encoded that way, and the framework can reject an oversized
 * body before buffering it only if it arrives as a file.
 */
export function uploadMedia(file: File): Promise<Media> {
  const body = new FormData();

  body.append("file", file);

  return apiFetch<Media>("/api/media", { method: "POST", body });
}

export function deleteMedia(id: string): Promise<void> {
  return apiFetch<void>(`/api/media/${id}`, { method: "DELETE" });
}
