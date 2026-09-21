import type { DesignId } from "@/features/website/designs";
import {
  ARRIVAL_OPTIONS,
  PACE_OPTIONS,
  PHOTO_OPTIONS,
} from "@/features/website/motion";
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
  /** One of a fixed set: how a section arrives, how fast, whether photographs move. */
  | {
      kind: "choice";
      path: ContentPath;
      label: string;
      hint?: string;
      options: { value: string; label: string }[];
    }
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

/**
 * How one section arrives, as a field.
 *
 * Written once and called per section rather than repeated ten times: the label, the
 * hint and the options are the same everywhere, and only the path differs. Ten copies
 * of this would be ten places to change the wording.
 */
function arrival(id: string): Field {
  return {
    kind: "choice",
    path: `motion.sections.${id}`,
    label: "How it arrives",
    hint: "What this band does when it is scrolled into view.",
    options: ARRIVAL_OPTIONS,
  };
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
      {
        kind: "choice",
        path: "motion.photos",
        label: "Large photographs",
        hint: "Whether the hero picture moves very slowly while it is on screen.",
        options: PHOTO_OPTIONS,
      },
      {
        kind: "choice",
        path: "motion.pace",
        label: "Movement speed",
        hint: "Applies to every section on the page, not only this one.",
        options: PACE_OPTIONS,
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
      arrival("accolades"),
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
      arrival("story"),
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
      arrival("menu"),
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
      arrival("spotlight"),
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
      arrival("reasons"),
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
      arrival("gallery"),
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
      arrival("quotes"),
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
      arrival("visit"),
    ],
  },

  {
    id: "closing",
    label: "Closing invitation",
    note: "The last thing on the page before the footer.",
    fields: [
      { kind: "text", path: "closing.title", label: "Heading", max: 70 },
      { kind: "lines", path: "closing.body", label: "One sentence", max: 200 },
      arrival("closing"),
    ],
  },
];

/** Every design's editable sections. Empty until a design's turn comes. */
/**
 * Shared field shapes.
 *
 * The four designs print the same restaurant, so a course, an opening hour and a
 * photograph caption are the same thing in each of them. Written once and called with
 * a path, rather than copied four times, because four copies of "Price, max 12" is
 * four places for a design to quietly disagree with the others about what a price is.
 */
function coursesField(path: ContentPath, hint: string): Field {
  return {
    kind: "list",
    path,
    label: "Courses",
    hint,
    itemLabel: "Course",
    titleKey: "name",
    max: 8,
    blank: { name: "", note: "", lines: [] },
    fields: [
      { kind: "text", path: "name", label: "Course", max: 40 },
      { kind: "text", path: "note", label: "Line underneath", max: 90 },
      {
        kind: "list",
        path: "lines",
        label: "Dishes",
        itemLabel: "Dish",
        titleKey: "name",
        max: 14,
        blank: { name: "", description: "", price: "" },
        fields: [
          { kind: "text", path: "name", label: "Name", max: 60 },
          { kind: "lines", path: "description", label: "Description", max: 140 },
          { kind: "text", path: "price", label: "Price", max: 12 },
        ],
      },
    ],
  };
}

function hoursField(path: ContentPath): Field {
  return {
    kind: "list",
    path,
    label: "Opening hours",
    hint: "One row per pattern. Group the days that match rather than listing seven.",
    itemLabel: "Row",
    titleKey: "days",
    max: 8,
    blank: { days: "", time: "" },
    fields: [
      { kind: "text", path: "days", label: "Days", max: 40 },
      { kind: "text", path: "time", label: "Hours", max: 40 },
    ],
  };
}

function galleryField(path: ContentPath, hint: string): Field {
  return {
    kind: "list",
    path,
    label: "Photographs",
    hint,
    itemLabel: "Photograph",
    titleKey: "caption",
    max: 10,
    blank: { caption: "", photo: "room" },
    fields: [
      { kind: "text", path: "caption", label: "Caption", max: 70 },
      { kind: "photo", path: "photo", label: "Photograph" },
    ],
  };
}

