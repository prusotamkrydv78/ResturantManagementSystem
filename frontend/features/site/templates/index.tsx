import type { SiteContent, SiteTemplate } from "@/types/site";
import { AuroraTemplate } from "./aurora";
import { PressTemplate } from "./press";
import { SlateTemplate } from "./slate";
import { TerraceTemplate } from "./terrace";

/**
 * Draws a restaurant page in the design it has chosen.
 *
 * The one place a template value becomes a component, used by both the public route
 * and the editor's preview — so what a manager previews is the same code a visitor
 * gets, rather than an approximation of it that drifts.
 */
export function SiteRenderer({
  template,
  content,
  restaurantName,
  orderHref,
}: {
  template: SiteTemplate;
  content: SiteContent;
  restaurantName: string;
  /** Where the ordering page is. Omitted, no design draws an ordering button. */
  orderHref?: string;
}) {
  const props = { content, restaurantName, orderHref };

  switch (template) {
    case "Slate":
      return <SlateTemplate {...props} />;
    case "Terrace":
      return <TerraceTemplate {...props} />;
    case "Press":
      return <PressTemplate {...props} />;
    case "Aurora":
      return <AuroraTemplate {...props} />;
    default:
      // A design this build does not know: a record written by a later one, or a
      // row still naming one that has been withdrawn. Drawn in the default rather
      // than as an error, because a visitor should get the restaurant's page and
      // not a stack trace about a template name.
      return <AuroraTemplate {...props} />;
  }
}
