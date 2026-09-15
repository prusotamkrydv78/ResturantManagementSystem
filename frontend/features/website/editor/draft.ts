"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";

/**
 * What a manager has written, before anything is published.
 *
 * WHERE IT LIVES, AND WHY THAT IS TEMPORARY
 *
 * This browser, keyed by restaurant. The site service was taken out to be rebuilt, so
 * there is nowhere on the server to put a draft yet — and an editor whose work
 * vanishes on refresh is not an editor, it is a demonstration of one. Local storage is
 * the honest middle: the work survives, and every screen that shows it says plainly
 * that it has not left this device.
 *
 * The shape is deliberately the one the server will take: a whole content record,
 * written whole and read whole. When the API returns, `load` and `save` below become
 * two fetches and nothing else in the editor changes.
 *
 * WHY A PATH RATHER THAN A SETTER PER FIELD
 *
 * A section editor is generated from a list of fields, and a field is a label and a
 * place in the record. Giving each one its own setter would mean the field list and
 * the setters were two descriptions of the same thing, free to disagree. One `patch`
 * that takes "hero.headline" keeps it to one.
 */

const KEY_PREFIX = "rms.site.draft.";

/** A dotted path into the content record, as written in a field definition. */
export type ContentPath = string;

export interface SiteDraft {
  content: SampleContent;
  /** Writes one field. The path is the same string the field list uses. */
  patch: (path: ContentPath, value: unknown) => void;
  /** True once anything differs from the sample the draft started as. */
  isEdited: boolean;
  /** Throws the draft away and returns to the sample restaurant. */
  reset: () => void;
  /** False until local storage has been read, so the first paint matches the server. */
  isReady: boolean;
}

export function useSiteDraft(slug: string): SiteDraft {
  const sample = useMemo(() => sampleContent(), []);
  const [content, setContent] = useState<SampleContent>(sample);
  const [isReady, setIsReady] = useState(false);

  const storageKey = `${KEY_PREFIX}${slug}`;

  // Read after mount rather than during render: the server has no local storage, and
  // reading it while rendering would make the first client paint disagree with the
  // markup React sent.
  useEffect(() => {
    let cancelled = false;

    const read = () => {
      if (cancelled) {
        return;
      }

      try {
        const stored = window.localStorage.getItem(storageKey);

        if (stored !== null) {
          // Merged over the sample rather than used as-is. A draft written by an
          // earlier build is missing whatever has been added since, and a template
          // reading an absent field would take the page down rather than fall back.
          setContent({ ...sample, ...(JSON.parse(stored) as Partial<SampleContent>) });
        }
      } catch {
        // Unreadable or unparseable. The sample stands, which is a working page.
      }

      setIsReady(true);
    };

    const timer = setTimeout(read, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storageKey, sample]);

  const patch = useCallback(
    (path: ContentPath, value: unknown) => {
      setContent((current) => {
        const next = writeAt(current, path, value);

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage full or blocked. The edit still applies to the page in front of
          // them; it simply will not survive a reload, and the editor says so.
        }

        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing to clear, or storage unavailable. The state reset below is what matters.
    }

    setContent(sample);
  }, [storageKey, sample]);

  const isEdited = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(sample),
    [content, sample],
  );

  return { content, patch, isEdited, reset, isReady };
}

/** Reads a dotted path out of the content record. */
export function readAt(content: SampleContent, path: ContentPath): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value === null || typeof value !== "object"
          ? undefined
          : (value as Record<string, unknown>)[key],
      content,
    );
}

/**
 * Returns the content with one path replaced, copying only the spine down to it.
 *
 * Copied rather than mutated because React decides whether to re-render by identity,
 * and copied only along the path because the rest of the record is unchanged and
 * cloning a page of text on every keystroke is work nobody asked for.
 */
function writeAt(
  content: SampleContent,
  path: ContentPath,
  value: unknown,
): SampleContent {
  const keys = path.split(".");

  const walk = (node: unknown, depth: number): unknown => {
    if (depth === keys.length) {
      return value;
    }

    const key = keys[depth] as string;
    const base =
      node !== null && typeof node === "object" ? (node as Record<string, unknown>) : {};

    return { ...base, [key]: walk(base[key], depth + 1) };
  };

  return walk(content, 0) as SampleContent;
}