function storyFields(prefix: string, paragraphs: number): Field[] {
  return [
    { kind: "text", path: `${prefix}.title` as ContentPath, label: "Heading", max: 80 },
    {
      kind: "strings",
      path: `${prefix}.body` as ContentPath,
      label: "Paragraphs",
      itemLabel: "Paragraph",
      long: true,
      max: paragraphs,
    },
  ];
}

function privateDiningFields(): Field[] {
  return [
    { kind: "text", path: "privateDining.title", label: "Heading", max: 60 },
    { kind: "lines", path: "privateDining.body", label: "What the room is for", max: 300 },
    {
      kind: "lines",
      path: "privateDining.note",
      label: "The condition",
      hint: "Minimum numbers, notice, a deposit. Every restaurant has one and few say it.",
      max: 160,
    },
  ];
}

function tastingFields(full: boolean): Field[] {
  const fields: Field[] = [
    { kind: "text", path: "tasting.name", label: "Name", max: 60 },
    { kind: "text", path: "tasting.price", label: "Price", max: 12 },
  ];

  // Atrium prints the price beside the carte and nothing else, so offering it a note
  // and a set of terms would be offering a manager two boxes their page will not draw.
  if (full) {
    fields.splice(1, 0, {
      kind: "lines",
      path: "tasting.note",
      label: "What it is",
      max: 300,
    });
    fields.push({
      kind: "lines",
      path: "tasting.terms",
      label: "The condition",
      hint: "Whole table only, allergies in advance, that sort of thing.",
      max: 160,
    });
  }

  return fields;
}

const OPENING_FIELDS: Field[] = [
  {
    kind: "text",
    path: "eyebrow",
    label: "Small line above",
    hint: "When you are open, or what kind of room this is.",
    max: 60,
  },
  { kind: "lines", path: "headline", label: "Headline", max: 90 },
  {
    kind: "lines",
    path: "standfirst",
    label: "Opening sentence",
    hint: "What somebody arriving from a search needs to know first.",
    max: 260,
  },
];

/* -------------------------------------------------------------------------- */
/* Slate                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Slate, in full.
 *
 * A dining room rather than a café: it prints a carte in courses with no photographs
 * at all, carries a wine paragraph and a wall of awards, and gives the chef a band.
 * It has no hero photograph and no dish cards, so neither is offered here.
 */
const SLATE: EditableSection[] = [
  {
    id: "overture",
    label: "Opening",
    note: "The first screen: the name of the restaurant and one sentence under it.",
    fields: [
      {
        kind: "text",
        path: "eyebrow",
        label: "Small line above",
        max: 60,
      },
      {
        kind: "lines",
        path: "standfirst",
        label: "Opening sentence",
        hint: "This design sets it large. One good sentence beats three ordinary ones.",
        max: 260,
      },
    ],
  },
  {
    id: "creed",
    label: "What you stand for",
    note: "The paragraphs that say how this kitchen thinks.",
    fields: storyFields("story", 3),
  },
  {
    id: "carte",
    label: "The carte",
    note: "The menu set in courses, printed rather than photographed.",
    fields: [
      coursesField("courses", "Printed in order, with the lines under each heading."),
      ...tastingFields(true),
    ],
  },
  {
    id: "cellar",
    label: "The cellar",
    note: "A paragraph on the wine, for a list worth mentioning.",
    fields: [
      { kind: "text", path: "cellar.title", label: "Heading", max: 60 },
      { kind: "lines", path: "cellar.body", label: "Paragraph", max: 400 },
    ],
  },
  {
    id: "kitchen",
    label: "The kitchen",
    note: "Who is answerable for the food, and one line in their own words.",
    fields: [
      { kind: "text", path: "chef.name", label: "Name", max: 60 },
      { kind: "text", path: "chef.role", label: "Role", max: 60 },
      { kind: "lines", path: "chef.bio", label: "Biography", max: 400 },
      {
        kind: "lines",
        path: "chef.quote",
        label: "In their own words",
        hint: "Set in quotation marks, large. One sentence.",
        max: 220,
      },
    ],
  },
  {
    id: "laurels",
    label: "Awards",
    note: "Prizes and listings, each with the year attached.",
    fields: [
      {
        kind: "list",
        path: "awards",
        label: "Awards",
        itemLabel: "Award",
        titleKey: "title",
        max: 10,
        blank: { title: "", source: "", year: "" },
        fields: [
          { kind: "text", path: "title", label: "What it was", max: 70 },
          { kind: "text", path: "source", label: "Who gave it", max: 60 },
          { kind: "text", path: "year", label: "Year", max: 12 },
        ],
      },
    ],
  },
  {
    id: "private",
    label: "Private dining",
    note: "What the room is also for.",
    fields: privateDiningFields(),
  },
  {
    id: "visit",
    label: "Opening hours",
    note: "When you are open. The address and telephone come from My restaurant.",
    fields: [hoursField("hours")],
  },
];

