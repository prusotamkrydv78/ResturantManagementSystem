"use client";

import { useEffect } from "react";

/**
 * Warns before the tab closes on unsaved work.
 *
 * The website editor holds a whole page of writing in React state, and a manager can
 * spend half an hour in it before pressing Save. Closing the tab, reloading, or
 * following a link out of the application threw all of it away without a word.
 *
 * `beforeunload` is the only guard a browser actually honours, and it covers exactly
 * those cases: closing, reloading, and navigating away from the origin. It cannot
 * see a client-side route change - the App Router offers no hook for that, and the
 * workarounds all involve intercepting every anchor on the page, which breaks in
 * ways that are worse than the problem. A screen relying on this should therefore
 * also say on its face that it has unsaved changes, so the warning is a backstop
 * rather than the only signal.
 *
 * The message is ignored by every current browser, which shows its own wording. The
 * only thing that matters is that `preventDefault` is called.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
}
