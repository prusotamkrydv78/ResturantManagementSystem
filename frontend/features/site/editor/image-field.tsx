"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { siteImageSrc, uploadSiteImage } from "@/features/site/api";
import { ApiError } from "@/lib/api/client";
import type { SiteImage } from "@/types/site";

/**
 * Picks the image for one field.
 *
 * Three ways in, because a restaurant has three situations: upload a photograph,
 * reuse one already uploaded, or clear the field. Reuse matters more than it looks —
 * the same dish photograph belongs in both the menu and the gallery, and uploading
 * it twice would spend two of a limited number of slots on one picture.
 *
 * Uploading here rather than in a separate media screen, because the manager is
 * thinking about the hero image, not about a library.
 */
export function ImageField({
  label,
  value,
  images,
  onChange,
  onUploaded,
}: {
  label: string;
  value: string;
  /** Everything already uploaded, so one picture can serve several fields. */
  images: SiteImage[];
  onChange: (url: string) => void;
  /** Lets the page fold a new upload into its list without refetching. */
  onUploaded: (image: SiteImage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (file === undefined) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const uploaded = await uploadSiteImage(file);
      onUploaded(uploaded);
      onChange(uploaded.url);
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not upload that image.",
      );
    } finally {
      setIsUploading(false);

      // Cleared so choosing the same file twice still fires a change event.
      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    }
  }

  const preview = siteImageSrc(value);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>

      <div className="flex items-start gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
          {preview === "" ? (
            <ImagePlus className="size-5 text-subtle" aria-hidden="true" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? "Uploading…" : "Upload"}
            </Button>

            {value !== "" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Trash2 />}
                onClick={() => onChange("")}
              >
                Clear
              </Button>
            )}
          </div>

          {images.length > 0 && (
            <Select
              aria-label={`Choose an uploaded image for ${label}`}
              value={images.some((image) => image.url === value) ? value : ""}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Or reuse an uploaded image…</option>
              {images.map((image) => (
                <option key={image.id} value={image.url}>
                  {image.fileName}
                </option>
              ))}
            </Select>
          )}

          {error !== null && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
