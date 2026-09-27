import gsap from "gsap";

/**
 * What a word landing looks like underneath it, for the page loader.
 *
 * A flash of light behind the word, optionally a flattened shockwave rippling out
 * along the "ground" below it (two rings), and a spray of sparks
 * kicked up and out that fall as they fade. The pieces are built on the fly inside
 * the loader, so they go when the loader does.
 */

/** Where something landed, relative to the stage: centre x, centre y and size. */
export interface Spot {
  x: number;
  centre: number;
  width: number;
  height: number;
}

/** Measures an element against the stage, unscaled - it may still be mid-stamp. */
export function spotOf(stage: HTMLElement, element: HTMLElement): Spot {
  const box = element.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  const scale = box.width / (element.offsetWidth || box.width) || 1;

  return {
    x: box.left - frame.left + box.width / 2,
    centre: box.top - frame.top + box.height / 2,
    width: box.width / scale,
    height: box.height / scale,
  };
}

/** `rings` adds the shockwave rings; the loader goes without, the finale keeps them. */
export function impact(stage: HTMLElement, spot: Spot, colour: string, strength = 1, rings = false) {
  const ground = spot.centre + spot.height * 0.42;
  const width = spot.width * 1.15;
  const burst = gsap.timeline({ onComplete: () => pieces.forEach((piece) => piece.remove()) });
  const pieces: HTMLElement[] = [];

  const make = (radius: string, style: Partial<CSSStyleDeclaration>, top = ground) => {
    const piece = document.createElement("span");

    Object.assign(piece.style, {
      position: "absolute",
      pointerEvents: "none",
      left: `${spot.x}px`,
      top: `${top}px`,
      borderRadius: radius,
      ...style,
    });
    // Behind the words, so the burst reads as underneath them.
    stage.insertBefore(piece, stage.firstChild);
    pieces.push(piece);
    gsap.set(piece, { xPercent: -50, yPercent: -50 });

    return piece;
  };

  const glow = make(
    "9999px",
    { width: `${width}px`, height: `${width * 0.5}px`, background: `radial-gradient(closest-side, ${colour}, transparent)` },
    spot.centre,
  );
  burst.fromTo(glow, { autoAlpha: 0.5, scale: 0.4 }, { autoAlpha: 0, scale: 1.4, duration: 0.6, ease: "power2.out" }, 0);

  if (rings) {
    const ring = make("50%", { width: `${width}px`, height: `${width * 0.22}px`, border: `${2 * strength}px solid ${colour}` });
    const echo = make("50%", { width: `${width}px`, height: `${width * 0.22}px`, border: `1px solid ${colour}` });

    burst
      .fromTo(ring, { autoAlpha: 1, scale: 0.2 }, { autoAlpha: 0, scale: 1.5 * strength, duration: 0.7, ease: "expo.out" }, 0)
      .fromTo(echo, { autoAlpha: 0.7, scale: 0.2 }, { autoAlpha: 0, scale: 2.1 * strength, duration: 1, ease: "expo.out" }, 0.08);
  }

  const sparks = Math.round(10 * strength);

  for (let i = 0; i < sparks; i++) {
    const size = gsap.utils.random(3, 6) * Math.min(strength, 1.4);
    const spark = make("9999px", { width: `${size}px`, height: `${size}px`, background: colour });
    // Mostly up and out, like grit kicked off the ground.
    const angle = gsap.utils.random(-170, -10) * (Math.PI / 180);
    const distance = gsap.utils.random(40, 120) * strength;
    const start = gsap.utils.random(-width / 3, width / 3);

    burst
      .fromTo(
        spark,
        { x: start, y: 0, autoAlpha: 1, scale: 1 },
        { x: start + Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.8, duration: 0.45, ease: "power3.out" },
        0,
      )
      .to(spark, { y: `+=${gsap.utils.random(30, 70)}`, autoAlpha: 0, scale: 0.3, duration: 0.5, ease: "power2.in" }, 0.45);
  }

  return burst;
}
