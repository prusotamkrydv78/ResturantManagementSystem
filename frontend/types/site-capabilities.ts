import type { SiteTemplate } from "@/types/site";

/**
 * What each design can draw.
 *
 * The original premise was that every template rendered the same content, which kept
 * switching lossless but forced all of them down to the same shape: variations on one
 * brochure. A dining room and a neighbourhood bistro do not want the same page, and
 * pretending otherwise is what made them all look thin.
 *
 * So a template now declares its own parts. The editor reads this and shows a
 * manager only the sections their design can actually use — no writing a chef's
 * biography into a template that will never render one.
 *
 * Switching stays lossless. Content a design does not draw is kept, not deleted, so
 * trying a different look and going back costs nothing. What changes is only what
 * the editor puts in front of you.
 */
export type SiteFeature =
  | "brand"
  | "hero"
  | "marquee"
  | "about"
  | "chef"
  | "dishes"
  | "menuGroups"
  | "spotlight"
  | "features"
  | "awards"
  | "gallery"
  | "hours"
  | "testimonials"
  | "events"
  | "contact"
  | "cta"
  | "footer"
  | "theme"
  | "seo";

/**
 * The parts every design has, so the map below only has to state what is different.
 *
 * These are the sections a page cannot really do without: who you are, the first
 * screen, where to find you, and the small print.
 */
const COMMON: SiteFeature[] = [
  "brand",
  "hero",
  "about",
  "hours",
  "contact",
  "footer",
  "theme",
  "seo",
];

/**
 * Which extra parts each design carries.
 *
 * Deliberately uneven, and no design is a superset of another. A template that does
 * everything is a template with no opinion, and the point of offering four is that a
 * manager picks the one that matches the restaurant they actually run.
 */
export const TEMPLATE_FEATURES: Record<SiteTemplate, SiteFeature[]> = {
  // The full dining-room page: a menu in courses, the chef, awards, a dish given a
  // section of its own, and the private-dining enquiry a restaurant of this kind
  // gets asked about most.
  //
  // Also the only design with no photographs of its own, and that is the point
  // rather than an omission. It argues in writing — the menu, the story, the name
  // above the pass — and pictures are used as punctuation inside those sections. A
  // wall of them would say less, not more.
  Slate: [
    ...COMMON,
    "marquee",
    "chef",
    "menuGroups",
    "spotlight",
    "awards",
    "testimonials",
    "events",
    "cta",
  ],

  // Photographs first. Dishes as cards, one of them pushed forward, a gallery, and
  // reasons to visit — this design shows food rather than listing it. No menu in
  // courses and no chef: a page that scrolls through pictures does not stop to read.
  Aurora: [
    ...COMMON,
    "dishes",
    "spotlight",
    "features",
    "gallery",
    "testimonials",
    "cta",
  ],

  // A story told in bands. Carries the chef, because the story is usually theirs, a
  // menu in courses, and the celebrations a family restaurant is booked for. No
  // awards, no spotlight and no reasons-to-visit list: the writing does that work.
  Terrace: [
    ...COMMON,
    "chef",
    "menuGroups",
    "gallery",
    "events",
    "testimonials",
    "cta",
  ],

  // A printed menu on a page. Courses and awards, a restrained plate of photographs,
  // and nothing that would crowd it: no spotlight, no events block, no chef feature.
  Press: [...COMMON, "menuGroups", "awards", "gallery", "testimonials", "cta"],
};

/** Whether a design draws this part at all. */
export function supports(template: SiteTemplate, feature: SiteFeature): boolean {
  return TEMPLATE_FEATURES[template]?.includes(feature) ?? false;
}
