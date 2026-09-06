"use client";

import { useEffect, useRef } from "react";

/**
 * Says what happened in the browser tab itself.
 *
 * The cheapest notification there is, and the one that needs no permission from anybody.
 * A guest who has switched to another tab, or put the phone down with the browser still
 * open, glances across and reads the answer without opening anything.
 *
 * Only while the page is hidden. Rewriting the title of a page somebody is looking at
 * would fight with what is already on the screen and tell them nothing new.
 *
 * The original title is captured once and always restored, including when the component
 * goes away mid-alert - a tab left saying "your food is ready" long after the meal is a
 * small thing that feels broken.
 */
export function useTabAlert(alert: string | null): void {
  const original = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    original.current ??= document.title;

    function paint() {
      const base = original.current ?? document.title;

      document.title = document.hidden && alert !== null ? alert : base;
    }

    paint();
    document.addEventListener("visibilitychange", paint);

    return () => {
      document.removeEventListener("visibilitychange", paint);

      if (original.current !== null) {
        document.title = original.current;
      }
    };
  }, [alert]);
}
