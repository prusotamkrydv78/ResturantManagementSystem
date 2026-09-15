"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Globe, Info, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ErrorState, Spinner } from "@/components/ui/states";
import { Surface } from "@/components/ui/surface";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { getMyRestaurant } from "@/features/restaurants/api";
import { designById } from "@/features/website/designs";
import { SiteRenderer } from "@/features/website/templates";
import { isMissingRestaurant } from "@/lib/api/client";
import type { Restaurant } from "@/types/restaurant";

/**
 * One design, drawn as this restaurant's own page, with nothing around it.
 *
 * Opened in its own tab from the gallery, and that is the point of the route living
 * outside the application shell: a website judged inside a sidebar and a settings
 * rail is a website judged at the wrong width, with someone else's navigation next to
 * every margin it has.
 *
 * The name, the address and the two contact details are read from the restaurant
 * record. Everything else — headline, menu, photographs, hours, quotes — is sample
 * copy, and the bar below says so rather than leaving it to be discovered. A page
 * that quietly presented invented dishes as the restaurant's own would be worse than
 * an empty one.
 */
export default function DesignPreviewPage() {
  const params = useParams();
  const id = typeof params.design === "string" ? params.design : "";
  const design = designById(id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingRestaurant, setMissingRestaurant] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getMyRestaurant();

        if (cancelled) return;

        setRestaurant(loaded);
        setError(null);
        setMissingRestaurant(false);
      } catch (caught) {
        if (cancelled) return;

        if (isMissingRestaurant(caught)) {
          setMissingRestaurant(true);
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load your restaurant.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (design === undefined) {
    return (
      <Centred>
        <ErrorState
          title="No such design"
          message="That design is not one of the four on offer."
        />
      </Centred>
    );
  }

  if (missingRestaurant) {
    return (
      <Centred>
        <NoRestaurantAssigned area="Website" />
      </Centred>
    );
  }

  if (error !== null) {
    return (
      <Centred>
        <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Centred>
    );
  }

  if (restaurant === null) {
    return (
      <Centred>
        <Spinner label="Drawing your page…" />
      </Centred>
    );
  }

  return (
    <div className="min-h-svh">
      {design.isBuilt ? (
        <SiteRenderer design={design.id} restaurant={restaurant} />
      ) : (
        <Centred>
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-base font-medium text-text">{design.name} is not built yet</p>
            <p className="max-w-sm text-sm text-muted">
              It is in the catalogue but has not been drawn yet.
            </p>
          </div>
        </Centred>
      )}

      <Toolbar name={design.name} />
    </div>
  );
}

/**
 * The controls, floating over the page rather than framing it.
 *
 * At the bottom and centred, because the top of a landing page is the one part whose
 * composition matters most and a bar across it would be judged as part of the design.
 * Floating rather than sticky-inline for the same reason: the page keeps its full
 * height and nothing about its layout changes because a preview is being looked at.
 */
function Toolbar({ name }: { name: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface/95 p-1.5 pl-4 shadow-lg backdrop-blur">
        <span className="text-sm font-semibold text-text">{name}</span>

        {/* What is real and what is not, one tap away. A preview reached from a card
            that said "with your details" needs the other half of that sentence. */}
        <Tooltip content="Your name, address, phone and email are real. The headline, menu, photographs, hours and quotes are sample copy.">
          <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-2xs font-medium text-muted">
            <Info className="size-3" aria-hidden="true" />
            Sample content
          </span>
        </Tooltip>

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

        <Link
          href="/settings/website"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-text"
        >
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          All designs
        </Link>

        {/* Disabled and labelled, which is how this product treats anything not yet
            built. There is nowhere to publish to: the site service was taken out to
            be rebuilt, and a button that appeared to work would be the one thing on
            this screen that lied. */}
        <Tooltip content="Publishing arrives with the editor. Nothing can be made public yet.">
          <span>
            <Button size="sm" icon={<Globe />} disabled>
              Publish
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

/** Anything that is not a page: an error, a spinner, a design with nothing behind it. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas p-6">
      <Surface className="w-full max-w-lg">{children}</Surface>
    </div>
  );
}
