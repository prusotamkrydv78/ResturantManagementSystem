import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteRenderer } from "@/features/site/templates";
import { serverApiUrl } from "@/lib/config/server-api";
import { emptySiteContent, type PublicSite, type SiteContent } from "@/types/site";

/**
 * A restaurant's public website.
 *
 * Rendered on the server, unlike every other page in this product, and deliberately
 * so: this is the one screen whose audience is strangers arriving from a search
 * engine rather than staff who have signed in. A client-rendered page would serve
 * them an empty document and hope their crawler ran the JavaScript.
 *
 * Reached two ways, both landing here. `/r/{slug}` works anywhere, including
 * localhost, which is what makes a page previewable while it is being written. A
 * subdomain is rewritten onto the same route by `proxy.ts`, so adding one later
 * costs no change to this file.
 */

/** Revalidated rather than rendered per request: a marketing page changes rarely. */
export const revalidate = 300;

async function loadSite(slug: string): Promise<PublicSite | null> {
  try {
    const response = await fetch(
      `${serverApiUrl()}/api/public/sites/${encodeURIComponent(slug)}`,
      { next: { revalidate } },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PublicSite;
  } catch {
    // The API being unreachable and the page not existing are both "no page to
    // show". A visitor gets the not-found page either way rather than a stack trace.
    return null;
  }
}

/**
 * Fills in anything a stored record left out.
 *
 * The server already defaults every field, but this page is the one thing rendering
 * data written by somebody else's build, and a template that hits an undefined list
 * would take the whole site down rather than drop a section.
 */
function withDefaults(content: SiteContent): SiteContent {
  const empty = emptySiteContent();

  return {
    ...empty,
    ...content,
    brand: { ...empty.brand, ...content?.brand },
    hero: { ...empty.hero, ...content?.hero },
    about: { ...empty.about, ...content?.about },
    dishes: content?.dishes ?? [],
    features: content?.features ?? [],
    gallery: content?.gallery ?? [],
    hours: content?.hours ?? [],
    testimonials: content?.testimonials ?? [],
    contact: { ...empty.contact, ...content?.contact },
    callToAction: { ...empty.callToAction, ...content?.callToAction },
    footer: {
      note: content?.footer?.note ?? "",
      links: content?.footer?.links ?? [],
    },
    theme: { ...empty.theme, ...content?.theme },
    seo: { ...empty.seo, ...content?.seo },
  };
}

export async function generateMetadata({
  params,
}: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);

  if (site === null) {
    return { title: "Not found" };
  }

  const content = withDefaults(site.content);
  const title = content.seo.title.trim() || site.restaurantName;
  const description = content.seo.description.trim() || content.hero.body.trim();

  return {
    title,
    ...(description === "" ? {} : { description }),
    // Enough for a link pasted into a message to unfurl with the restaurant's own
    // words, which is how most people will meet this page.
    openGraph: {
      title,
      ...(description === "" ? {} : { description }),
      type: "website",
    },
  };
}

export default async function RestaurantSitePage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const site = await loadSite(slug);

  if (site === null) {
    notFound();
  }

  return (
    <SiteRenderer
      template={site.template}
      content={withDefaults(site.content)}
      restaurantName={site.restaurantName}
    />
  );
}
