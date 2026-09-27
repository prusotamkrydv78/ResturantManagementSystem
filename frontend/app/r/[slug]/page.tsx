import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { designById } from "@/features/website/designs";
import { readPublicMenu, readPublicReviews, readPublishedSite } from "@/features/website/published";
import { photoSrc } from "@/features/website/photos";
import { SiteView } from "./site-view";

/**
 * A restaurant's website, at its own address.
 *
 * WHY THIS IS A SERVER COMPONENT
 *
 * It decides whether there is a page here, and that decision has to be in the status
 * line. The subdomain rewrite deliberately does not consult the database - it turns a
 * host into a path and lets this route answer - so every label on the base domain
 * arrives here, real or not. If the deciding happened in the browser, all of them
 * would be answered `200 OK` with a screen that said otherwise, and "does this
 * restaurant exist" would have no answer any crawler, monitor or cache could read.
 *
 * Fetching here also means the request never crosses an origin, so the page does not
 * depend on the API having been told about the restaurant's hostname. It should be
 * told - the guest ordering screens still call from the browser - but the page a
 * stranger loads should not be the thing that breaks when it has not been.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * The tab, named after the restaurant rather than after this product.
 *
 * A published page is the restaurant's, and a browser tab reading "Restaurant OS"
 * over somebody's dining room announces their supplier to their guests.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await readPublishedSite(slug);

  if (site === null) {
    return { title: "Nothing here yet" };
  }

  const where = [site.city, site.country].filter((part) => part !== null && part.trim() !== "").join(", ");
  const written = typeof site.content.standfirst === "string" ? site.content.standfirst.trim() : "";
  const description =
    written !== ""
      ? written
      : `${site.restaurantName}${where === "" ? "" : ` in ${where}`}. See the menu, book a table or order online.`;
  const hero = typeof site.content.heroPhoto === "string" ? site.content.heroPhoto : "room";
  const image = photoSrc(hero, 1200, 630);
  const title = where === "" ? site.restaurantName : `${site.restaurantName} · ${where}`;

  // What a search result and a shared link show: the name and place, a real line
  // about the restaurant, and its own photograph - so a link sent on WhatsApp or
  // posted on Facebook arrives as a card rather than a bare address.
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PublicSitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await readPublishedSite(slug);

  // A draft is a 404, and so is a design this build does not have. The second is the
  // rarer one and the easier to serve badly: a page whose design was renamed or
  // withdrawn would otherwise render as a blank white document at a real address,
  // which reads to a visitor as a restaurant that has gone out of business.
  if (site === null || designById(site.design) === undefined) {
    notFound();
  }

  // The live menu and the real reviews, beside the page. Either may be missing; the
  // page then goes without it rather than showing anything invented.
  const [menu, reviews] = await Promise.all([readPublicMenu(site.slug), readPublicReviews(site.slug)]);

  // What a search engine reads about the restaurant: schema.org's Restaurant, built
  // only from facts the product holds - never the sample page's words.
  const structured = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: site.restaurantName,
    telephone: site.contactPhone ?? undefined,
    email: site.contactEmail ?? undefined,
    address:
      site.addressLine !== null || site.city !== null
        ? {
            "@type": "PostalAddress",
            streetAddress: site.addressLine ?? undefined,
            addressLocality: site.city ?? undefined,
            addressCountry: site.country ?? undefined,
          }
        : undefined,
    acceptsReservations: true,
    hasMenu: menu !== null && menu.menu.length > 0 ? "#menu" : undefined,
    aggregateRating:
      reviews !== null && reviews.count > 0 && reviews.averageRating !== null
        ? { "@type": "AggregateRating", ratingValue: reviews.averageRating, reviewCount: reviews.count }
        : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escaped so nothing in a restaurant's name can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}
      />
      <SiteView site={site} menu={menu} reviews={reviews} />
    </>
  );
}
