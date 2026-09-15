"use server";

import { revalidatePath } from "next/cache";

/**
 * Drops the cached copy of one restaurant's public page.
 *
 * The public route is statically revalidated every five minutes, which is right for
 * a marketing page nobody is editing and wrong for the ten seconds after somebody
 * publishes one. A manager pressed Publish, opened the page, saw the version from
 * before their edit, and concluded that publishing does not work — the page was
 * fine, the cache was simply still inside its window.
 *
 * Called after a publish or a withdrawal. Revalidating the path clears the rendered
 * page and the fetch it made, so the next visitor renders fresh.
 *
 * A server action rather than a route handler: there is no URL to find, and Next
 * scopes the call to this application rather than exposing cache-busting to anyone
 * who can guess a slug.
 */
export async function revalidateSite(slug: string): Promise<void> {
  const trimmed = slug.trim();

  if (trimmed === "") {
    return;
  }

  revalidatePath(`/r/${trimmed}`);
}
