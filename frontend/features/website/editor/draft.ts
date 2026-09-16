"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSite, saveSiteDraft, setSitePublished, type Site } from "@/features/website/api";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";
import { conformContent } from "./conform";
import type { DesignId } from "@/features/website/designs";

/**
 * What a manager has written, and where it is kept.
 *
 * ON THE SERVER
 *
 * The first version of this put the draft in local storage, because the site service
 * had been taken out and there was nowhere else. That was honest but it was not a
 * feature: a draft in local storage lives in one browser profile on one machine, under
 * one origin, and disappears when somebody clears their site data or visits by
 * 127.0.0.1 instead of localhost. It is scratch paper presented as saved work. It is a
 * row now.
 *
 * SAVED WHEN ASKED, NOT AS YOU TYPE
 *
 * This wrote after every pause at first, on the argument that a Save button makes
 * somebody hold a change in their head between typing it and seeing it. That argument
 * was wrong here, for a reason the live preview creates rather than removes: what a
 * manager types is already on the page in front of them, so nothing is being held in
 * the head at all. What autosaving actually did was write to the server on every
 * sentence and take the decision about when a change becomes real away from the person
 * making it.
 *
 * So editing is local and Save is a button. The page still updates on every keystroke —
 * that was never the same question.
 *
 * SAVING IS STILL NOT PUBLISHING
 *
 * Save writes the draft column and nothing else. The public copy only moves when
 * Publish is pressed, so editing a live page remains safe.
 */

/** A dotted path into the content record, as written in a field definition. */
export type ContentPath = string;

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export interface SiteDraft {
  /** The page, with anything unwritten filled in from the sample restaurant. */
  content: SampleContent;
  /** Changes one field, in this browser only, until Save is pressed. */
  patch: (path: ContentPath, value: unknown) => void;
  /** The record as the server holds it, for publication state. Null until loaded. */
  site: Site | null;
  /** Whether the manager has written anything at all, or is still seeing the sample. */
  hasOwnContent: boolean;
  /** Whether anything on screen differs from what the server holds. */
  isDirty: boolean;
  status: SaveStatus;
  /** Set when loading failed outright, as opposed to a save failing. */
  loadError: string | null;
  saveError: string | null;
  isReady: boolean;
  /** Writes the draft. */
  save: () => Promise<void>;
  /** Throws away unsaved changes and goes back to the last saved version. */
  discard: () => void;
  /** Goes back to the sample restaurant. Unsaved, like any other change. */
  reset: () => void;
  /** Publishes the draft, saving first if there is anything to save. */
  publish: (next: boolean) => Promise<void>;
  reload: () => void;
}

export function useSiteDraft(design: DesignId): SiteDraft {
  const sample = useMemo(() => sampleContent(), []);

  /** What is on screen. */
  const [stored, setStored] = useState<Partial<SampleContent>>({});
  /** What the server last confirmed, so unsaved changes can be thrown away. */
  const [saved, setSaved] = useState<Partial<SampleContent>>({});

  const [site, setSite] = useState<Site | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Read at the moment of a write rather than closed over, so Save always sends the
  // design being looked at and the content as it stands. Assigned in an effect: a ref
  // written during render is a value React has not agreed to re-render for.
  const latest = useRef({ design, stored });

  useEffect(() => {
    latest.current = { design, stored };
  }, [design, stored]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getSite();

        if (cancelled) return;

        const content = loaded.content ?? {};

        setSite(loaded);
        setStored(content);
        setSaved(content);
        setIsDirty(false);
        setLoadError(null);
      } catch (caught) {
        if (cancelled) return;

        setLoadError(
          caught instanceof Error ? caught.message : "Unable to load your page.",
        );
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const patch = useCallback((path: ContentPath, value: unknown) => {
    setStored((current) =>
      writeAt(conformContent(sampleContent(), current), path, value),
    );
    setIsDirty(true);
    // Clears a "Saved" badge left over from the last write, which would otherwise sit
    // there claiming something about work that has since moved on.
    setStatus("idle");
  }, []);

  const save = useCallback(async () => {
    const { design: chosen, stored: current } = latest.current;

    setStatus("saving");

    try {
      // The design goes with the content. Editing a page while looking at a design is
      // what chooses it — which is also why merely opening one saves nothing.
      const result = await saveSiteDraft(
        chosen,
        conformContent(sampleContent(), current),
      );

      setSite(result);
      setSaved(current);
      setIsDirty(false);
      setSaveError(null);
      setStatus("saved");
    } catch (caught) {
      // The edit is still on the page and still unsaved. Nothing is lost; the button
      // simply stays available.
      setSaveError(
        caught instanceof Error ? caught.message : "Could not save your page.",
      );
      setStatus("failed");
    }
  }, []);

  const discard = useCallback(() => {
    setStored(saved);
    setIsDirty(false);
    setStatus("idle");
    setSaveError(null);
  }, [saved]);

  const reset = useCallback(() => {
    // Unsaved like any other change, so it can be thought better of before it counts.
    setStored({});
    setIsDirty(true);
    setStatus("idle");
  }, []);

  const publish = useCallback(
    async (next: boolean) => {
      // Anything unsaved goes first, or Publish would put the last saved version in
      // front of the public rather than the one on screen.
      if (isDirty) {
        await save();
      }

      try {
        setSite(await setSitePublished(next));
        setSaveError(null);
      } catch (caught) {
        setSaveError(
          caught instanceof Error
            ? caught.message
            : "Could not change whether the page is public.",
        );
      }
    },
    [isDirty, save],
  );

  // Now that a change can sit unsaved indefinitely, this is the backstop that matters.
  useUnsavedGuard(isDirty || status === "saving");

  const content = useMemo(() => conformContent(sample, stored), [sample, stored]);

  return {
    content,
    patch,
    site,
    hasOwnContent: Object.keys(stored).length > 0,
    isDirty,
    status,
    loadError,
    saveError,
    isReady,
    save,
    discard,
    reset,
    publish,
    reload: () => setReloadKey((key) => key + 1),
  };
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
