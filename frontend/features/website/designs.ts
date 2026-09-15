/**
 * The website designs on offer, as data.
 *
 * Declared once here rather than written into the page that lists them, for the same
 * reason navigation is: the moment a second screen needs to name a design — a picker,
 * a preview, the editor's own header — a list written inside one component becomes a
 * list written inside two.
 *
 * Nothing in this file talks to the server yet. The designs are a product decision
 * before they are a stored value, and the catalogue is worth settling while it is
 * still only a catalogue.
 */

/** Which design, as it will be stored. */
export type DesignId = "aurora" | "slate" | "harvest" | "atrium";

/**
 * The shape of a design's page, abstracted enough to draw.
 *
 * A card needs to show what it is offering, and there are no built templates to
 * photograph. A sketch is the honest middle: it says how the page is composed —
 * where the picture is, how the sections run — without pretending to be a
 * screenshot of something that does not exist.
 */
export type DesignSketch = "gallery" | "editorial" | "poster" | "split";

/** How the page reads: which ground it sits on and how loud its type is. */
export type DesignMood = "light" | "dark" | "paper";

/**
 * The four colours a card needs to look like the page it is advertising.
 *
 * Held here rather than read out of the template, because three of the four templates
 * do not exist yet and a card has to be able to show a design before there is code to
 * take the colours from. For Aurora these are the values the built page actually
 * uses; when the others are drawn, theirs come here first and the template follows.
 */
export interface DesignPalette {
  /** The ground most of the page sits on. */
  page: string;
  /** Body copy and headings. */
  ink: string;
  /** The one colour that is not neutral. */
  accent: string;
  /** The contrasting band: a dark section on a pale page, or the reverse. */
  band: string;
}

export interface Design {
  id: DesignId;
  name: string;
  /** Five or six words. The card's subtitle. */
  tagline: string;
  /** Two sentences at most: what it does, and what it refuses to do. */
  description: string;
  /** The kind of restaurant this is the right answer for. */
  suitedTo: string;
  /** What this design carries that the others may not. */
  carries: string[];
  sketch: DesignSketch;
  mood: DesignMood;
  palette: DesignPalette;
  /**
   * Whether the page itself has been drawn.
   *
   * Catalogued and built are two different things, and the gallery has to be able to
   * tell them apart: a card that offers a preview of something nobody has written
   * yet is a promise the next click breaks.
   */
  isBuilt: boolean;
}

/**
 * The four designs.
 *
 * Deliberately uneven, and no design is a superset of another. A template that does
 * everything is a template with no opinion, and the point of offering four is that a
 * manager picks the one that matches the restaurant they actually run.
 */
export const DESIGNS: Design[] = [
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Photographs first",
    description:
      "Dishes as cards, one of them pushed forward, and a gallery underneath. This is the design for a restaurant whose food is the argument.",
    suitedTo: "Cafés, bistros, anywhere the plates sell the room",
    carries: ["Dish cards", "Gallery", "Dish of the moment", "Why visit"],
    sketch: "gallery",
    mood: "light",
    // The values the built page uses. See templates/aurora.tsx.
    palette: { page: "#faf6f1", ink: "#181310", accent: "#b8543a", band: "#141010" },
    isBuilt: true,
  },
  {
    id: "slate",
    name: "Slate",
    tagline: "Dark, and led by type",
    description:
      "The full dining-room page: a menu in courses, the chef, the awards. It argues in writing, and uses pictures only as punctuation.",
    suitedTo: "Dining rooms, tasting menus, anywhere the menu is the draw",
    carries: ["Menu by course", "The kitchen", "Awards", "Private dining"],
    sketch: "editorial",
    mood: "dark",
    // The values the built page uses. See templates/slate.tsx.
    palette: { page: "#141312", ink: "#f2ede6", accent: "#b9a06a", band: "#1b1a18" },
    isBuilt: true,
  },
  {
    id: "harvest",
    name: "Harvest",
    tagline: "Loud, bright and confident",
    description:
      "Oversized type set against the pictures rather than under them, a running strip of accolades, and one section blocked out in solid colour. The design for a room with an opinion.",
    suitedTo: "Bistros, wine bars, anywhere with more personality than silverware",
    carries: ["Menu by course", "The kitchen", "Gallery", "Celebrations"],
    sketch: "poster",
    mood: "paper",
    // The values the built page uses. See templates/harvest.tsx.
    palette: { page: "#f4f1e8", ink: "#1b1a16", accent: "#4f5d3a", band: "#4f5d3a" },
    isBuilt: true,
  },
  {
    id: "atrium",
    name: "Atrium",
    tagline: "Half picture, half page",
    description:
      "A photograph pinned to the screen while the writing moves past it, changing as each part arrives. Deep navy and brass, and the most photography of the four.",
    suitedTo: "Hotel dining rooms, chef's counters, anywhere the room is the draw",
    carries: ["Menu by course", "The kitchen", "The cellar", "Gallery"],
    sketch: "split",
    mood: "light",
    // The values the built page uses. See templates/atrium.tsx.
    palette: { page: "#f6f3ed", ink: "#16202a", accent: "#c08a4e", band: "#1b2c3c" },
    isBuilt: true,
  },
];

/** One design by id, or nothing. Used wherever a stored value has to be resolved. */
export function designById(id: string): Design | undefined {
  return DESIGNS.find((design) => design.id === id);
}
