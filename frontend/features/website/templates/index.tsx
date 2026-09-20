"use client";

import type { DesignId } from "@/features/website/designs";
import type { SampleContent } from "@/features/website/sample-content";
import { AuroraTemplate } from "./aurora";
import { SlateTemplate } from "./slate";
import { HarvestTemplate } from "./harvest";
import { AtriumTemplate } from "./atrium";

/**
 * Draws a restaurant page in the design it has been given.
 *
 * The one place a design id becomes a component. Without it every screen that wants
 * to show a page — the preview, the gallery, and eventually the editor and the public
 * route — writes its own switch, and the day a design is added they disagree about
 * which of them knows it exists.
 */

/**
 * The facts about a restaurant that a design prints.
 *
 * Narrower than the full record on purpose. A template needs a name, an address and a
 * way to be contacted, and asking for the whole `Restaurant` meant it could only be
 * drawn where one existed — which is the manager's editor and nowhere else. A visitor
 * on the public page is served a page, not a restaurant record: no identifier, no
 * manager, no timestamps, none of which are a stranger's business.
 *
 * A full `Restaurant` still satisfies this, so the editor passes one unchanged.
 */
export interface SiteIdentity {
  name: string;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

/** What every template is handed. The same shape, so they stay interchangeable. */
export interface TemplateProps {
  restaurant: SiteIdentity;
  /** Omitted, a template fills itself with the sample restaurant. */
  content?: SampleContent;
}

export function SiteRenderer({
  design,
  ...props
}: TemplateProps & { design: DesignId }) {
  switch (design) {
    case "aurora":
      return <AuroraTemplate {...props} />;
    case "slate":
      return <SlateTemplate {...props} />;
    case "harvest":
      return <HarvestTemplate {...props} />;
    case "atrium":
      return <AtriumTemplate {...props} />;
    default:
      // Every design in the catalogue is drawn, so this is unreachable today. Kept
      // because the catalogue is data and the next one to be added will land here
      // first: returning nothing is better than falling back to another design,
      // which would teach a manager the wrong thing about both.
      return null;
  }
}
