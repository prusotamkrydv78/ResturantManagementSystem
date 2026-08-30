import type { SiteContent, SiteTemplate } from "@/types/site";
import { AuroraTemplate } from "./aurora";
import { LanternTemplate } from "./lantern";
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
}: {
  template: SiteTemplate;
  content: SiteContent;
  restaurantName: string;
}) {
  const props = { content, restaurantName };

  switch (template) {
    case "Slate":
      return <SlateTemplate {...props} />;
    case "Terrace":
      return <TerraceTemplate {...props} />;
    case "Lantern":
      return <LanternTemplate {...props} />;
    case "Press":
      return <PressTemplate {...props} />;
    case "Aurora":
      return <AuroraTemplate {...props} />;
    default:
      // A value this build does not know, from a record written by a later one.
      // Drawn in the default design rather than as an error: a visitor should get
      // the restaurant's page, not a stack trace about a template name.
      return <AuroraTemplate {...props} />;
  }
}
