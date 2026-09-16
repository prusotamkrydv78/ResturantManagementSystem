import type { SampleContent } from "@/features/website/sample-content";

/**
 * Stored content, made safe to render.
 *
 * WHY THIS HAS TO EXIST
 *
 * The server stores a page as opaque JSON and never looks inside it. That is the right
 * decision — it is what lets a design gain a section without a deployment on that side
 * — but it means the templates are the only thing that knows what a page should look
 * like, and they receive whatever happens to be in the column.
 *
 * Which is not always what they expect. A record written by an earlier build is missing
 * whatever has been added since. A record written by an earlier *feature* can be a
 * different shape entirely: the website this replaced stored opening hours as
 * `{ label, value }` and the designs now read `{ days, time }`, so the first page drawn
 * after the migration reached for `row.time.toLowerCase()` and took the whole screen
 * down. A missing field should cost a line of a page, never the page.
 *
 * WHAT IT DOES
 *
 * Walks the sample restaurant and the stored record together, and keeps a stored value
 * only where it is the shape the sample says it should be. Anything else falls back to
 * the sample, which is a working page by construction.
 *
 * A LIST ROW IS ALL OR NOTHING
 *
 * A row missing a field is not a half-written row, it is a row from another schema —
 * so it is dropped rather than patched. Filling its gaps from the sample would put
 * invented words in a manager's menu under their own name, which is worse than
 * dropping it.
 *
 * An emptied list and a rejected one are told apart, and they have to be. A list that
 * arrives empty was emptied on purpose — deleting every accolade is a decision, and
 * refilling it from the sample would undo it on the next reload. A list that arrives
 * full and keeps nothing is foreign data, and leaving a blank band on the page is a
 * worse answer than showing the sample the manager has not replaced yet.
 */
export function conformContent(
  sample: SampleContent,
  stored: unknown,
): SampleContent {
  return conform(sample, stored) as SampleContent;
}

function conform(sample: unknown, stored: unknown): unknown {
  if (Array.isArray(sample)) {
    if (!Array.isArray(stored)) {
      return sample;
    }

    const template = sample[0];

    // A sample list with nothing in it says nothing about its rows, so there is no
    // shape to check against and the stored one is taken as it comes.
    if (template === undefined) {
      return stored;
    }

    const kept = stored.filter((item) => fits(template, item));

    // Everything was rejected, so this list is not this product's. See the note above.
    if (kept.length === 0 && stored.length > 0) {
      return sample;
    }

    return kept.map((item) => conform(template, item));
  }

  if (isRecord(sample)) {
    if (!isRecord(stored)) {
      return sample;
    }

    // Keyed by the sample, so a field the templates no longer draw is dropped rather
    // than carried forward for ever, and one they have gained arrives with a default.
    return Object.fromEntries(
      Object.keys(sample).map((key) => [key, conform(sample[key], stored[key])]),
    );
  }

  return typeof stored === typeof sample ? stored : sample;
}

/** Whether one stored row is the shape the sample's rows are. */
function fits(template: unknown, item: unknown): boolean {
  if (isRecord(template)) {
    return isRecord(item) && Object.keys(template).every((key) => key in item);
  }

  return typeof item === typeof template;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
