"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A preference that lives in the browser rather than in React.
 *
 * Per browser, deliberately. Whether a rail is folded is about the screen somebody
 * is sitting at - a manager on a laptop at the pass wants the room, the same
 * manager on a desktop in the office does not - so it does not belong on the
 * account.
 *
 * Through useSyncExternalStore rather than state restored in an effect: the server
 * renders these components and cannot see localStorage, so the stored value has to
 * arrive as a client snapshot over a server one. Restoring it by calling setState
 * from an effect does the same job by cascading an extra render, and is what the
 * react-hooks lint rule exists to catch.
 */

const listeners = new Set<() => void>();

/**
 * The last value parsed out of a key, kept so repeated reads return the same
 * reference. useSyncExternalStore compares snapshots by identity, so parsing the
 * JSON afresh on every read would hand it a new object each time and spin.
 */
const parsed = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Also the real storage event, which fires only in other tabs. A manager with
  // the floor open on one screen and reports on another gets one sidebar, not two.
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Reads a preference, treating every failure as "no preference".
 *
 * Wrapped because the accessor itself throws in a browser set to block site data,
 * not only when the key is missing, and navigation chrome is not worth a crash.
 */
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }

  const cached = parsed.get(key);

  if (cached !== undefined && cached.raw === raw) {
    return cached.value as T;
  }

  let value = fallback;

  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }

  parsed.set(key, { raw, value });

  return value;
}

/**
 * Reads and writes one stored preference.
 *
 * `fallback` must be a stable reference for anything but a primitive, because it
 * is also the server snapshot: a fresh array literal on every render would be a
 * new snapshot every render.
 */
export function useStoredPreference<T>(
  key: string,
  fallback: T,
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot(key, fallback),
    () => fallback,
  );

  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Somebody who cannot store preferences still gets working navigation;
        // the change simply does not outlive the page.
      }

      parsed.delete(key);
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, set];
}
