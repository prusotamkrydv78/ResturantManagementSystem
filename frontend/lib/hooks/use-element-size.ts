"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The measured width and height of an element, kept current as it changes.
 *
 * Through a ResizeObserver rather than a window resize listener, because the thing
 * being measured is a pane inside a layout: it changes size when the sidebar folds,
 * when a section is added beside it, and when the window resizes. Only the last of
 * those fires a window event.
 *
 * Returns a callback ref rather than taking one, so the observer attaches the
 * moment the node exists. A `useRef` plus an effect would miss the first paint and
 * measure zero, which for a scale-to-fit preview means a frame at the wrong size.
 */
export function useElementSize(): [
  (node: HTMLElement | null) => void,
  { width: number; height: number },
] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [node, setNode] = useState<HTMLElement | null>(null);

  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);

  useEffect(() => {
    if (node === null) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry === undefined) {
        return;
      }

      const { width, height } = entry.contentRect;

      // Compared before setting, because an observer fires for changes that round
      // to the same layout and each one would otherwise be a render.
      setSize((current) =>
        Math.round(current.width) === Math.round(width) &&
        Math.round(current.height) === Math.round(height)
          ? current
          : { width, height },
      );
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [node]);

  return [ref, size];
}
