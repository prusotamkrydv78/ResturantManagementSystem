import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { designById } from "@/features/website/designs";
import { readPublishedSite } from "@/features/website/published";
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

  return {
    title: site.restaurantName,
    description:
      typeof site.content.standfirst === "string" ? site.content.standfirst : undefined,
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

  return <SiteView site={site} />;
}
