import type { PublicSite } from "./api";
import type { PublicReviews } from "@/features/public/api";
import type { PublicRestaurant } from "@/types/public-ordering";

/**
 * Reading a published restaurant page on the server.
 *
 * WHY THIS IS NOT THE BROWSER'S JOB
 *
 * The public page used to fetch itself from the client, which had two consequences
 * that both looked like the same bug - a dark screen saying nothing is here.
 *
 * The first was that the request went out from the restaurant's own host, so a page
 * on `kanchan.eatery.np` asked the API with that Origin and the browser threw the
 * answer away. The API was configured for the platform's host alone and said nothing
 * about this one. Nothing failed on the server; the response simply never reached the
 * code that asked for it.
 *
 * The second is worse and is not fixable by fixing the first. A page that decides
 * whether a restaurant exists after it has already been sent answers every address in
 * the world with `200 OK` - an unknown label, a typo, a probe. Search engines index
 * it, monitors call it healthy, and a caching layer is entitled to keep it. A missing
 * page has to be missing in the status line, which means deciding before the response
 * starts, which means asking here.
 *
 * So the page is fetched on this side and a restaurant with no published site becomes
 * a real 404. The browser is left to draw what came back and nothing else.
 */

/**
 * Where the API is, as seen from the Next server rather than from a visitor.
 *
 * `API_URL` exists separately because the two are not always the same address: the
 * public variable can legitimately be a relative path when the browser reaches the
 * API through this origin, and a relative path is meaningless to a fetch made here.
 * It falls back to the public one, which is the whole configuration in development.
 *
 * Read on each call rather than at module scope, because unlike `NEXT_PUBLIC_*` this
 * one is a genuine runtime value and caching it would defeat the point of it.
 */
function apiOrigin(): string {
  const configured = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).trim();

  return configured === "same-origin" ? "" : configured.replace(/\/$/, "");
}

/**
 * The published page answering to a label, or null.
 *
 * Null covers every reason equally: no such restaurant, a draft nobody has published,
 * and an API that did not answer. A visitor has no use for the difference, and
 * spelling out the first two tells anybody walking the namespace which labels exist.
 */
export async function readPublishedSite(label: string): Promise<PublicSite | null> {
  const origin = apiOrigin();

  if (origin === "") {
    // Nothing to call. Said out loud in the server log rather than silently treated
    // as a missing restaurant, because every address on the deployment would go dark
    // at once and the pages themselves would look individually broken.
    console.error(
      "[website] API_URL and NEXT_PUBLIC_API_URL are both unset, so no published " +
        "page can be read. Restaurant websites will all return 404.",
    );

    return null;
  }

  try {
    const response = await fetch(
      `${origin}/api/public/sites/${encodeURIComponent(label)}`,
      {
        // A published page changes when a manager presses Publish and not otherwise,
        // so it is worth holding briefly - but only briefly, because the manager who
        // just pressed it is about to reload and expects to see their own work.
        next: { revalidate: 30 },
        headers: { accept: "application/json" },
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PublicSite;
  } catch {
    return null;
  }
}

/**
 * The live menu and the real reviews, read on the server beside the page itself.
 *
 * The website's menu is the restaurant's menu - the same dishes, prices and
 * availability the till and the guest ordering use - rather than a second copy typed
 * into the editor that drifts the day a price changes. Reviews are the ones guests
 * actually left. Either can fail on its own; the page then simply goes without it,
 * which is honest, rather than falling back to anything invented.
 */
export async function readPublicMenu(slug: string): Promise<PublicRestaurant | null> {
  return readPublicJson<PublicRestaurant>(`/api/public/restaurants/${encodeURIComponent(slug)}/menu`, 60);
}

export async function readPublicReviews(slug: string): Promise<PublicReviews | null> {
  return readPublicJson<PublicReviews>(`/api/public/restaurants/${encodeURIComponent(slug)}/reviews?limit=6`, 300);
}

async function readPublicJson<T>(path: string, revalidate: number): Promise<T | null> {
  const origin = apiOrigin();

  if (origin === "") {
    return null;
  }

  try {
    const response = await fetch(`${origin}${path}`, {
      next: { revalidate },
      headers: { accept: "application/json" },
    });

    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
