/**
 * The restaurant's public one-page website.
 *
 * One content shape for all five designs, mirroring the server record exactly. A
 * template decides how a section looks and may leave one out, but none of them owns
 * a field the others lack — which is what makes switching design lossless.
 */

export type SiteTemplate = "Aurora" | "Slate" | "Terrace" | "Lantern" | "Press";

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
  dishes: DishContent[];
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
    dishes: [],
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
