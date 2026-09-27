"use client";

import type { PublicSite } from "@/features/website/api";
import type { PublicReviews } from "@/features/public/api";
import type { PublicRestaurant } from "@/types/public-ordering";
import { designById } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { PublishedContent } from "@/features/website/editor/editable";
import { publishedContent, sectionHasContent, withLiveData } from "@/features/website/public-content";
import { sampleContent } from "@/features/website/sample-content";
import { SiteDock } from "@/features/website/site-dock";

/**
 * A restaurant's live website.
 *
 * Draws the design with only what is true of this restaurant: what its manager wrote,
 * the live menu at its real prices, and the reviews guests actually left - never the
 * sample restaurant the editor shows while a page is being built (see
 * public-content.ts). Sections with nothing true to say are left out, and the dock at
 * the foot of the screen gives every design the same working booking, ordering,
 * menu and directions.
 */
export function SiteView({
  site,
  menu,
  reviews,
}: {
  site: PublicSite;
  menu: PublicRestaurant | null;
  reviews: PublicReviews | null;
}) {
  const design = designById(site.design);

  if (design === undefined) {
    return null;
  }

  const content = withLiveData(publishedContent(sampleContent(), site.content), {
    name: site.restaurantName,
    menu,
    reviews,
  });

  const address = [site.addressLine, site.city, site.country]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(", ");

  return (
    <main className="site-page pb-24">
      <PublishedContent value={content}>
        <SiteRenderer
          design={design.id}
          restaurant={{
            name: site.restaurantName,
            addressLine: site.addressLine,
            city: site.city,
            country: site.country,
            contactPhone: site.contactPhone,
            contactEmail: site.contactEmail,
          }}
          content={content}
        />
      </PublishedContent>

      <SiteDock
        slug={site.slug}
        name={site.restaurantName}
        address={address === "" ? null : address}
        canOrder={menu?.isAcceptingOrders === true}
        hasMenu={sectionHasContent("menu", content)}
      />
    </main>
  );
}
