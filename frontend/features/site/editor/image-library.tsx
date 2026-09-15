"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/states";
import { deleteSiteImage, siteImageSrc } from "@/features/site/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { SiteContent, SiteImage } from "@/types/site";

/**
 * Everything uploaded for this page, and the only way to remove any of it.
 *
 * This exists because the product had a dead end in it. A restaurant may hold thirty
 * images; the delete endpoint has always been implemented on both sides of the wire,
 * and nothing in the application ever called it. A manager who filled the shelf got
 * "You have reached the limit" on every subsequent upload, forever, with no way in
 * the product to free a slot - not for a typo, not for a photograph of the wrong
 * dish, not for anything.
 *
 * The count is stated rather than left to be discovered at the moment of failure. A
 * limit somebody can see coming is a constraint; one they meet without warning is a
 * fault.
 */

/** How many images a restaurant may hold. Mirrors SiteImage.MaxPerRestaurant. */
const MAX_IMAGES = 30;

export function ImageLibrary({
  images,
  content,
  onDeleted,
}: {
  images: SiteImage[];
  /** Read to work out which pictures are actually on the page. */
  content: SiteContent;
  onDeleted: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const used = usedUrls(content);
  const remaining = MAX_IMAGES - images.length;

  async function remove(image: SiteImage) {
    setError(null);
    setBusyId(image.id);

    try {
      await deleteSiteImage(image.id);
      onDeleted(image.id);
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not remove that image.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Surface id="section-images">
      <SurfaceHeader
        title="Uploaded images"
        description="Every picture on this page. Removing one clears it from wherever it is used."
        actions={
          <Badge tone={remaining <= 3 ? "warning" : "neutral"}>
            {images.length} of {MAX_IMAGES} used
          </Badge>
        }
      />

      {images.length === 0 ? (
        <EmptyState
          title="Nothing uploaded yet"
          description="Pictures you add to a section appear here, and can be reused across the page."
        />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {error !== null && <p className="text-xs text-danger">{error}</p>}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => {
              const isUsed = used.has(image.url);

              return (
                <li key={image.id} className="flex flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={siteImageSrc(image.url)}
                      alt={image.fileName}
                      className="aspect-4/3 w-full object-cover"
                    />

                    {/* Said on the picture rather than only in a list below it: the
                        question being asked here is "can I delete this one", and the
                        answer has to be next to the button that does it. */}
                    <span className="absolute top-1.5 left-1.5">
                      <Badge tone={isUsed ? "success" : "neutral"} dot>
                        {isUsed ? "On the page" : "Unused"}
                      </Badge>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className="min-w-0 flex-1 truncate text-2xs text-muted"
                      title={image.fileName}
                    >
                      {image.fileName}
                    </span>
                    <span className="shrink-0 text-2xs text-subtle tabular-nums">
                      {kilobytes(image.byteCount)}
                    </span>
                  </div>

                  <Button
                    variant={isUsed ? "secondary" : "ghost"}
                    size="sm"
                    icon={<Trash2 />}
                    disabled={busyId === image.id}
                    className={cn("justify-center", isUsed && "text-danger!")}
                    onClick={() => void remove(image)}
                  >
                    {busyId === image.id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Surface>
  );
}

/**
 * Every image URL the page currently points at.
 *
 * Walked rather than tracked, because the content is the truth: a picture is in use
 * if some field names it, and keeping a separate count would be a second answer to
 * the same question waiting to disagree with the first.
 */
function usedUrls(content: SiteContent): Set<string> {
  const urls = [
    content.hero.imageUrl,
    content.about.imageUrl,
    content.spotlight.imageUrl,
    content.chef.imageUrl,
    content.events.imageUrl,
    ...content.dishes.map((dish) => dish.imageUrl),
    ...content.menuGroups.flatMap((group) =>
      group.items.map((item) => item.imageUrl),
    ),
    ...content.gallery.map((image) => image.imageUrl),
  ];

  return new Set(urls.filter((url) => url.trim() !== ""));
}

function kilobytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The same content with every reference to one picture cleared.
 *
 * Called when an image is deleted. The file is gone from the server either way, so a
 * field still naming it would draw a broken image on a live page - the page has to
 * stop pointing at it in the same movement that removes it.
 */
export function withoutImage(content: SiteContent, url: string): SiteContent {
  if (url.trim() === "") {
    return content;
  }

  const clear = (value: string) => (value === url ? "" : value);

  return {
    ...content,
    hero: { ...content.hero, imageUrl: clear(content.hero.imageUrl) },
    about: { ...content.about, imageUrl: clear(content.about.imageUrl) },
    spotlight: { ...content.spotlight, imageUrl: clear(content.spotlight.imageUrl) },
    chef: { ...content.chef, imageUrl: clear(content.chef.imageUrl) },
    events: { ...content.events, imageUrl: clear(content.events.imageUrl) },
    dishes: content.dishes.map((dish) => ({
      ...dish,
      imageUrl: clear(dish.imageUrl),
    })),
    menuGroups: content.menuGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        imageUrl: clear(item.imageUrl),
      })),
    })),
    // Dropped rather than blanked: a gallery entry is only a picture, so one with no
    // picture is an empty frame on the page rather than a field waiting to be filled.
    gallery: content.gallery.filter((image) => image.imageUrl !== url),
  };
}
