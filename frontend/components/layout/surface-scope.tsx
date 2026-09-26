"use client";

import { useLayoutEffect } from "react";

/**
 * Wears a surface - "brand" on the public pages and sign-in - for as long as this
 * is mounted.
 *
 * Two halves, because there are two ways to arrive. Landing on the page fresh, the
 * inline script runs while the HTML is still being parsed, so the first paint is
 * already in the right colours rather than flashing the application's look and
 * then switching. Navigating here inside the app, no script runs - React does not
 * execute inline scripts it renders on the client - so the layout effect does it,
 * still before paint. Leaving takes it off again, so whatever comes next starts
 * from the application's own look.
 */
export function SurfaceScope({ surface }: { surface: "brand" }) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.surface = surface;

    return () => {
      if (root.dataset.surface === surface) {
        delete root.dataset.surface;
      }
    };
  }, [surface]);

  return (
    <script
      // A fixed literal, never user input: nothing here can carry markup.
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.dataset.surface=${JSON.stringify(surface)};`,
      }}
    />
  );
}
