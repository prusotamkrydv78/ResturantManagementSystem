import { env } from "@/lib/config/env";

/**
 * The pictures a design uses before a restaurant has uploaded any, and the one type
 * every photograph slot in every design speaks.
 *
 * NAMED PHOTOGRAPHS, NOT A SEARCH
 *
 * This is the third source tried and the first correct one, and the lesson is worth
 * writing down rather than rediscovering. The first was a random stock service, which
 * returns whatever it likes — a landing page for a restaurant showing a mountain
 * where the turbot should be does not read as a placeholder, it reads as a bad
 * design. The second was a tag-matching service, which is worse: it answers 200 to
 * everything, ignores the tags when it feels like it, and serves a flat red error
 * image when it has nothing — so a page could not even tell that it had failed.
 *
 * Every entry below is one specific, permanent photograph addressed by its own id on
 * a CDN. There is no search, no seed, no matching and nothing random: an id returns
 * the same picture today and next year, or it returns nothing at all, and nothing at
 * all is a case this file already handles.
 *
 * A WARM GROUND SITS UNDER EVERY ONE, in the tones a dining-room photograph occupies.
 * It is what the image loads over, and what remains if the fetch never lands — behind
 * a firewall, on a plane, or the day the host stops answering. The page degrades to
 * the composition it had rather than to a column of broken images.
 *
 * All of it is demonstration only. A restaurant that uploads its own pictures stops
 * seeing any of this: see {@link PhotoRef} below, which is how the two live in one
 * field without a template ever knowing which it has been handed.
 */

/** Which picture a slot wants. Names the subject, not the colour. */
export type PhotoTone =
  | "hall"
  | "room"
  | "fire"
  | "greens"
  | "plated"
  | "dessert"
  | "wine"
  | "pass";

/**
 * Every plate, in one array.
 *
 * The picker in the editor offers exactly what a template can draw, read from the
 * same place the templates read. A second list would be a second answer to "which
 * pictures exist", and the two would disagree the first time one was added.
 */
export const PHOTO_TONES: PhotoTone[] = [
  "hall",
  "room",
  "fire",
  "greens",
  "plated",
  "dessert",
  "wine",
  "pass",
];

/**
 * Where the photographs live.
 *
 * Unsplash's image CDN, addressed by photo id. No key, no account, no API call: the
 * id is the address. It is the only external asset this product requests.
 */
const SOURCE = "https://images.unsplash.com/photo-";

/**
 * One photograph per slot, chosen for subject and checked to resolve.
 *
 * Warm, low-lit and close-in throughout, so the eight sit together as one
 * restaurant's photography rather than as eight pictures off the internet.
 */
const PHOTOS: Record<PhotoTone, string> = {
  /** A room at night, wide and low-lit. For a hero that has to carry type over it. */
  hall: "1414235077428-338989a2e8c0",
  /** A dining room, laid and empty. */
  room: "1517248135467-4c7edcad34c4",
  /** Meat over coals. */
  fire: "1555396273-367ea4eb4db5",
  /** Roast vegetables, close. */
  greens: "1512621776951-a57141f2eefd",
  /** A plated course. */
  plated: "1504674900247-0877df9cc836",
  /** Something sweet. */
  dessert: "1551782450-a2132b4ba21d",
  /** Wine, poured. */
  wine: "1510812431401-41d2bd2722f3",
  /** The kitchen, working. */
  pass: "1577106263724-2c8e03bfe9cf",
};

/**
 * The photograph for a slot, at the size it will be drawn.
 *
 * Asked for at roughly twice the painted size so it holds up on a dense screen, and
 * no larger: a hero at four thousand pixels costs a second of loading to look
 * identical. Cropped by the CDN rather than by the browser, so the bytes that arrive
 * are the bytes that get painted.
 */
export function photoUrl(tone: PhotoTone, width: number, height: number): string {
  const query = new URLSearchParams({
    w: String(width),
    h: String(height),
    fit: "crop",
    crop: "entropy",
    q: "72",
    auto: "format",
  });

  return `${SOURCE}${PHOTOS[tone]}?${query.toString()}`;
}

/**
 * The ground under the photograph.
 *
 * Layered lights over a warm base, in the register a dining-room photograph sits in,
 * so the page reads as composed even with every picture missing.
 */
