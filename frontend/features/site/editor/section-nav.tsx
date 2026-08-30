"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SiteContent, SiteTemplate } from "@/types/site";
import { type SiteFeature, supports } from "@/types/site-capabilities";

/**
 * The list of sections down the page, and which of them have anything in them.
 *
 * A page has eleven editable blocks. Without this the form is a long scroll where
 * the only way to find out whether the gallery is filled in is to reach it, and the
 * only way to reach it is to pass everything else.
 *
 * The tick is the useful part. A manager building a page is repeatedly asking "what
 * have I not done yet", and this answers it from the content itself rather than from
 * a checklist that could disagree with it.
 */

export interface EditorSection {
  /** Matches `data-site-section` in the templates, so the preview can be scrolled. */
  id: string;
  label: string;
  /** The capability a design must declare for this section to be offered at all. */
  feature: SiteFeature;
  /** Whether the manager has put anything in it. */
  isFilled: (content: SiteContent) => boolean;
}

const filled = (value: string | undefined) =>
  typeof value === "string" && value.trim() !== "";

/**
 * Every block of the page, in the order the page renders them.
 *
 * Declared once and shared by the navigator and the form, so a section can never
 * appear in one and not the other.
 */
export const EDITOR_SECTIONS: EditorSection[] = [
  {
    id: "brand",
    label: "Name and tagline",
    feature: "brand",
    isFilled: (c) => filled(c.brand.name) || filled(c.brand.tagline),
  },
  {
    id: "hero",
    label: "Hero",
    feature: "hero",
    isFilled: (c) => filled(c.hero.headline) || filled(c.hero.imageUrl),
  },
  {
    id: "marquee",
    label: "Accolades strip",
    feature: "marquee",
    isFilled: (c) => c.marquee.length > 0,
  },
  {
    id: "about",
    label: "Your story",
    feature: "about",
    isFilled: (c) => filled(c.about.title) || filled(c.about.body),
  },
  {
    id: "chef",
    label: "The kitchen",
    feature: "chef",
    isFilled: (c) => filled(c.chef.name) || filled(c.chef.bio),
  },
  {
    id: "menuGroups",
    label: "Menu by course",
    feature: "menuGroups",
    isFilled: (c) => c.menuGroups.length > 0,
  },
  {
    id: "dishes",
    label: "Signature dishes",
    feature: "dishes",
    isFilled: (c) => c.dishes.length > 0,
  },
  {
    id: "spotlight",
    label: "Dish of the moment",
    feature: "spotlight",
    isFilled: (c) => filled(c.spotlight.name),
  },
  {
    id: "features",
    label: "Why visit",
    feature: "features",
    isFilled: (c) => c.features.length > 0,
  },
  {
    id: "awards",
    label: "Awards",
    feature: "awards",
    isFilled: (c) => c.awards.length > 0,
  },
  {
    id: "gallery",
    label: "Gallery",
    feature: "gallery",
    isFilled: (c) => c.gallery.length > 0,
  },
  {
    id: "testimonials",
    label: "What guests say",
    feature: "testimonials",
    isFilled: (c) => c.testimonials.length > 0,
  },
  {
    id: "events",
    // Neutral on purpose: Slate heads this "Private dining" and Terrace heads it
    // "Celebrations", and the editor label has to name the field for both.
    label: "Events and private dining",
    feature: "events",
    isFilled: (c) => filled(c.events.title) || filled(c.events.body),
  },
  {
    id: "hours",
    label: "Opening hours",
    feature: "hours",
    isFilled: (c) => c.hours.length > 0,
  },
  {
    id: "contact",
    label: "Find us",
    feature: "contact",
    isFilled: (c) =>
      filled(c.contact.addressLine) || filled(c.contact.phone) || filled(c.contact.email),
  },
  {
    id: "cta",
    label: "Closing invitation",
    feature: "cta",
    isFilled: (c) => filled(c.callToAction.title) || filled(c.callToAction.buttonLabel),
  },
  {
    id: "footer",
    label: "Footer",
    feature: "footer",
    isFilled: (c) => filled(c.footer.note) || c.footer.links.length > 0,
  },
  {
    id: "settings",
    label: "Colour and search",
    feature: "seo",
    isFilled: (c) => filled(c.theme.accent) || filled(c.seo.title),
  },
];

/**
 * The sections one design actually offers, in page order.
 *
 * Filtered rather than greyed out. A manager choosing the cafe design has no use for
 * knowing that a chef biography exists somewhere in the product, and a list of
 * disabled rows is a list of things you cannot do.
 */
export function sectionsFor(template: SiteTemplate): EditorSection[] {
  return EDITOR_SECTIONS.filter((section) => supports(template, section.feature));
}

export function SectionNav({
  content,
  template,
  active,
  onSelect,
}: {
  content: SiteContent;
  template: SiteTemplate;
  active: string | null;
  onSelect: (id: string) => void;
}) {
  const offered = sectionsFor(template);
  const done = offered.filter((section) => section.isFilled(content)).length;

  return (
    <nav aria-label="Page sections" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 px-2 pb-1">
        <span className="text-2xs font-semibold tracking-wider text-subtle uppercase">
          Sections
        </span>
        <span className="text-2xs text-subtle tabular-nums">
          {done}/{offered.length}
        </span>
      </div>

      {offered.map((section) => {
        const isFilled = section.isFilled(content);

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={active === section.id ? "true" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active === section.id
                ? "bg-primary-soft font-medium text-primary"
                : "text-muted hover:bg-surface-3 hover:text-text",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                isFilled
                  ? "border-success-border bg-success-soft text-success"
                  : "border-border text-transparent",
              )}
            >
              <Check className="size-2.5" />
            </span>
            <span className="min-w-0 flex-1 truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