const SLATE_DESTINATIONS: Destination[] = [
  { value: "#carte", label: "The carte" },
  { value: "#kitchen", label: "The kitchen" },
  { value: "#private", label: "Private dining" },
  { value: "#visit", label: "Find us and book" },
];

/* -------------------------------------------------------------------------- */
/* Harvest                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Harvest, in full.
 *
 * A neighbourhood restaurant whose argument is continuity: it runs a marquee of
 * accolades, states how long it has been here as figures, and gives the chef a
 * statement band. It prints a carte and a gallery but has no dish cards.
 */
const HARVEST: EditableSection[] = [
  {
    id: "opening",
    label: "Opening",
    note: "The first screen: a headline, one sentence, and the way in.",
    fields: OPENING_FIELDS,
  },
  {
    id: "ticker",
    label: "Accolades marquee",
    note: "The line of prizes that travels across the page.",
    fields: [
      {
        kind: "strings",
        path: "accolades",
        label: "Accolades",
        hint: "Short phrases. The marquee repeats them, so a long one dominates.",
        itemLabel: "Accolade",
        max: 8,
      },
    ],
  },
  {
    id: "larder",
    label: "Your story",
    note: "Who you are, beside the figures that say how long you have been here.",
    fields: [
      ...storyFields("story", 3),
      {
        kind: "list",
        path: "heritage.facts",
        label: "Figures",
        hint: "Three. A number and what it counts — years open, growers, covers a week.",
        itemLabel: "Figure",
        titleKey: "label",
        max: 4,
        blank: { value: "", label: "" },
        fields: [
          { kind: "text", path: "value", label: "Number", max: 12 },
          { kind: "text", path: "label", label: "What it counts", max: 40 },
        ],
      },
    ],
  },
  {
    id: "menu",
    label: "The menu",
    note: "The menu set in courses.",
    fields: [coursesField("courses", "Printed in order, with the lines under each heading.")],
  },
  {
    id: "statement",
    label: "From the kitchen",
    note: "One line from the chef, given a band of its own.",
    fields: [
      { kind: "text", path: "chef.name", label: "Name", max: 60 },
      { kind: "text", path: "chef.role", label: "Role", max: 60 },
      {
        kind: "lines",
        path: "chef.quote",
        label: "In their own words",
        hint: "Set large, in quotation marks. One sentence carries this band.",
        max: 220,
      },
    ],
  },
  {
    id: "gallery",
    label: "Gallery",
    note: "Photographs of the room and the food.",
    fields: [galleryField("gallery", "The first several are shown. Captions are read.")],
  },
  {
    id: "celebrations",
    label: "Celebrations",
    note: "What the room is also for.",
    fields: privateDiningFields(),
  },
  {
    id: "visit",
    label: "Opening hours",
    note: "When you are open. The address and telephone come from My restaurant.",
    fields: [hoursField("hours")],
  },
];

const HARVEST_DESTINATIONS: Destination[] = [
  { value: "#menu", label: "The menu" },
  { value: "#gallery", label: "The gallery" },
  { value: "#celebrations", label: "Celebrations" },
  { value: "#visit", label: "Find us and book" },
];

