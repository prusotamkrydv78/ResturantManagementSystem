"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { setSitePublished, type Site } from "@/features/website/api";
import { useQueryClient } from "@tanstack/react-query";
import { managerKeys, useMyRestaurant, useSite } from "@/queries/manager";
import { siteAddress } from "@/features/website/address";
import { DESIGNS, designById, type Design } from "@/features/website/designs";
import { DesignSketchView } from "@/features/website/design-sketch";
import { Report, useAction } from "@/features/platform/use-action";
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
        description="Pick a design for your public page. You can switch later without losing a word."
      />

      <PageBody>
        {/* What the website is doing, before the gallery of what it could look like.
            The publish control used to exist only inside the editor, as a glyph. */}
        <SiteStatus />

        <p className="text-xs text-muted">
          Open a design to preview it with your details.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {DESIGNS.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      </PageBody>
    </>
  );
}

/**
 * Whether this restaurant has a website, and the one control that changes it.
 *
 * WHY IT IS HERE AND NOT ONLY IN THE EDITOR
 *
 * Publishing lived on a toolbar inside the editor, as a glyph that named itself on
 * hover. That is a reasonable place for it while somebody is editing and a poor one
 * for every other question about the website: whether it is live, which design it is
 * on, what address it answers on, and how to take it down. All of those were only
 * answerable by opening a design and looking at a circle.
 *
 * So the state and the switch live on the page the sidebar points at, and the toolbar
 * keeps the copy of Publish that belongs next to the work.
 */
function SiteStatus() {
  // From the shared cache: the site and the restaurant it answers for.
  const siteQuery = useSite();
  const restaurantQuery = useMyRestaurant();
  const client = useQueryClient();
  const action = useAction();
  const site = siteQuery.data ?? null;
  const restaurant = restaurantQuery.data ?? null;
  const failure = site === null ? siteQuery.error : restaurant === null ? restaurantQuery.error : null;
  const error = failure !== null ? (failure instanceof Error ? failure.message : "Unable to read your website.") : null;
  const setSite = (next: Site) => client.setQueryData(managerKeys.site(), next);

  if (error !== null) {
    return (
      <Surface>
        <ErrorState message={error} onRetry={() => { void siteQuery.refetch(); void restaurantQuery.refetch(); }} />
      </Surface>
    );
  }

  if (site === null || restaurant === null) {
    return (
      <Surface className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-56" />
      </Surface>
    );
  }

  const design = site.design === "" ? undefined : designById(site.design);
  const address = siteAddress(restaurant);

  // Three states, not two. "Live" and "not published" are the obvious pair; the third
  // is a page that is live and has been edited since, which is the one a manager most
  // often wants to know about and the one a boolean cannot say.
  const state = !site.isPublished
    ? ("draft" as const)
    : site.hasUnpublishedChanges
      ? ("behind" as const)
      : ("live" as const);

  // One row: what the page is and where it lives on the left, what to do about it
  // on the right. It was three bands - a header, an address, a footer of buttons -
  // each with its own padding and rule, and most of the card was the gaps between.
  return (
    <Surface className="flex flex-col gap-3 p-4">
      <Report action={action} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              state === "live"
                ? "bg-accent text-accent-fg"
                : state === "behind"
                  ? "bg-warning-soft text-warning"
                  : "bg-surface-2 text-muted",
            )}
          >
            <Globe className="size-5" />
          </span>

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-text">Your website</span>
              {state === "live" ? (
                <Badge tone="success" dot>
                  Live
                </Badge>
              ) : state === "behind" ? (
                <Badge tone="warning" dot>
                  Changes not published
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Not published
                </Badge>
              )}
            </span>

            <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>{design === undefined ? "No design chosen yet - open one below" : `Built on ${design.name}`}</span>
              {site.isPublished && (
                <>
                  <span className="text-subtle">·</span>
                  <a
                    href={address.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 rounded font-mono text-primary hover:underline"
                  >
                    <span className="truncate">{address.label}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </>
              )}
            </span>

            {site.isPublished && !address.isSubdomain && (
              // Said plainly rather than left as a shorter-looking URL. A manager who
              // has been promised their own address should know why they have not got
              // one, and that it is not theirs to fix.
              <span className="text-xs text-muted">
                Your own web address has not been set up yet. Ask the platform administrator for one.
              </span>
            )}
            {!site.isPublished && (
              <span className="text-xs text-muted">
                Nobody outside the restaurant can see it yet. Publishing takes a copy of what you have saved.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {design !== undefined && (
            <LinkButton href={`/website/${design.id}`} variant="secondary" target="_blank" rel="noreferrer">
              Open the editor
            </LinkButton>
          )}

          {site.isPublished && (
            // Taking a page down is not the same as deleting it: the draft, the design
            // and every word stay exactly where they are, and publishing again puts
            // them back. Worth saying on the button rather than in a dialog.
            <Button
              variant="secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  setSite(await setSitePublished(false));
                }, "Taken down. Your work is kept.")
              }
            >
              Take it down
            </Button>
          )}

          <Button
            disabled={action.busy || site.design === ""}
            onClick={() =>
              void action.run(async () => {
                setSite(await setSitePublished(true));
              }, site.isPublished ? "Published." : "Published. Your page is live.")
            }
          >
            {action.busy
              ? "Publishing…"
              : state === "behind"
                ? "Publish changes"
                : state === "live"
                  ? "Publish again"
                  : "Publish"}
          </Button>
        </div>
      </div>
    </Surface>
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

        {/* Who it is for, before what it holds, and nothing longer: the sketch above
            already shows how it lays a page out, so the paragraph describing that
            was the same thing twice. */}
        <p className="text-sm text-muted">{design.suitedTo}</p>

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
