"use client";

import { useEffect } from "react";
import { useStoredPreference } from "@/lib/hooks/use-stored-preference";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme/theme";

/**
 * Reads and writes the theme.
 *
 * Built on the same stored-preference hook the folded rails use, which already
 * solves the three hard parts: a server snapshot that does not touch localStorage,
 * a storage listener so a second tab follows along, and a read that survives a
 * browser configured to block site data.
 *
 * The effect writes to the DOM rather than to state, which is why it is allowed to
 * exist — it is the one direction React cannot express declaratively, because the
 * attribute lives on `<html>`, outside the tree. It also covers the case the click
 * handler cannot: another tab changing the theme arrives as a storage event, not as
 * a call to `setTheme` here.
 */
export function useTheme(): {
  theme: ThemePreference;
  setTheme: (next: ThemePreference, origin?: { x: number; y: number }) => void;
} {
  const [stored, setStored] = useStoredPreference<ThemePreference>(
    THEME_STORAGE_KEY,
    "light",
  );

  // A value written by an older build, or edited by hand, should not leave the
  // interface pointing at a theme that no longer exists.
  const theme = isThemePreference(stored) ? stored : "light";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The change as something alive. The browser photographs the page and the theme
  // is applied inside a view transition; then the new picture seeps in like a
  // symbiote taking a body - soft patches with wobbling edges breaking out one after
  // another, the first at the switch and the rest at random across the screen,
  // spreading slowly and merging until nothing of the old page is left - while the
  // old page darkens and drains of colour under it. The attribute is written synchronously in the callback: React
  // state would land a frame later, after the "after" picture was taken. Where the
  // browser cannot, or the reader prefers stillness, it simply switches.
  const setTheme = (next: ThemePreference, origin?: { x: number; y: number }) => {
    const start = (document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> };
    }).startViewTransition;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (start === undefined || still || next === theme) {
      setStored(next);
      return;
    }

    const transition = start.call(document, () => {
      applyTheme(next);
      setStored(next);
    });

    const frames = venomFrames(origin ?? { x: window.innerWidth - 80, y: 28 });
    const duration = 1600;

    void transition.ready.then(() => {
      const html = document.documentElement;

      html.animate(frames, {
        duration,
        easing: "linear",
        pseudoElement: "::view-transition-new(root)",
      });

      // The old page is consumed rather than covered: it darkens and drains of
      // colour as the new one takes it over.
      html.animate(
        { filter: ["brightness(1) saturate(1)", "brightness(0.45) saturate(0.2)"] },
        { duration, easing: "ease-in", pseudoElement: "::view-transition-old(root)" },
      );
    });

  };

  return { theme, setTheme };
}

/** How finely each patch's edge is drawn, and how many frames it is sampled at. */
const PATCH_POINTS = 72;
const VENOM_FRAMES = 44;
/** How many patches break out, the first always at the switch. */
const PATCHES = 12;

/**
 * The keyframes for the takeover, as clip-path polygons.
 *
 * Several patches, drawn as one polygon: each is a closed, rounded loop, and the
 * loops are joined through a shared anchor by lines that go out and come straight
 * back, which enclose nothing - so the browser draws several separate shapes from a
 * single polygon, and they merge naturally where they overlap.
 *
 * Each patch has its own place, the moment it breaks out and how far it grows. The
 * first sits on the switch, starts at once and grows past the farthest corner, which
 * is what guarantees the screen ends fully covered; the rest appear at random places
 * and random moments, so the colour seeps in patchily rather than as one front.
 *
 * Their edges are soft: a few slow ripples of low frequency, each with its own phase
 * and drift, so the outline breathes and wobbles like something alive but never
 * forms a point. Every frame has the same points in the same order, so the browser
 * can tween between them; everything is rolled fresh on every switch.
 */
function venomFrames(origin: { x: number; y: number }): Keyframe[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const reach = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
  const diagonal = Math.hypot(width, height);

  const ripple = () =>
    Array.from({ length: 3 }, (_, index) => ({
      frequency: 2 + index + Math.floor(Math.random() * 2),
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 3,
      strength: 0.07 / (index + 1),
    }));

  const patches = Array.from({ length: PATCHES }, (_, index) =>
    index === 0
      ? { x: origin.x, y: origin.y, start: 0, size: reach * 1.12, ripples: ripple() }
      : {
          x: Math.random() * width,
          y: Math.random() * height,
          start: 0.04 + Math.random() * 0.4,
          size: diagonal * (0.3 + Math.random() * 0.3),
          ripples: ripple(),
        },
  );

  const frames: Keyframe[] = [];

  for (let frame = 0; frame <= VENOM_FRAMES; frame++) {
    const t = frame / VENOM_FRAMES;
    const points: string[] = [`${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`];

    for (const patch of patches) {
      // Nothing before it breaks out; then a slow start and a steady spread.
      const local = Math.min(1, Math.max(0, (t - patch.start) / (1 - patch.start)));
      const size = patch.size * Math.pow(local, 1.5);
      const loop: string[] = [];

      for (let index = 0; index <= PATCH_POINTS; index++) {
        const theta = (index / PATCH_POINTS) * Math.PI * 2;
        let wobble = 1;

        for (const r of patch.ripples) {
          wobble += r.strength * Math.sin(theta * r.frequency + r.phase + t * r.drift * Math.PI * 2);
        }

        const radius = Math.max(0, size * wobble);
        loop.push(`${(patch.x + Math.cos(theta) * radius).toFixed(1)}px ${(patch.y + Math.sin(theta) * radius).toFixed(1)}px`);
      }

      // Out to the patch, round it, and back to the anchor along the same line.
      points.push(...loop, points[0]!);
    }

    frames.push({ clipPath: `polygon(${points.join(", ")})`, offset: t });
  }

  return frames;
}
