"use client";

import { useEffect, useState } from "react";

/**
 * The design tokens, as colours a canvas can actually paint with.
 *
 * Everything else in this product styles itself by naming a token and letting CSS
 * resolve it. A chart cannot: Chart.js paints into a canvas, and a canvas takes
 * `rgb(62 86 65)`, not `var(--primary)`. So the tokens have to be resolved to real
 * colours in JavaScript, once, and handed over.
 *
 * The resolving is done by a throwaway element rather than by reading the custom
 * property off the root. Reading `--primary` gives back the literal text
 * `light-dark(#3e5641, #7fa486)`, because a custom property is only a token stream
 * until something uses it as a colour. Setting that stream as an element's `color` and
 * reading the computed value back is what forces the browser to pick a side, and it
 * picks the same side the rest of the page is on.
 *
 * Re-resolved whenever the theme changes, from either direction: the explicit
 * `data-theme` choice on the root, or the operating system flipping underneath a
 * reader who never made one.
 */

const TOKENS = {
  text: "var(--text)",
  muted: "var(--text-muted)",
  subtle: "var(--text-subtle)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  surface: "var(--surface)",
  surfaceSunk: "var(--surface-3)",
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

const SERIES_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

const REST_TOKEN = "var(--chart-rest)";

export interface ChartTheme extends Record<keyof typeof TOKENS, string> {
  /** Six colours that mean nothing but "not that one", plus the gathering grey. */
  series: string[];
  rest: string;
  /** Honoured by every chart's animation, the same as the rest of the product. */
  reducedMotion: boolean;
}

/**
 * The resolved palette, or null until the browser has one.
 *
 * Null on the server and on the first paint, which is deliberate twice over: there is
 * no computed style to read before mount, and a canvas rendered during a server pass
 * would have to be thrown away and drawn again anyway.
 */
export function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const read = () => setTheme(resolve());

    const first = setTimeout(read, 0);

    // The explicit choice, and the system one. A reader who has never touched the
    // theme switch is on `color-scheme: light dark`, where nothing about the document
    // changes when the operating system flips - only the media query fires.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    dark.addEventListener("change", read);
    motion.addEventListener("change", read);

    return () => {
      clearTimeout(first);
      observer.disconnect();
      dark.removeEventListener("change", read);
      motion.removeEventListener("change", read);
    };
  }, []);

  return theme;
}

function resolve(): ChartTheme {
  const probe = document.createElement("span");

  probe.style.display = "none";
  document.body.appendChild(probe);

  const colourOf = (token: string): string => {
    probe.style.color = "";
    probe.style.color = token;

    return window.getComputedStyle(probe).color;
  };

  const resolved = Object.fromEntries(
    Object.entries(TOKENS).map(([name, token]) => [name, colourOf(token)]),
  ) as Record<keyof typeof TOKENS, string>;

  const series = SERIES_TOKENS.map(colourOf);
  const rest = colourOf(REST_TOKEN);

  probe.remove();

  return {
    ...resolved,
    series,
    rest,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/**
 * The same colour, see-through.
 *
 * Chart.js fills want a translucent version of the line above them, and the tokens
 * only come back as opaque `rgb(...)`. Written against the computed form rather than
 * against hex, because that is the only form this file ever sees.
 */
export function fade(colour: string, alpha: number): string {
  const parts = colour.match(/[\d.]+/g);

  if (parts === null || parts.length < 3) {
    return colour;
  }

  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}
