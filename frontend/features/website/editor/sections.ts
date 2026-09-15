import type { DesignId } from "@/features/website/designs";
import type { ContentPath } from "./draft";

/**
 * What a manager can change, per design.
 *
 * THE POINT OF THIS FILE
 *
 * The four designs do not hold the same things and must not offer the same form.
 * Aurora shows dishes as photographed cards and has no chef; Slate prints a carte in
 * courses and carries awards; Harvest runs a marquee; Atrium pins a picture per
 * chapter. An editor built from one list of fields would either offer a manager
 * something their design will never draw, or hide something it does.
 *
 * So the editor is generated from this, and a design's sections are its own. Adding a
 * section is an entry here plus one `Editable` wrapper in the template — no new
 * component, no new panel, no new state.
 *
 * A FIELD IS A LABEL AND A PLACE
 *
 * `path` is a dotted path into the content record and the only address a field has.
 * The panel reads and writes through it, so a field cannot drift from the thing it
 * edits the way a bespoke input and a bespoke setter eventually do.
 */

export type Field =
  /** One line. */
  | { kind: "text"; path: ContentPath; label: string; hint?: string; max?: number }
  /** Several lines, in one box. */
  | { kind: "lines"; path: ContentPath; label: string; hint?: string; max?: number }
  /** One of the plates, chosen from thumbnails. */
  | { kind: "photo"; path: ContentPath; label: string; hint?: string }
  /** Where a button goes: one of this design's own sections. */
  | { kind: "link"; path: ContentPath; label: string; hint?: string }
  /** A list of plain lines: accolades, paragraphs of a story. */
  | {
      kind: "strings";
      path: ContentPath;
      label: string;
      hint?: string;
      itemLabel: string;
      /** Multi-line rows, for paragraphs rather than phrases. */
      long?: boolean;
      max?: number;
    }
  /** A list of records: dishes, quotes, opening hours. */
  | {
      kind: "list";
      path: ContentPath;
      label: string;
      hint?: string;
      itemLabel: string;
      /** Which key names a row in the collapsed header. */
      titleKey: string;
      /** The fields inside one row. Paths here are relative to the row. */
      fields: Field[];
      /** A new, empty row. */
      blank: Record<string, unknown>;
      max?: number;
    };

export interface EditableSection {
  /** Matches the id on the `Editable` wrapper in the template. */
  id: string;
  label: string;
  /** One sentence on what this part of the page is for. */
  note: string;
  fields: Field[];
}

/**
 * Where a button on one design may point.
 *
 * Its own sections and nothing else. A manager pointing a button at a URL they typed
 * is a manager who will eventually point one at a page that no longer exists, and a
 * restaurant's landing page has exactly three places worth sending anybody: the
 * menu, the room, and how to book.
 */
export interface Destination {
  value: string;
  label: string;
}

const AURORA_DESTINATIONS: Destination[] = [
  { value: "#visit", label: "Find us and book" },
  { value: "#menu", label: "The menu" },
  { value: "#gallery", label: "The gallery" },
];

export const DESTINATIONS: Record<DesignId, Destination[]> = {
  aurora: AURORA_DESTINATIONS,
  slate: [],
  harvest: [],
  atrium: [],
};

export function destinationsFor(design: DesignId): Destination[] {
  return DESTINATIONS[design] ?? [];
}

/**
 * Aurora, in full.
 *
 * Ten sections, in the order they appear down the page, so the panel's list and the
 * page a manager is looking at are the same sequence.
 *
 * The address, telephone and email are deliberately absent. They come from the
 * restaurant's own record and are edited under My restaurant — offering them twice
 * would mean two answers to "what is our phone number", and the wrong one would end
 * up on the public page.
 */