export const PHOTO_GROUND: Record<PhotoTone, string> = {
  hall: "radial-gradient(80% 90% at 30% 25%, #5b4a3c 0%, transparent 62%), radial-gradient(70% 70% at 85% 80%, #17120e 0%, transparent 60%), linear-gradient(165deg, #3a2f26 0%, #131010 100%)",
  room: "radial-gradient(70% 90% at 25% 20%, #9a8878 0%, transparent 60%), radial-gradient(75% 75% at 80% 80%, #241d18 0%, transparent 62%), linear-gradient(160deg, #6a5a4c 0%, #1e1814 100%)",
  fire: "radial-gradient(70% 90% at 25% 15%, #d98b52 0%, transparent 60%), radial-gradient(80% 80% at 80% 80%, #7a2f1c 0%, transparent 65%), linear-gradient(160deg, #a8542f 0%, #46190f 100%)",
  greens:
    "radial-gradient(65% 85% at 30% 20%, #a7b070 0%, transparent 60%), radial-gradient(75% 75% at 85% 75%, #33401f 0%, transparent 60%), linear-gradient(155deg, #6f7a4a 0%, #26301a 100%)",
  plated:
    "radial-gradient(70% 85% at 20% 25%, #e0c9a7 0%, transparent 62%), radial-gradient(70% 70% at 80% 80%, #6b5334 0%, transparent 60%), linear-gradient(150deg, #b89b6f 0%, #3c2f1d 100%)",
  dessert:
    "radial-gradient(65% 85% at 28% 18%, #f0c581 0%, transparent 60%), radial-gradient(75% 75% at 82% 78%, #8a5a12 0%, transparent 60%), linear-gradient(155deg, #c99244 0%, #5a3a12 100%)",
  wine: "radial-gradient(70% 88% at 24% 22%, #c47a86 0%, transparent 60%), radial-gradient(72% 72% at 80% 78%, #4c141f 0%, transparent 62%), linear-gradient(158deg, #8d3345 0%, #33101a 100%)",
  pass: "radial-gradient(70% 90% at 25% 20%, #9aa1a8 0%, transparent 60%), radial-gradient(75% 75% at 80% 80%, #23292f 0%, transparent 62%), linear-gradient(160deg, #57616b 0%, #1b2025 100%)",
};

/**
 * A fine grain, as an inline SVG.
 *
 * Laid over the dark bands at very low opacity. A large area of flat dark colour on a
 * screen reads as a swatch; the same area with a little noise in it reads as a
 * surface, and the difference is most of what separates a page that feels printed
 * from one that feels like a div. Cheap, inline, and no request.
 */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/* -------------------------------------------------------------------------- */
/* What a photograph slot actually holds                                      */
/* -------------------------------------------------------------------------- */

/**
 * A photograph, as stored in a page.
 *
 * Either the name of one of the samples above, or `media:<id>` naming a picture the
 * restaurant uploaded. One string, one field, one picker — a design does not have a
 * "sample photograph" slot and an "uploaded photograph" slot, it has a photograph
 * slot, and what goes in it is the manager's business.
 *
 * WHY THE IDENTIFIER AND NOT THE ADDRESS
 *
 * The library hands back a URL, and storing that URL in the page would have been one
 * line shorter. It would also have baked `/api/media/...` into every saved page on
 * the platform, so the day that route moves, gains a CDN in front of it or starts
 * serving resized variants, every page written before the change points at the old
 * one. The identifier is the fact; the address is a rendering of it, and rendering
 * belongs at the point of use.
 *
 * It is also what makes the two kinds distinguishable at a glance: no sample is
 * called `media:something`, so no migration and no discriminator field are needed.
 */
export type PhotoRef = PhotoTone | `media:${string}`;

const MEDIA_PREFIX = "media:";

/** How an uploaded picture is written into a page. */
export function mediaRef(id: string): PhotoRef {
  return `${MEDIA_PREFIX}${id}`;
}

/** The picture's identifier, or null if this slot holds one of the samples. */
export function mediaIdOf(ref: string): string | null {
  return ref.startsWith(MEDIA_PREFIX) ? ref.slice(MEDIA_PREFIX.length) : null;
}

/** Whether a stored value names one of the samples. */
export function isPhotoTone(ref: string): ref is PhotoTone {
  return (PHOTO_TONES as string[]).includes(ref);
}

/**
 * Where an uploaded picture is served from.
 *
 * Composed against the API's own origin rather than the page's. In development those
 * are two ports, and a bare `/api/media/...` in an image tag would be asked of the
 * Next server, which does not have it.
 */
export function mediaSrc(id: string): string {
  return `${env.apiUrl}/api/media/${id}`;
}

/**
 * The address for whatever a slot holds, at the size it will be drawn.
 *
 * The size is a request, not a promise: the sample CDN crops to it, and an uploaded
 * picture is served as it was uploaded because the server keeps one copy of it. That
 * asymmetry is deliberate for now — resizing on upload is a real feature with real
 * decisions in it, and guessing at them here would be worse than serving the original.
 *
 * Anything unrecognised falls back to a sample rather than to a broken image. A page
 * pointing at a picture that has since been deleted is a case that will happen, and
 * the right answer to it is a photograph.
 */
export function photoSrc(ref: string, width: number, height: number): string {
  const id = mediaIdOf(ref);

  if (id !== null) {
    return mediaSrc(id);
  }

  return photoUrl(isPhotoTone(ref) ? ref : FALLBACK, width, height);
}

/**
 * The ground under whatever a slot holds.
 *
 * An uploaded picture has no known palette, so it gets the neutral warm ground rather
 * than a guess. See the note on {@link PHOTO_GROUND} for why anything is painted here
 * at all.
 */
export function photoGround(ref: string): string {
  return isPhotoTone(ref) ? PHOTO_GROUND[ref] : PHOTO_GROUND[FALLBACK];
}

/** What an unknown or deleted picture becomes. Warm, dark, and safe under type. */
const FALLBACK: PhotoTone = "room";
