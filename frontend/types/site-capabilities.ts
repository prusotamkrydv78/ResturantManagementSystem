import type { SiteTemplate } from "@/types/site";

/**
 * What each design can draw.
 *
 * The original premise was that all five templates rendered the same content, which
 * kept switching lossless but forced every design down to the same shape: five
 * variations on one brochure. A dining room and a street-food cafe do not want the
 * same page, and pretending otherwise is what made them all look thin.
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
  "gallery",
  "hours",
  "contact",
  "footer",
  "theme",
  "seo",
];

/**
 * Which extra parts each design carries.
 *
 * Deliberately uneven. A design that does everything is a design with no opinion,
 * and the point of offering five is that a manager picks the one that matches the
 * restaurant they actually run.
 */
export const TEMPLATE_FEATURES: Record<SiteTemplate, SiteFeature[]> = {
  // The full dining-room page: a menu in courses, the chef, awards, a dish given a
  // section of its own, and the private-dining enquiry a restaurant of this kind
  // gets asked about most.
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

  // Photographs first. A flat list of dishes as cards, and reasons to visit, but no
  // menu in courses: this design shows food rather than listing it.
  Aurora: [...COMMON, "dishes", "features", "testimonials", "cta"],

  // A story told in bands. Carries the chef, because the story is usually theirs,
  // and a menu in courses, but no awards or spotlight.
  Terrace: [...COMMON, "chef", "menuGroups", "features", "testimonials", "cta"],

  // Fast and loud. Cards, reasons to visit, and one dish pushed forward. No chef, no
  // awards, no courses: this is a counter, not a dining room.
  Lantern: [...COMMON, "dishes", "spotlight", "features", "testimonials", "cta"],

  // A printed menu on a page. Courses and awards, and nothing that would clutter it:
  // no gallery-led sections, no spotlight, no events block.
  Press: [...COMMON, "menuGroups", "awards", "testimonials", "cta"],
};

/** Whether a design draws this part at all. */
export function supports(template: SiteTemplate, feature: SiteFeature): boolean {
  return TEMPLATE_FEATURES[template]?.includes(feature) ?? false;
}
