"use client";

import type { PublicSite } from "@/features/website/api";
import { designById } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { conformContent } from "@/features/website/editor/conform";
import { sampleContent } from "@/features/website/sample-content";

/**
 * A restaurant's page, as a stranger sees it.
 *
 * NOTHING OF THE EDITOR REACHES HERE
 *
 * No draft hook, no library, no editable wrappers, no toolbar. The templates render
 * their children bare when nobody is editing, so what a visitor downloads is the page
 * and not the machinery that made it. It is also why the content is conformed against
 * the sample before it is drawn: this copy was written by an older build of the editor
 * as often as not, and a missing field should cost a line of a page rather than the
 * page.
 *
 * It is a client component only because the designs animate. The deciding - whether
 * there is a page here at all - happened on the server before this was ever sent.
 */
export function SiteView({ site }: { site: PublicSite }) {
  const design = designById(site.design);

  if (design === undefined) {
    return null;
  }

  return (
    <main className="site-page">
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
        content={conformContent(sampleContent(), site.content)}
      />
    </main>
  );
}
