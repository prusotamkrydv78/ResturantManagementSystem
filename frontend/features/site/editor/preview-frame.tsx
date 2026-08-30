"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders live React into an iframe of a given width.
 *
 * This exists because of a mistake worth naming. The preview used to be a `div`
 * with `width: 414px` and a scale transform, on the assumption that the page
 * inside would lay out as if the screen were that wide. It does not. Media
 * queries — which is all a Tailwind `sm:` or `lg:` prefix compiles to — are
 * answered by the *viewport*, not by whatever box an element happens to sit in.
 * So the phone frame was showing the desktop layout squeezed into a narrow
 * column: navigation that should have collapsed stayed expanded, two-column
 * bands stayed side by side, and the one thing the preview existed to check was
 * the one thing it could not show.
 *
 * An iframe has a viewport of its own. Set its width and the page inside answers
 * media queries against that width, exactly as a real device would.
 *
 * The content is still live React rather than a URL, which is the other half of
 * the requirement: pointing the frame at the published route would show the last
 * saved version. React is portalled into the frame's document, so the same tree
 * that would render inline renders inside a real viewport instead, and a
 * keystroke still reaches it immediately.
 */
export function PreviewFrame({
  width,
  /** Height in frame pixels, before scaling. */
  height,
  scale,
  title,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  title: string;
  children: React.ReactNode;
}) {
  const [body, setBody] = useState<HTMLElement | null>(null);

  const attach = useCallback((frame: HTMLIFrameElement | null) => {
    if (frame === null) {
      setBody(null);
      return;
    }

    // srcDoc gives a same-origin document synchronously in most browsers, but the
    // load event is what guarantees the body exists to portal into.
    const adopt = () => {
      const doc = frame.contentDocument;

      if (doc?.body != null) {
        doc.body.style.margin = "0";
        setBody(doc.body);
      }
    };

    adopt();
    frame.addEventListener("load", adopt);
  }, []);

  // The frame starts with an empty document, so it has none of the application's
  // styles. They are copied across, and kept copied: in development the styles
  // arrive as tags the dev server injects and replaces as files change, so a
  // one-off copy would leave the preview unstyled after the first edit.
  useEffect(() => {
    if (body === null) {
      return;
    }

    const doc = body.ownerDocument;

    const sync = () => {
      const wanted = document.head.querySelectorAll<HTMLElement>(
        'style, link[rel="stylesheet"]',
      );

      doc.head.querySelectorAll("[data-preview-style]").forEach((node) => node.remove());

      wanted.forEach((node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.setAttribute("data-preview-style", "");
        doc.head.append(copy);
      });
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [body]);

  return (
    <>
      <iframe
        ref={attach}
        title={title}
        srcDoc="<!doctype html><html><head></head><body></body></html>"
        // The width is the whole point: it is what the page inside measures its
        // media queries against. The scale only shrinks the result to fit the pane.
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="border-0 bg-white"
      />
      {body !== null && createPortal(children, body)}
    </>
  );
}
