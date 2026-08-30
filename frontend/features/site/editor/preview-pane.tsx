"use client";

import { useEffect, useRef } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { SiteRenderer } from "@/features/site/templates";
import { PreviewFrame } from "./preview-frame";
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
 * And it renders inside an iframe set to a real device width, then scales the
 * result down to fit the pane. The iframe is not decoration: media queries — all
 * a Tailwind `sm:` or `lg:` prefix compiles to — are answered by the viewport,
 * and only an iframe gives the page a viewport of its own. A narrow `div` looks
 * the part while still reporting the desktop width to every breakpoint, which
 * showed the desktop layout squeezed thin and hid the exact problems this pane
 * exists to catch.
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

    // The page now lives in an iframe, so the element is in that document rather
    // than this one. Same-origin, so it can be reached; guarded anyway, because
    // the frame may not have adopted its body yet on the first render.
    const frame = scrollRef.current.querySelector("iframe");
    const view = frame?.contentWindow;
    const target = frame?.contentDocument?.querySelector(
      `[data-site-section="${focusedSection}"]`,
    );

    // A section with nothing written in it is not rendered at all, so there is
    // legitimately nothing to scroll to. Left where it is rather than jumping to
    // the top, which would read as the preview losing its place.
    if (view == null || target == null) {
      return;
    }

    // Scrolled by hand rather than with scrollIntoView, which walks up every
    // scrollable ancestor — and across the frame boundary it found the editor's
    // own panes and scrolled those instead, dragging the preview out of view when
    // all that was wanted was the page inside moving to a section. Telling the
    // frame's own window where to go cannot reach anything outside it.
    view.scrollTo({
      top: target.getBoundingClientRect().top + view.scrollY,
      behavior: "smooth",
    });
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

      {/* The measured pane. Overflow hidden here; the frame inside scrolls its own
          document, so the scaled page stays within these bounds. */}
      <div ref={paneRef} className="relative min-h-0 flex-1 overflow-hidden">
        {isStale && (
          <span className="absolute top-2 right-2 z-10 rounded-full bg-surface/90 px-2 py-0.5 text-2xs text-muted shadow-sm backdrop-blur">
            Updating…
          </span>
        )}

        <div ref={scrollRef}>
          <PreviewFrame
            width={width}
            // Divided by the scale so the shrunken result still fills the pane,
            // rather than ending short of the bottom.
            height={pane.height === 0 ? 0 : pane.height / scale}
            scale={scale}
            title="Website preview"
          >
            <SiteRenderer
              template={template}
              content={content}
              restaurantName={restaurantName}
            />
          </PreviewFrame>
        </div>
      </div>
    </div>
  );
}
