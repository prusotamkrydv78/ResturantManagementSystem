/**
 * The restaurant's public one-page website.
 *
 * One record for every design, mirroring the server exactly — but not one that any
 * single design uses all of. Which parts a template can draw is declared in
 * `site-capabilities.ts`, and the editor shows a manager only those.
 *
 * Still one record rather than one per design, because that is what keeps switching
 * lossless: content a design does not draw is kept, not discarded.
 */

export type SiteTemplate = "Aurora" | "Slate" | "Terrace" | "Press";

export interface BrandContent {
  name: string;
  tagline: string;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  body: string;
  imageUrl: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}

export interface AboutContent {
  title: string;
  body: string;
  imageUrl: string;
}

export interface DishContent {
  name: string;
  description: string;
  /** Written by the manager, so a restaurant sets its own currency. */
  price: string;
  imageUrl: string;
}

/**
 * A course, and what is on it.
 *
 * Separate from a flat dish list rather than replacing it, because the two answer
 * different designs: a cafe wants four cards, a dining room wants Starters, Mains
 * and Desserts with a dozen lines under them.
 */
export interface MenuGroupContent {
  name: string;
  description: string;
  items: DishContent[];
}

/** One dish given a section of its own. */
export interface SpotlightContent {
  eyebrow: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
}

/** The person behind the kitchen. */
export interface ChefContent {
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  quote: string;
}

/** A prize, a listing, or a mention worth showing. */
export interface AwardContent {
  title: string;
  source: string;
  year: string;
}

/** What the room is also for: private dining, parties, functions. */
export interface EventsContent {
  title: string;
  body: string;
  imageUrl: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface FeatureContent {
  title: string;
  description: string;
}

export interface GalleryImageContent {
  imageUrl: string;
  /** Also the alt text, so it is worth writing. */
  caption: string;
}

export interface HoursRowContent {
  label: string;
  value: string;
}

export interface TestimonialContent {
  quote: string;
  author: string;
}

export interface ContactContent {
  addressLine: string;
  city: string;
  phone: string;
  email: string;
  mapUrl: string;
  bookingUrl: string;
}

export interface CallToActionContent {
  title: string;
  body: string;
  /** Blank hides the whole band. */
  buttonLabel: string;
  buttonHref: string;
}

export interface FooterLinkContent {
  label: string;
  url: string;
}

export interface FooterContent {
  note: string;
  links: FooterLinkContent[];
}

export interface ThemeContent {
  /** A hex colour, or blank to keep the template's own. */
  accent: string;
}

export interface SeoContent {
  title: string;
  description: string;
}

export interface SiteContent {
  brand: BrandContent;
  hero: HeroContent;
  about: AboutContent;
  /** Short accolades, for designs that run a ticker. */
  marquee: string[];
  /** A flat list of dishes, for designs that show cards. */
  dishes: DishContent[];
  /** The menu split into courses, for designs that carry one. */
  menuGroups: MenuGroupContent[];
  spotlight: SpotlightContent;
  chef: ChefContent;
  awards: AwardContent[];
  events: EventsContent;
  features: FeatureContent[];
  gallery: GalleryImageContent[];
  hours: HoursRowContent[];
  testimonials: TestimonialContent[];
  contact: ContactContent;
  callToAction: CallToActionContent;
  footer: FooterContent;
  theme: ThemeContent;
  seo: SeoContent;
}

/** The manager's view: content, design, and whether the public can see it. */
export interface Site {
  template: SiteTemplate;
  content: SiteContent;
  isPublished: boolean;
  /** Read-only here; only a Super Admin changes a slug. */
  slug: string;
  updatedAtUtc: string;
  publishedAtUtc: string | null;
  /** Edited since it was last published. */
  hasUnpublishedChanges: boolean;
}

/** What a visitor is served. Carries no publication state: a draft is a 404. */
export interface PublicSite {
  restaurantName: string;
  template: SiteTemplate;
  content: SiteContent;
}

export interface SiteImage {
  id: string;
  /** Relative, so it survives the platform moving or gaining a subdomain. */
  url: string;
  fileName: string;
  byteCount: number;
  createdAtUtc: string;
}

export interface SiteTemplateOption {
  template: SiteTemplate;
  name: string;
  description: string;
}

export interface SaveSitePayload {
  template: SiteTemplate;
  content: SiteContent;
}

/**
 * A page with nothing filled in.
 *
 * Mirrors the server's own empty record. Used as the floor under anything read
 * back, so a template never has to guard a field that a partially written record
 * left out.
 */
export function emptySiteContent(): SiteContent {
  return {
    brand: { name: "", tagline: "" },
    hero: {
      eyebrow: "",
      headline: "",
      body: "",
      imageUrl: "",
      primaryLabel: "",
      primaryHref: "",
      secondaryLabel: "",
      secondaryHref: "",
    },
    about: { title: "", body: "", imageUrl: "" },
    marquee: [],
    dishes: [],
    menuGroups: [],
    spotlight: { eyebrow: "", name: "", description: "", price: "", imageUrl: "" },
    chef: { name: "", role: "", bio: "", imageUrl: "", quote: "" },
    awards: [],
    events: { title: "", body: "", imageUrl: "", buttonLabel: "", buttonHref: "" },
    features: [],
    gallery: [],
    hours: [],
    testimonials: [],
    contact: {
      addressLine: "",
      city: "",
      phone: "",
      email: "",
      mapUrl: "",
      bookingUrl: "",
    },
    callToAction: { title: "", body: "", buttonLabel: "", buttonHref: "" },
    footer: { note: "", links: [] },
    theme: { accent: "" },
    seo: { title: "", description: "" },
  };
}