const AURORA: EditableSection[] = [
  {
    id: "hero",
    label: "Hero",
    note: "The first screen. A photograph, the name of the restaurant, and one sentence.",
    fields: [
      {
        kind: "text",
        path: "eyebrow",
        label: "Small line above",
        hint: "When you are open, or what kind of room this is.",
        max: 60,
      },
      {
        kind: "lines",
        path: "headline",
        label: "Headline",
        hint: "Set under your restaurant's name. One line is better than two.",
        max: 90,
      },
      {
        kind: "lines",
        path: "standfirst",
        label: "Opening sentence",
        hint: "What somebody arriving from a search needs to know first.",
        max: 260,
      },
      { kind: "text", path: "actions.primary", label: "Main button", max: 28 },
      { kind: "link", path: "actions.primaryHref", label: "Main button goes to" },
      { kind: "text", path: "actions.secondary", label: "Second button", max: 28 },
      { kind: "link", path: "actions.secondaryHref", label: "Second button goes to" },
      {
        kind: "photo",
        path: "heroPhoto",
        label: "Leading photograph",
        hint: "The first of the four the hero fades between.",
      },
    ],
  },

  {
    id: "accolades",
    label: "Accolades strip",
    note: "The quiet line of prizes and listings under the hero.",
    fields: [
      {
        kind: "strings",
        path: "accolades",
        label: "Accolades",
        hint: "Four or fewer. Anything longer stops being read.",
        itemLabel: "Accolade",
        max: 6,
      },
    ],
  },

  {
    id: "story",
    label: "Your story",
    note: "Who you are and why, beside a photograph of the room.",
    fields: [
      { kind: "text", path: "story.title", label: "Heading", max: 80 },
      {
        kind: "strings",
        path: "story.body",
        label: "Paragraphs",
        hint: "Two is usually right. Three is the most this design will carry well.",
        itemLabel: "Paragraph",
        long: true,
        max: 3,
      },
    ],
  },

  {
    id: "menu",
    label: "Signature dishes",
    note: "Four dishes as photographed cards. This design shows food rather than listing it.",
    fields: [
      {
        kind: "list",
        path: "dishes",
        label: "Dishes",
        hint: "Four fill the row exactly. Fewer leaves a gap; more wraps.",
        itemLabel: "Dish",
        titleKey: "name",
        max: 8,
        blank: { name: "", description: "", price: "", photo: "plated" },
        fields: [
          { kind: "text", path: "name", label: "Name", max: 48 },
          { kind: "lines", path: "description", label: "Description", max: 120 },
          { kind: "text", path: "price", label: "Price", max: 12 },
          { kind: "photo", path: "photo", label: "Photograph" },
        ],
      },
    ],
  },

  {
    id: "spotlight",
    label: "Dish of the moment",
    note: "One dish given a band of its own, with the largest photograph on the page.",
    fields: [
      { kind: "text", path: "spotlight.eyebrow", label: "Small line above", max: 32 },
      { kind: "text", path: "spotlight.name", label: "Dish", max: 60 },
      {
        kind: "lines",
        path: "spotlight.description",
        label: "Description",
        hint: "Longer than a menu line. This one has room to make a case.",
        max: 340,
      },
      { kind: "text", path: "spotlight.price", label: "Price", max: 12 },
      { kind: "photo", path: "spotlight.photo", label: "Photograph" },
    ],
  },

  {
    id: "reasons",
    label: "Why visit",
    note: "Three short reasons, on the dark band.",
    fields: [
      {
        kind: "list",
        path: "reasons",
        label: "Reasons",
        hint: "Three. The band is built for three.",
        itemLabel: "Reason",
        titleKey: "title",
        max: 4,
        blank: { title: "", body: "" },
        fields: [
          { kind: "text", path: "title", label: "Heading", max: 40 },
          { kind: "lines", path: "body", label: "One sentence", max: 120 },
        ],
      },
    ],
  },

  {
    id: "gallery",
    label: "Gallery",
    note: "The room and the food. The first picture takes twice the space of the others.",
    fields: [
      {
        kind: "list",
        path: "gallery",
        label: "Photographs",
        hint: "Five fills the mosaic. The first is the large one.",
        itemLabel: "Photograph",
        titleKey: "caption",
        max: 8,
        blank: { caption: "", photo: "room" },
        fields: [
          {
            kind: "text",
            path: "caption",
            label: "Caption",
            hint: "Shown on hover, and read aloud to anybody using a screen reader.",
            max: 60,
          },
          { kind: "photo", path: "photo", label: "Photograph" },
        ],
      },
    ],
  },

  {
    id: "quotes",
    label: "What guests say",
    note: "Two quotations. A wall of praise reads as advertising and gets skipped.",
    fields: [
      {
        kind: "list",
        path: "quotes",
        label: "Quotations",
        itemLabel: "Quotation",
        titleKey: "author",
        max: 4,
        blank: { quote: "", author: "" },
        fields: [
          { kind: "lines", path: "quote", label: "What they said", max: 240 },
          { kind: "text", path: "author", label: "Who said it", max: 48 },
        ],
      },
    ],
  },

  {
    id: "visit",
    label: "Opening hours",
    note: "Your address, telephone and email come from My restaurant. Only the hours are written here.",
    fields: [
      {
        kind: "list",
        path: "hours",
        label: "Hours",
        hint: "One line per group of days. Say when you are closed as well.",
        itemLabel: "Line",
        titleKey: "days",
        max: 8,
        blank: { days: "", time: "" },
        fields: [
          { kind: "text", path: "days", label: "Days", max: 40 },
          { kind: "text", path: "time", label: "Hours", max: 32 },
        ],
      },
    ],
  },

  {
    id: "closing",
    label: "Closing invitation",
    note: "The last thing on the page before the footer.",
    fields: [
      { kind: "text", path: "closing.title", label: "Heading", max: 70 },
      { kind: "lines", path: "closing.body", label: "One sentence", max: 200 },
    ],
  },
];

/** Every design's editable sections. Empty until a design's turn comes. */
export const SECTIONS: Record<DesignId, EditableSection[]> = {
  aurora: AURORA,
  slate: [],
  harvest: [],
  atrium: [],
};

/** The sections one design offers, in page order. */
export function sectionsFor(design: DesignId): EditableSection[] {
  return SECTIONS[design] ?? [];
}

/** One section of one design, or nothing. */
export function sectionOf(design: DesignId, id: string): EditableSection | undefined {
  return sectionsFor(design).find((section) => section.id === id);
}
