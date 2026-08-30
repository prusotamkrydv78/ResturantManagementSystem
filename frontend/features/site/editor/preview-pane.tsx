"use client";

import { useEffect, useRef } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { SiteRenderer } from "@/features/site/templates";
import { useElementSize } from "@/lib/hooks/use-element-size";
import { cn } from "@/lib/utils/cn";
import type { SiteContent, SiteTemplate } from "@/types/site";

/**
 * The page as it will really look, beside the form that edits it.
 *
 * Two decisions carry this component.
 *
 * It renders the actual template rather than an approximation. The alternative — an
 * iframe pointed at the published route — would show the last saved version, which
 * is exactly the thing a live preview exists not to do.
 *
 * And it renders at a real device width, then scales the result down to fit the
 * pane. A restaurant page is designed for a browser window; dropping it into a
 * 500-pixel column would trigger every mobile breakpoint and show a layout no
 * visitor will ever see. Scaling keeps the proportions honest — what is on screen
 * is the desktop design, just smaller.
 */

/** The widths a manager can check, and what each is standing in for. */
export const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1440, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 834, icon: Tablet },
  { id: "mobile", label: "Phone", width: 414, icon: Smartphone },
] as const;

export type DeviceId = (typeof DEVICES)[number]["id"];

export function PreviewPane({
  template,
  content,
  restaurantName,
  device,
  onDeviceChange,
  /** Scrolls the preview here when it changes, so the form and page stay together. */
  focusedSection,
  isStale,
}: {
  template: SiteTemplate;
  content: SiteContent;
  restaurantName: string;
  device: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  focusedSection: string | null;
  isStale: boolean;
}) {
  const [paneRef, pane] = useElementSize();
  const scrollRef = useRef<HTMLDivElement>(null);

  const width = DEVICES.find((entry) => entry.id === device)?.width ?? 1440;

  // Never scaled up: a phone frame in a wide pane should sit at its own size rather
  // than being blown up into something no phone renders.
  const scale = pane.width === 0 ? 1 : Math.min(1, pane.width / width);

  useEffect(() => {
    if (focusedSection === null || scrollRef.current === null) {
      return;
    }

    const target = scrollRef.current.querySelector(
      `[data-site-section="${focusedSection}"]`,
    );

    // A section with nothing written in it is not rendered at all, so there is
    // legitimately nothing to scroll to. Left where it is rather than jumping to
    // the top, which would read as the preview losing its place.
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusedSection, template]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-1">
          {DEVICES.map((entry) => {
            const Icon = entry.icon;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onDeviceChange(entry.id)}
                aria-pressed={device === entry.id}
                title={`${entry.label} — ${entry.width}px`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  device === entry.id
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-surface-3 hover:text-text",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {entry.label}
              </button>
            );
          })}
        </div>

        <span className="shrink-0 text-2xs text-subtle tabular-nums">
          {width}px · {Math.round(scale * 100)}%
        </span>
      </div>

      {/* The measured pane. Overflow hidden here, scrolling on the frame inside,
          so the scaled page scrolls within its own bounds rather than the border. */}
      <div ref={paneRef} className="relative min-h-0 flex-1 overflow-hidden">
        {isStale && (
          <span className="absolute top-2 right-2 z-10 rounded-full bg-surface/90 px-2 py-0.5 text-2xs text-muted shadow-sm backdrop-blur">
            Updating…
          </span>
        )}

        <div
          ref={scrollRef}
          // Laid out at the device width and then scaled, so the page inside sees
          // the viewport it was designed for. Height is divided by the scale so the
          // scaled result fills the pane exactly rather than ending short.
          style={{
            width,
            height: pane.height === 0 ? undefined : pane.height / scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="overflow-y-auto overscroll-contain"
        >
          <SiteRenderer
            template={template}
            content={content}
            restaurantName={restaurantName}
          />
        </div>
      </div>
    </div>
  );
}
