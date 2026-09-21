import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { DESIGNS } from "@/features/website/designs";
import { destinationsFor, sectionsFor } from "@/features/website/editor/sections";

/**
 * Every design is editable, and every section it declares actually exists.
 *
 * An editor section and the band it edits are two halves of the same thing held in
 * two files, and nothing in the type system connects them. A section declared with no
 * `Editable` wrapper is a row in the panel that scrolls nowhere; a wrapper with no
 * section is a band a manager can see highlighted and cannot change. Both are silent.
 *
 * Read out of the template source rather than by rendering it, because rendering a
 * design needs a restaurant, a content record and a motion provider, and this is a
 * question about two lists.
 */
describe("website editor sections", () => {
  const ids = new Map(
    DESIGNS.map((design) => {
      const source = readFileSync(
        `features/website/templates/${design.id}.tsx`,
        "utf8",
      );

      return [
        design.id,
        [...source.matchAll(/<Editable\s+id="([a-z-]+)"/g)]
          .map((match) => match[1])
          .filter((id): id is string => id !== undefined)
          .sort(),
      ] as const;
    }),
  );

  it.each(DESIGNS.map((design) => design.id))("%s is editable at all", (design) => {
    expect(sectionsFor(design).length).toBeGreaterThan(0);
    expect(ids.get(design)?.length).toBeGreaterThan(0);
  });

  it.each(DESIGNS.map((design) => design.id))(
    "%s declares exactly the sections its template wraps",
    (design) => {
      const declared = sectionsFor(design)
        .map((section) => section.id)
        .sort();

      expect(declared).toEqual(ids.get(design));
    },
  );

  it.each(DESIGNS.map((design) => design.id))(
    "%s only points buttons at its own sections",
    (design) => {
      // Checked against the declared sections rather than by scraping the template
      // for an id attribute: a design is free to render its anchor through a
      // component - Aurora sets them on a shared Band - and a test that insists on
      // a literal attribute is testing how the markup is written, not whether the
      // button goes anywhere.
      const declared = new Set(sectionsFor(design).map((section) => section.id));

      for (const destination of destinationsFor(design)) {
        expect(declared).toContain(destination.value.replace("#", ""));
      }
    },
  );
});
