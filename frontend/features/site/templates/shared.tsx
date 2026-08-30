import { siteImageSrc } from "@/features/site/api";
import type { SiteContent } from "@/types/site";

/**
 * Pieces every template is built from.
 *
 * Two rules hold across every design, and they live here so no template has to
 * remember them:
 *
 * A section with nothing in it does not render. A manager who has not written their
 * story should get a page without a story, not a heading over white space — which
 * means every template asks `has()` before drawing anything.
 *
 * Content is text, never markup. Everything here goes through React as a child, so
 * it is escaped, and there is no path in any template that could interpret what a
 * manager typed as HTML.
 */

/** Whether a string has anything worth rendering. */
export function has(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * A link a visitor may follow.
 *
 * The server already refused anything outside http, https, mailto and tel on the
 * way in. This is the second half of that check, at the point of rendering, because
 * a row written before the rule existed is still in the database and an href is
 * exactly where a missed one would matter.
 */
export function safeHref(url: string): string | null {
  const trimmed = (url ?? "").trim();

  if (trimmed === "") {
    return null;
  }

  // A fragment scrolls the page it is already on: inert, and needed by the designs
  // with anchored navigation.
  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("//") ? null : trimmed;
  }

  return /^(https?:\/\/|mailto:|tel:)/i.test(trimmed) ? trimmed : null;
}

/**
 * Splits a body field into paragraphs on blank lines.
 *
 * The editor gives a manager one plain textarea, so this is the only formatting
 * they have. It is deliberately the only one: any richer syntax would be markup by
 * another name, and the whole premise is that they cannot break the layout.
 */
export function paragraphs(body: string): string[] {
  return (body ?? "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/**
 * An image from the content.
 *
 * Renders nothing at all when there is no URL, so a template can place one
 * unconditionally and get a page without a hole in it. Plain `img` rather than the
 * framework's: these point at arbitrary hosts a manager chose, which the optimiser
 * would need configuring for one domain at a time.
 */
export function SiteImageEl({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const src = siteImageSrc(url);

  if (src === "") {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />
  );
}

/** Whether the content has enough in a section for it to be worth a heading. */
export const sections = {
  hero: (c: SiteContent) =>
    has(c.hero.headline) || has(c.hero.body) || has(c.hero.imageUrl),
  about: (c: SiteContent) => has(c.about.title) || has(c.about.body),
  dishes: (c: SiteContent) => c.dishes.length > 0,
  features: (c: SiteContent) => c.features.length > 0,
  gallery: (c: SiteContent) => c.gallery.some((image) => has(image.imageUrl)),
  hours: (c: SiteContent) => c.hours.length > 0,
  testimonials: (c: SiteContent) => c.testimonials.length > 0,
  contact: (c: SiteContent) =>
    has(c.contact.addressLine) ||
    has(c.contact.city) ||
    has(c.contact.phone) ||
    has(c.contact.email),
  cta: (c: SiteContent) => has(c.callToAction.title) || has(c.callToAction.buttonLabel),
  footer: (c: SiteContent) => has(c.footer.note) || c.footer.links.length > 0,
};

/**
 * The one colour a manager may set, as a CSS variable the template's own classes
 * fall back around.
 *
 * A variable rather than a class, because the value is arbitrary and Tailwind can
 * only generate classes it can see at build time. Validated as a hex colour on the
 * server before it ever reaches a style attribute.
 */
export function accentStyle(accent: string, fallback: string): React.CSSProperties {
  return { ["--accent" as string]: has(accent) ? accent.trim() : fallback };
}

/** The name shown in the header, falling back to the registered restaurant name. */
export function brandName(content: SiteContent, restaurantName: string): string {
  return has(content.brand.name) ? content.brand.name : restaurantName;
}

/** Props every template takes. */
export interface TemplateProps {
  content: SiteContent;
  restaurantName: string;
}

/** Address, telephone and email, as links wherever a link is meaningful. */
export function ContactBlock({
  content,
  className,
}: {
  content: SiteContent;
  className?: string;
}) {
  const phone = safeHref(content.contact.phone.trim() === "" ? "" : `tel:${content.contact.phone}`);
  const email = safeHref(content.contact.email.trim() === "" ? "" : `mailto:${content.contact.email}`);
  const map = safeHref(content.contact.mapUrl);

  return (
    <address className={`flex flex-col gap-2 not-italic ${className ?? ""}`}>
      {has(content.contact.addressLine) && <span>{content.contact.addressLine}</span>}
      {has(content.contact.city) && <span>{content.contact.city}</span>}
      {phone !== null && (
        <a href={phone} className="underline-offset-4 hover:underline">
          {content.contact.phone}
        </a>
      )}
      {email !== null && (
        <a href={email} className="underline-offset-4 hover:underline">
          {content.contact.email}
        </a>
      )}
      {map !== null && (
        <a
          href={map}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Open in maps
        </a>
      )}
    </address>
  );
}
