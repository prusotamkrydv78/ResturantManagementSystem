"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DESIGNS, type Design } from "@/features/website/designs";
import { DesignSketchView } from "@/features/website/design-sketch";
import { cn } from "@/lib/utils/cn";

/**
 * The designs a restaurant can build its public page on.
 *
 * The front door of the website area. A design that has been drawn is a link: the
 * whole card opens it, in its own tab, filled with this restaurant's own name and
 * address. One that is only catalogued is not a link and says so, because a card that
 * looks clickable and is not is worse than one that never offered.
 *
 * A new tab rather than a navigation, and deliberately. The preview is a full-bleed
 * page with no application chrome around it, and sending somebody there in place of
 * the gallery would mean leaving the list to look at one item and coming back to the
 * top of it. Comparing two designs is the whole reason this screen exists.
 *
 * The card's picture is a miniature rather than a wireframe: the design's own palette,
 * and its own photographs where photographs are what it is built out of. It has to work
 * for the three designs that do not exist yet as well as the one that does, which is
 * why it is drawn rather than rendered — but it is drawn accurately.
 *
 * Role is enforced by the settings layout, which wraps this.
 */
export default function WebsiteDesignsPage() {
  return (
    <>
      <PageHeader
        title="Website"
        description="The designs your public page can be built on. Pick the one that looks like the restaurant you run — you will be able to change your mind later without losing a word."
      />

      <PageBody>
        <p className="text-xs text-muted">
          Four designs. Open any of them to see the whole page with your own name,
          address and contact details; everything else in the preview is sample copy.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {DESIGNS.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      </PageBody>
    </>
  );
}

/** One design: how it lays a page out, what it is for, and what it carries. */
function DesignCard({ design }: { design: Design }) {
  const body = (
    <>
      <DesignSketchView design={design} />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-lg font-semibold text-text">{design.name}</h2>
            <p className="text-2xs font-semibold tracking-wider text-subtle uppercase">
              {design.tagline}
            </p>
          </div>

          {design.isBuilt ? (
            <ArrowUpRight
              className="mt-1 size-4 shrink-0 text-subtle transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          ) : (
            <Badge tone="neutral">Being drawn</Badge>
          )}
        </div>

        <p className="text-sm text-muted">{design.description}</p>

        {/* Who it is for, before what it holds. A manager choosing a design is asking
            which one is theirs, not which one has the most features. */}
        <p className="text-xs text-subtle">{design.suitedTo}</p>

        <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {design.carries.map((section) => (
            <li key={section}>
              <Badge tone="neutral">{section}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  if (!design.isBuilt) {
    return (
      <Surface className="flex flex-col overflow-hidden opacity-75">{body}</Surface>
    );
  }

  return (
    <Surface
      className={cn(
        "group flex flex-col overflow-hidden transition-colors",
        "focus-within:border-primary-border hover:border-primary-border",
      )}
    >
      {/* The whole card is the hit area. A picture, a name and a description are all
          answering the same question, and making only one of them clickable asks a
          reader to work out which. */}
      <Link
        href={`/website/${design.id}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Preview the ${design.name} design with your details, in a new tab`}
        className="flex flex-1 flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {body}
      </Link>
    </Surface>
  );
}
