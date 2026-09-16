/**
 * The words a restaurant has not written yet.
 *
 * Everything a design needs that the restaurant profile does not hold: a headline, a
 * menu, opening hours, what guests have said. The profile carries a name, an address
 * and two contact details, and a landing page needs rather more than that before it
 * can be judged.
 *
 * This is sample copy, not a default. It exists so a manager can look at a design and
 * see a finished page instead of a wireframe with their own name in the corner — and
 * every screen that shows it says so, because a page that quietly presented invented
 * dishes as the restaurant's own would be worse than an empty one.
 *
 * Written properly rather than filled with lorem ipsum. A design is judged on how it
 * handles real sentences of real length, and placeholder latin flatters every layout
 * equally.
 */

import type { PageMotion } from "./motion";
import type { PhotoRef } from "./photos";

export interface SampleDish {
  name: string;
  description: string;
  price: string;
  photo: PhotoRef;
}

/** One line on a printed menu. No picture: a bill of fare is read, not browsed. */
export interface SampleMenuLine {
  name: string;
  description: string;
  price: string;
}

/**
 * A course, and what is on it.
 *
 * Kept apart from the flat `dishes` list rather than replacing it, because the two
 * answer different designs. A café wants four cards with photographs; a dining room
 * wants Starters, Mains and Desserts with a dozen lines under them and no pictures at
 * all. One sample restaurant, written both ways, so the designs can be compared on
 * how they present the same kitchen.
 */
export interface SampleCourse {
  name: string;
  /** A line under the course heading, or blank. */
  note: string;
  lines: SampleMenuLine[];
}

export interface SampleContent {
  eyebrow: string;
  headline: string;
  standfirst: string;
  /** What the two buttons under the opening say, and where each one goes. */
  actions: {
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
  };
  /** Which plate leads the hero. The rest of the set follows it. */
  heroPhoto: PhotoRef;
  /** How the page moves: what each section does on arrival, and how fast. */
  motion: PageMotion;
  accolades: string[];
  story: { title: string; body: string[] };
  dishes: SampleDish[];
  spotlight: {
    eyebrow: string;
    name: string;
    description: string;
    price: string;
    photo: PhotoRef;
  };
  reasons: { title: string; body: string }[];
  gallery: { caption: string; photo: PhotoRef }[];
  hours: { days: string; time: string }[];
  quotes: { quote: string; author: string }[];
  closing: { title: string; body: string };
  /** The menu set as courses, for the designs that print one. */
  courses: SampleCourse[];
  /** The set menu offered alongside the carte. */
  tasting: {
    name: string;
    note: string;
    price: string;
    /** The condition attached to it, which every restaurant has and few say plainly. */
    terms: string;
  };
  /** The wine, because a page that wins an award for its list should mention it. */
  cellar: { title: string; body: string };
  /**
   * How long it has been here, and what it is.
   *
   * For the designs whose argument is continuity rather than novelty. A neighbourhood
   * restaurant sells the fact that it was here last year and will be here next year,
   * which is the one thing a new place cannot claim.
   */
  heritage: {
    since: string;
    line: string;
    facts: { value: string; label: string }[];
  };
  /** The person answerable for the kitchen. */
  chef: { name: string; role: string; bio: string; quote: string };
  /** Prizes and listings, with the year attached. */
  awards: { title: string; source: string; year: string }[];
  /** What the room is also for. */
  privateDining: { title: string; body: string; note: string };
}

