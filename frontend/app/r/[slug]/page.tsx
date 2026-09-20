"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/states";
import { getPublicSite, type PublicSite } from "@/features/website/api";
import { designById } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { conformContent } from "@/features/website/editor/conform";
import { sampleContent } from "@/features/website/sample-content";

/**
 * A restaurant's website, as a stranger sees it.
 *
 * WHY THIS HAD TO EXIST
 *
 * Publishing wrote the published copy and there was nowhere to read it. A manager
 * could build a page, press Publish, be told it was live, and no address on the
 * internet would show it — the whole feature ended one route short of doing anything.
 *
 * NOTHING OF THE EDITOR REACHES HERE
 *
 * No draft hook, no library, no editable wrappers, no toolbar. The templates render
 * their children bare when nobody is editing, so what a visitor downloads is the page
 * and not the machinery that made it. It is also why the content is conformed against
 * the sample before it is drawn: this copy was written by an older build of the
 * editor as often as not, and a missing field should cost a line of a page rather
 * than the page.
 *
 * A DRAFT IS A 404, not a page with a notice on it. The server decides that; this
 * screen only has to not pretend otherwise.
 */
export default function PublicSitePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [site, setSite] = useState<PublicSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPublicSite(slug);

        if (!cancelled) setSite(loaded);
      } catch {
        // Every failure is the same page to a visitor. A stranger has no use for the
        // difference between "no such restaurant", "not published yet" and "the
        // server is unwell", and spelling out the first two tells somebody probing
        // slugs which ones exist.
        if (!cancelled) setSite(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }

  const design = site === null ? undefined : designById(site.design);

  if (site === null || design === undefined) {
    return <NotHere />;
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

/**
 * Nothing at this address.
 *
 * Deliberately plain, and deliberately not branded as this product. Somebody who
 * mistyped a restaurant's address is not a prospect for restaurant software, and a
 * page that used their mistake as a billboard would be the worst first impression
 * either business could make.
 */
function NotHere() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
      <h1 className="text-lg font-semibold text-text">Nothing here yet</h1>
      <p className="max-w-sm text-sm text-muted">
        There is no page at this address. If you were looking for a restaurant, check
        the link you followed.
      </p>
    </main>
  );
}
