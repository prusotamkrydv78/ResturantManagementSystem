import { mediaIdOf } from "@/features/website/photos";

/**
 * Which pictures the page in front of you is actually using.
 *
 * WHY THE EDITOR HAS TO BE THE ONE THAT KNOWS
 *
 * The server stores a page as opaque JSON and never looks inside it, which is what
 * lets a design gain a section without a deployment on that side. The price of that
 * decision is that nothing on the server can answer "is this picture on a page" — it
 * does not know what a page is made of. Deleting a picture is therefore a request it
 * has to take at face value.
 *
 * The editor is holding the whole content record, so it can answer. Which makes this
 * the only place the warning can live, and means the warning has to live here: without
 * it a manager deletes what looks like a spare photograph and their hero quietly
 * becomes a gradient, with nothing on screen having suggested that was about to happen.
 *
 * It is a warning and not a prohibition. A manager who wants a picture gone knows
 * things this code does not, and the page is a draft that has not been published until
 * they say so.
 */
export function mediaIdsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    const id = mediaIdOf(value);

    if (id !== null) {
      found.add(id);
    }

    return found;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      mediaIdsIn(item, found);
    }

    return found;
  }

  // Every photograph slot in every design is a string somewhere in this record, and
  // the designs decide where. Walking the whole thing rather than reading known paths
  // is what keeps this correct when a design gains a section.
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      mediaIdsIn(item, found);
    }
  }

  return found;
}
