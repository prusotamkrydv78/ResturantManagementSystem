import { money } from "@/features/analytics/format";
import type { PublicReviews } from "@/features/public/api";
import type { PublicRestaurant } from "@/types/public-ordering";
import type { PhotoRef } from "./photos";
import type { SampleContent } from "./sample-content";

/**
 * What a published page is allowed to say.
 *
 * THE RULE
 *
 * A restaurant's live website says only what is true of that restaurant: what its
 * manager wrote, and what the product itself knows - the menu, the prices, the reviews
 * guests left. The editor and the design previews fill every slot with the sample
 * restaurant so a manager can see the shape of the page; a published page must not,
 * because on a real restaurant's address the sample's awards, chef, reviews, opening
 * hours and dishes read as claims about that restaurant. A guest could turn up on a
 * night it is closed.
 *
 * So here, anything the manager did not write comes out empty and its section is not
 * drawn (see sectionHasContent). What survives from the sample is only presentation:
 * the photographs, how the page moves, and the wording on the two buttons.
 */

/** Keys whose sample value is presentation, not a claim, and is kept when unset. */
const PRESENTATION = new Set(["heroPhoto", "motion", "actions", "photo", "tone"]);

/**
 * The manager's content, checked against the sample's shape like the editor's own
 * conform, but with anything not written left empty rather than filled from the sample.
 */
export function publishedContent(sample: SampleContent, stored: unknown): SampleContent {
  return conform(sample, stored, "") as SampleContent;
}

function conform(sample: unknown, stored: unknown, key: string): unknown {
  if (PRESENTATION.has(key) && stored === undefined) {
    return sample;
  }

  if (Array.isArray(sample)) {
    if (!Array.isArray(stored)) {
      return [];
    }

    const template = sample[0];

    if (template === undefined) {
      return stored;
    }

    return stored.filter((item) => fits(template, item)).map((item) => conform(template, item, ""));
  }

  if (isRecord(sample)) {
    const record = isRecord(stored) ? stored : {};

    return Object.fromEntries(Object.keys(sample).map((field) => [field, conform(sample[field], record[field], field)]));
  }

  if (typeof stored === typeof sample) {
    return stored;
  }

  return typeof sample === "string" ? "" : typeof sample === "number" ? 0 : typeof sample === "boolean" ? false : sample;
}

function fits(template: unknown, item: unknown): boolean {
  if (isRecord(template)) {
    return isRecord(item) && Object.keys(template).every((field) => field in item);
  }

  return typeof item === typeof template;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a section has anything true to show, by the id the templates give it.
 *
 * The opening, the visit and the footer always draw: they carry the restaurant's own
 * name, address and contact details, which come from its profile, not the editor.
 */
export function sectionHasContent(id: string, content: SampleContent): boolean {
  const story = content.story.title.trim() !== "" || content.story.body.some((line) => line.trim() !== "");
  const chef = content.chef.name.trim() !== "";
  const cellar = content.cellar.title.trim() !== "" || content.cellar.body.trim() !== "";

  switch (id) {
    case "accolades":
    case "ticker":
      return content.accolades.length > 0;
    case "story":
    case "creed":
      return story;
    case "larder":
      return story || content.heritage.facts.length > 0;
    case "menu":
    case "carte":
      return content.courses.length > 0 || content.dishes.length > 0;
    case "spotlight":
      return content.spotlight.name.trim() !== "";
    case "reasons":
      return content.reasons.length > 0;
    case "gallery":
      return content.gallery.length > 0;
    case "quotes":
    case "interlude":
      return content.quotes.length > 0;
    case "cellar":
      return cellar;
    case "kitchen":
    case "statement":
      return chef;
    case "laurels":
      return content.awards.length > 0;
    case "private":
    case "celebrations":
      return content.privateDining.title.trim() !== "";
    case "chapters":
      return story || chef || cellar;
    default:
      return true;
  }
}

/**
 * The live data, poured into the slots the templates already read.
 *
 * - The menu: every available dish, by course, at its real price. The dish cards are
 *   the ones with photographs, and the dish of the moment is the first of those.
 * - Quotes: the latest reviews that left words, marked as guest reviews with their
 *   score - never a name, since reviews carry none.
 * - The opening: the restaurant's own name where the manager wrote no headline.
 */
export function withLiveData(
  content: SampleContent,
  live: { name: string; menu: PublicRestaurant | null; reviews: PublicReviews | null },
): SampleContent {
  const next: SampleContent = { ...content };

  if (next.headline.trim() === "") {
    next.headline = live.name;
  }

  // The primary button books a table; the booking sheet listens for #book.
  if (/book|reserve|table/i.test(next.actions.primary) && next.actions.primaryHref === "#visit") {
    next.actions = { ...next.actions, primaryHref: "#book" };
  }

  const menu = live.menu;

  if (menu !== null && menu.menu.length > 0) {
    const price = (amount: number) => `${menu.currency} ${money(amount, 0)}`;
    const items = menu.menu.flatMap((section) => section.items);
    const pictured = items.filter((item) => item.imageUrl !== null);

    next.courses = menu.menu
      .filter((section) => section.items.length > 0)
      .map((section) => ({
        name: section.name,
        note: "",
        lines: section.items.map((item) => ({
          name: item.name,
          description: item.description ?? "",
          price: price(item.price),
        })),
      }));

    next.dishes = pictured.slice(0, 6).map((item) => ({
      name: item.name,
      description: item.description ?? "",
      price: price(item.price),
      photo: item.imageUrl! as PhotoRef,
    }));

    const lead = pictured[0];

    if (lead !== undefined && next.spotlight.name.trim() === "") {
      next.spotlight = {
        ...next.spotlight,
        eyebrow: "From the kitchen",
        name: lead.name,
        description: lead.description ?? "",
        price: price(lead.price),
        photo: lead.imageUrl! as PhotoRef,
      };
    }
  } else {
    // No live menu to show: nothing typed into the editor stands in for it.
    next.courses = [];
    next.dishes = [];
  }

  const reviews = live.reviews;

  next.quotes =
    reviews !== null && reviews.reviews.length > 0
      ? reviews.reviews.map((review) => ({
          quote: review.comment,
          author: `${"★".repeat(review.rating)} · Guest review`,
        }))
      : [];

  return next;
}