/* -------------------------------------------------------------------------- */
/* Atrium                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Atrium, in full.
 *
 * Built on chapters: the story, the cellar and the chef are three pinned panels
 * rather than three bands, which is why they are one section here. Editing them
 * separately would mean three panels for one thing a manager thinks of as "the
 * chapters", and the page scrolls them as one.
 */
const ATRIUM: EditableSection[] = [
  {
    id: "opening",
    label: "Opening",
    note: "The first screen: a headline, one sentence, and the figures beneath.",
    fields: [
      ...OPENING_FIELDS,
      {
        kind: "list",
        path: "heritage.facts",
        label: "Figures",
        hint: "Three. A number and what it counts.",
        itemLabel: "Figure",
        titleKey: "label",
        max: 4,
        blank: { value: "", label: "" },
        fields: [
          { kind: "text", path: "value", label: "Number", max: 12 },
          { kind: "text", path: "label", label: "What it counts", max: 40 },
        ],
      },
    ],
  },
  {
    id: "chapters",
    label: "Chapters",
    note: "Three pinned panels — the story, the cellar and the chef — scrolled as one.",
    fields: [
      ...storyFields("story", 3),
      { kind: "text", path: "cellar.title", label: "Cellar heading", max: 60 },
      { kind: "lines", path: "cellar.body", label: "Cellar paragraph", max: 400 },
      { kind: "text", path: "chef.name", label: "Chef", max: 60 },
      { kind: "lines", path: "chef.bio", label: "Biography", max: 400 },
      {
        kind: "lines",
        path: "chef.quote",
        label: "In their own words",
        max: 220,
      },
    ],
  },
  {
    id: "menu",
    label: "The menu",
    note: "The menu set in courses, with the set price beside it.",
    fields: [
      coursesField("courses", "Printed in order, with the lines under each heading."),
      ...tastingFields(false),
    ],
  },
  {
    id: "interlude",
    label: "What guests said",
    note: "Quotations between the menu and the gallery.",
    fields: [
      {
        kind: "list",
        path: "quotes",
        label: "Quotes",
        itemLabel: "Quote",
        titleKey: "author",
        max: 6,
        blank: { quote: "", author: "" },
        fields: [
          { kind: "lines", path: "quote", label: "What they said", max: 240 },
          { kind: "text", path: "author", label: "Who said it", max: 60 },
        ],
      },
    ],
  },
  {
    id: "gallery",
    label: "Gallery",
    note: "Photographs of the room and the food.",
    fields: [galleryField("gallery", "The first several are shown. Captions are read.")],
  },
  {
    id: "visit",
    label: "Opening hours",
    note: "When you are open. The address and telephone come from My restaurant.",
    fields: [hoursField("hours")],
  },
  {
    id: "closing",
    label: "Closing",
    note: "The last band, which states the year you opened.",
    fields: [
      {
        kind: "text",
        path: "heritage.since",
        label: "Here since",
        hint: "A year. It is printed in the footer.",
        max: 12,
      },
    ],
  },
];

const ATRIUM_DESTINATIONS: Destination[] = [
  { value: "#menu", label: "The menu" },
  { value: "#chapters", label: "Our story" },
  { value: "#gallery", label: "The gallery" },
  { value: "#visit", label: "Find us and book" },
];

export const DESTINATIONS: Record<DesignId, Destination[]> = {
  aurora: AURORA_DESTINATIONS,
  slate: SLATE_DESTINATIONS,
  harvest: HARVEST_DESTINATIONS,
  atrium: ATRIUM_DESTINATIONS,
};

export function destinationsFor(design: DesignId): Destination[] {
  return DESTINATIONS[design] ?? [];
}

export const SECTIONS: Record<DesignId, EditableSection[]> = {
  aurora: AURORA,
  slate: SLATE,
  harvest: HARVEST,
  atrium: ATRIUM,
};

/** The sections one design offers, in page order. */
export function sectionsFor(design: DesignId): EditableSection[] {
  return SECTIONS[design] ?? [];
}

/** One section of one design, or nothing. */
export function sectionOf(design: DesignId, id: string): EditableSection | undefined {
  return sectionsFor(design).find((section) => section.id === id);
}