export function sampleContent(): SampleContent {
  return {
    eyebrow: "Dinner, Tuesday to Sunday",
    headline: "Cooked over fire, eaten without hurry",
    standfirst:
      "A twelve-table room where the menu is written after the delivery rather than before it. Nothing reaches the plate that does not need to be there.",

    actions: {
      primary: "Reserve a table",
      primaryHref: "#visit",
      secondary: "Read the menu",
      secondaryHref: "#menu",
    },
    heroPhoto: "room",

    // Everything rises, unhurriedly, and the hero photograph drifts. A page where
    // each band entered a different way would read as restless rather than designed,
    // so the sample sets them all the same and leaves a manager to break the pattern
    // deliberately if they want to.
    motion: {
      photos: "drift",
      pace: "calm",
      sections: {
        accolades: "fade",
        story: "rise",
        menu: "rise",
        spotlight: "rise",
        reasons: "fade",
        gallery: "rise",
        quotes: "fade",
        visit: "rise",
        closing: "fade",
      },
    },

    accolades: [
      "Two rosettes, four years running",
      "Top 50 regional dining",
      "Best wine list — city awards",
      "Sustainable kitchen certified",
    ],

    story: {
      title: "A short menu, cooked properly",
      body: [
        "We buy from four farms and one boat, and we write the menu after the delivery rather than before it. That means we cannot promise you a dish three weeks out, and it means everything we serve was chosen that morning by somebody who is going to cook it.",
        "There is one sitting a night. The table is yours until you want it back, and nobody will bring you a bill you have not asked for.",
      ],
    },

    dishes: [
      {
        name: "Fire-roast aubergine",
        description: "Burnt onion, walnut, aged yoghurt, a great deal of olive oil.",
        price: "420",
        photo: "greens",
      },
      {
        name: "Day boat turbot",
        description: "On the bone, brown butter, capers, and whatever herb is best today.",
        price: "1,150",
        photo: "plated",
      },
      {
        name: "Dry-aged sirloin",
        description: "Forty-five days, over coals, bone marrow and watercress.",
        price: "1,480",
        photo: "fire",
      },
      {
        name: "Burnt honey tart",
        description: "Crème fraîche, and a little more honey than is sensible.",
        price: "380",
        photo: "dessert",
      },
    ],

    spotlight: {
      eyebrow: "This week",
      name: "Whole roast cauliflower",
      description:
        "Charred over coals until it collapses, then green chilli, curry leaf and lime. It arrives whole, it is meant to be pulled apart at the table, and it regularly feeds three people who came in wanting steak.",
      price: "680",
      photo: "greens",
    },

    reasons: [
      {
        title: "One sitting a night",
        body: "Your table is yours from the moment you sit down until you decide to leave.",
      },
      {
        title: "Written after the delivery",
        body: "The menu changes most days, because the market does.",
      },
      {
        title: "Everything over fire",
        body: "One hearth, no gas, and somebody watching it for the whole service.",
      },
    ],

    gallery: [
      { caption: "The room, before service", photo: "room" },
      { caption: "Turbot, on the bone", photo: "plated" },
      { caption: "The pass at seven", photo: "pass" },
      { caption: "Straight off the coals", photo: "fire" },
      { caption: "Table four, the good one", photo: "wine" },
    ],

    hours: [
      { days: "Tuesday – Thursday", time: "6pm – 10pm" },
      { days: "Friday – Saturday", time: "6pm – 11pm" },
      { days: "Sunday", time: "12pm – 4pm" },
      { days: "Monday", time: "Closed" },
    ],

    quotes: [
      {
        quote:
          "The shortest menu in the city, and the only one I have never had to think about. Four things, all of them the thing you wanted.",
        author: "Regional dining guide",
      },
      {
        quote:
          "We asked for a table at eight and were still there at midnight. Nobody once looked at us as though we should go.",
        author: "Priya M.",
      },
    ],

    closing: {
      title: "The fire is lit at four",
      body: "Dinner from six, Tuesday to Sunday. Twelve tables, so it is worth booking ahead.",
    },

    courses: [
      {
        name: "To begin",
        note: "Small plates, meant for the middle of the table",
        lines: [
          {
            name: "Warm flatbread, cultured butter",
            description: "Baked to order. Ask for a second one.",
            price: "180",
          },
          {
            name: "Fire-roast aubergine",
            description: "Burnt onion, walnut, aged yoghurt.",
            price: "420",
          },
          {
            name: "Cured trout",
            description: "Beetroot, horseradish, dill oil.",
            price: "540",
          },
          {
            name: "Hand-cut steak tartare",
            description: "Egg yolk, capers, toasted rye.",
            price: "620",
          },
        ],
      },
      {
        name: "Over the coals",
        note: "The fire is lit at four. Everything below meets it",
        lines: [
          {
            name: "Whole roast cauliflower",
            description: "Green chilli, curry leaf, lime. For the table.",
            price: "680",
          },
          {
            name: "Day boat turbot",
            description: "On the bone, brown butter, capers.",
            price: "1,150",
          },
          {
            name: "Dry-aged sirloin",
            description: "Forty-five days, bone marrow, watercress.",
            price: "1,480",
          },
          {
            name: "Hogget shoulder",
            description: "Four hours over embers, for two or three.",
            price: "2,200",
          },
        ],
      },
      {
        name: "To finish",
        note: "",
        lines: [
          {
            name: "Burnt honey tart",
            description: "Crème fraîche.",
            price: "380",
          },
          {
            name: "Chocolate, olive oil, salt",
            description: "Three ingredients, one of them very good.",
            price: "360",
          },
          {
            name: "Cheese, three ways",
            description: "From the counter, with quince and oat biscuits.",
            price: "520",
          },
        ],
      },
    ],

    tasting: {
      name: "The kitchen's menu",
      note: "Seven courses, written that afternoon, served to the whole table. It is the best thing we do and the only way to eat everything at once.",
      price: "3,600",
      terms: "Per person, whole table only. Please ask when you book.",
    },

    cellar: {
      title: "A short list, read properly",
      body: "Ninety bins, most of them from growers we have met, and nothing on the list that somebody here cannot tell you about. There is a page of things by the glass so that a table of two is not made to commit to a bottle before the food arrives.",
    },

    heritage: {
      since: "1988",
      line: "Three generations, one room, and the same six tables by the window.",
      facts: [
        { value: "1988", label: "Opened" },
        { value: "28", label: "Seats" },
        { value: "One", label: "Sitting a night" },
        { value: "Four", label: "Farms we buy from" },
      ],
    },

    chef: {
      name: "Anita Rai",
      role: "Chef proprietor",
      bio: "Anita opened this room after eleven years in other people's kitchens, most of them larger and none of them quieter. She writes the menu each afternoon, works the pass every service, and will come out and tell you what is good tonight if you ask her.",
      quote: "If a dish needs three things, it gets three things. Not five.",
    },

    awards: [
      { title: "Two rosettes", source: "National dining guide", year: "2025" },
      { title: "Top 50 regional restaurants", source: "The Observer", year: "2024" },
      { title: "Best wine list", source: "City food awards", year: "2024" },
      { title: "Sustainable kitchen", source: "Green Table", year: "2023" },
    ],

    privateDining: {
      title: "The whole room, yours",
      body: "Twenty-eight seated or forty standing, with a set menu written around what you would like to drink. We do about one of these a fortnight, so it is worth asking early.",
      note: "Minimum spend applies on Fridays and Saturdays.",
    },
  };
}
