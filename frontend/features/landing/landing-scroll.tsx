"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger, SplitText, useGSAP);

/**
 * Every entrance and scroll effect on the landing page, choreographed in one place.
 *
 * The markup only carries hooks - `data-hero="..."` on the hero's parts and a
 * `data-section` wrapper around each section - and this component decides how they
 * move, so the page reads as one piece of direction rather than a dozen unrelated
 * fades.
 *
 * ON LOAD
 *
 * The hero plays a single timeline: the dark panel opens out of a smaller rounded
 * window, the glows bloom, the headline rises line by line and character by
 * character from behind a mask, the copy and buttons follow, and the live board
 * swings in on a slight 3D tilt. Hero parts start hidden in CSS so nothing flashes
 * before the timeline takes them.
 *
 * ON SCROLL
 *
 * - Each section heading is split into words that rise out of a mask.
 * - Cards and tiles arrive in staggered batches, tipping up from a 3D angle.
 * - The marquee skews with scroll velocity, so it feels driven by the page.
 * - Big contrast panels (the statement, the closing call) grow into place as they
 *   are scrolled to, tied to the scrollbar rather than fired once.
 *
 * IN-PAGE LINKS
 *
 * A nav link glides the page to its section rather than jumping, taking longer for
 * a longer trip, and the section greets the arrival: its label pops and its heading
 * settles into place. Scrolling by hand mid-glide hands control straight back.
 *
 * Under reduced motion none of this runs: the hidden hero parts are simply shown.
 */
export function LandingScroll({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-hero]", { autoAlpha: 1 });
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const ease = "expo.out";
        const cleanups: Array<() => void> = [];

        /* ------------------------------------------------------ hero intro --- */

        const lines = gsap.utils.toArray<HTMLElement>('[data-hero="line"]');
        const split = SplitText.create('[data-hero="line"] [data-split]', { type: "chars", charsClass: "inline-block" });

        const intro = gsap.timeline({ defaults: { ease } });

        intro
          .fromTo(
            '[data-hero="panel"]',
            { autoAlpha: 0, scale: 0.94, y: 30 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 1.4, clearProps: "transform" },
          )
          .fromTo('[data-hero="glow"]', { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 2, stagger: 0.2 }, 0.2)
          .fromTo('[data-hero="pill"]', { autoAlpha: 0, y: 20, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8 }, 0.5)
          .set('[data-hero="cta"], [data-hero="facts"]', { autoAlpha: 1 }, 0)
          .set(lines, { autoAlpha: 1 }, 0.6)
          .from(lines, { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.6)
          .from(split.chars, { yPercent: 60, rotate: 8, autoAlpha: 0, duration: 0.9, stagger: 0.025, onComplete: () => split.revert() }, 0.75)
          .fromTo('[data-hero="lede"]', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 1.05)
          .fromTo('[data-hero="cta"] > *', { autoAlpha: 0, y: 24, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.1 }, 1.15)
          .fromTo(
            '[data-hero="board"]',
            { autoAlpha: 0, x: 80, y: 40, rotateY: -18, rotateX: 8, transformPerspective: 1200 },
            { autoAlpha: 1, x: 0, y: 0, rotateY: 0, rotateX: 0, duration: 1.6, clearProps: "transform" },
            0.9,
          )
          .fromTo('[data-hero="facts"] > *', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 1.4);

        // The floating moments in the left margin pop in, then bob on their own
        // rhythm and lean away from the pointer, nearer ones further.
        const floaters = gsap.utils.toArray<HTMLElement>('[data-hero="float"]');
        intro.fromTo(
          floaters,
          { autoAlpha: 0, scale: 0.4, x: -40 },
          { autoAlpha: 1, scale: 1, x: 0, duration: 1, ease: "back.out(1.8)", stagger: 0.12 },
          1.3,
        );

        floaters.forEach((floater, index) => {
          gsap.to(floater.querySelector("[data-bob]"), {
            y: index % 2 === 0 ? -10 : 10,
            duration: 2.4 + index * 0.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        });

        const panel = root.current?.querySelector<HTMLElement>('[data-hero="panel"]');
        if (panel && floaters.length > 0) {
          const movers = floaters.map((floater) => ({
            depth: Number(floater.dataset.depth ?? 1),
            x: gsap.quickTo(floater, "xPercent", { duration: 1, ease: "power3.out" }),
            y: gsap.quickTo(floater, "yPercent", { duration: 1, ease: "power3.out" }),
          }));

          const lean = (event: PointerEvent) => {
            const box = panel.getBoundingClientRect();
            const dx = (event.clientX - box.left) / box.width - 0.5;
            const dy = (event.clientY - box.top) / box.height - 0.5;

            movers.forEach(({ depth, x, y }) => {
              x(dx * -30 * depth);
              y(dy * -60 * depth);
            });
          };

          const rest = () => movers.forEach(({ x, y }) => (x(0), y(0)));

          panel.addEventListener("pointermove", lean);
          panel.addEventListener("pointerleave", rest);
          cleanups.push(() => {
            panel.removeEventListener("pointermove", lean);
            panel.removeEventListener("pointerleave", rest);
          });
        }

        /* --------------------------------------------------- section by section */

        gsap.utils.toArray<HTMLElement>("[data-section]").forEach((section) => {
          // Headings rise word by word out of a mask.
          section.querySelectorAll<HTMLElement>("h2").forEach((heading) => {
            SplitText.create(heading, {
              type: "words,lines",
              mask: "lines",
              autoSplit: true,
              onSplit: (self) =>
                gsap.from(self.words, {
                  yPercent: 120,
                  duration: 1,
                  ease,
                  stagger: 0.05,
                  scrollTrigger: { trigger: heading, start: "top 85%", once: true },
                }),
            });
          });

          // Everything else in the heading block (eyebrow, lede) follows.
          const extras = section.querySelectorAll<HTMLElement>("[data-eyebrow], h2 + p");
          if (extras.length > 0) {
            gsap.from(extras, {
              autoAlpha: 0,
              y: 24,
              duration: 0.9,
              ease,
              stagger: 0.1,
              delay: 0.2,
              scrollTrigger: { trigger: section, start: "top 80%", once: true },
            });
          }

          // Cards arrive in staggered batches, tipping up from an angle.
          const cards = section.querySelectorAll<HTMLElement>("article");
          if (cards.length > 0) {
            gsap.set(cards, { autoAlpha: 0, y: 80, rotateX: -20, scale: 0.94, transformPerspective: 1000, transformOrigin: "50% 100%" });
            ScrollTrigger.batch(cards, {
              start: "top 92%",
              once: true,
              onEnter: (batch) =>
                gsap.to(batch, {
                  autoAlpha: 1,
                  y: 0,
                  rotateX: 0,
                  scale: 1,
                  duration: 1.1,
                  ease,
                  stagger: 0.09,
                  overwrite: true,
                  clearProps: "transform",
                }),
            });
          }

          // Anything else marked as a big picture gets a slow rise.
          const pictures = section.querySelectorAll<HTMLElement>("[data-picture]");
          if (pictures.length > 0) {
            gsap.from(pictures, {
              autoAlpha: 0,
              y: 100,
              scale: 0.96,
              duration: 1.3,
              ease,
              scrollTrigger: { trigger: pictures[0], start: "top 88%", once: true },
            });
          }

          // Full-bleed panels grow into place with the scrollbar.
          const panel = section.querySelector<HTMLElement>("[data-panel]");
          if (panel) {
            gsap.fromTo(
              panel,
              { scale: 0.9 },
              {
                scale: 1,
                ease: "none",
                force3D: true,
                scrollTrigger: { trigger: panel, start: "top bottom", end: "top 45%", scrub: 0.6 },
              },
            );
          }
        });

        /* --------------------------------------------------------- marquee --- */

        const track = root.current?.querySelector<HTMLElement>("[data-marquee]");
        if (track) {
          const skew = gsap.quickTo(track, "skewX", { duration: 0.6, ease: "power3.out" });

          ScrollTrigger.create({
            onUpdate: (self) => skew(gsap.utils.clamp(-12, 12, self.getVelocity() / -250)),
          });

          // Settle back upright once the page stops moving.
          const settle = () => skew(0);
          ScrollTrigger.addEventListener("scrollEnd", settle);
          cleanups.push(() => ScrollTrigger.removeEventListener("scrollEnd", settle));
        }

        /* -------------------------------------------------- in-page links --- */

        const arrive = (target: HTMLElement) => {
          const eyebrow = target.querySelector<HTMLElement>("[data-eyebrow]");
          const heading = target.querySelector<HTMLElement>("h2");

          if (eyebrow) {
            gsap.fromTo(
              eyebrow,
              { scale: 0.6, boxShadow: "0 0 0 0px rgba(214, 244, 106, 0.9)" },
              { scale: 1, boxShadow: "0 0 0 14px rgba(214, 244, 106, 0)", duration: 1, ease: "elastic.out(1, 0.5)", clearProps: "transform,boxShadow" },
            );
          }

          if (heading) {
            gsap.fromTo(
              heading,
              { y: 40, autoAlpha: 0.3, skewY: 3 },
              { y: 0, autoAlpha: 1, skewY: 0, duration: 1, ease, delay: 0.05, clearProps: "transform" },
            );
          }
        };

        const glide = (event: MouseEvent) => {
          const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
          const hash = link?.getAttribute("href");

          if (!link || !hash || hash.length < 2 || event.metaKey || event.ctrlKey || event.shiftKey) {
            return;
          }

          const target = document.querySelector<HTMLElement>(hash);

          if (!target) {
            return;
          }

          event.preventDefault();

          const distance = Math.abs(target.getBoundingClientRect().top);

          gsap.to(window, {
            duration: gsap.utils.clamp(0.9, 1.8, distance / 1800),
            ease: "power4.inOut",
            overwrite: true,
            scrollTo: { y: target, offsetY: 88, autoKill: true },
            onComplete: () => {
              history.replaceState(null, "", hash);
              arrive(target);
            },
          });
        };

        document.addEventListener("click", glide);
        cleanups.push(() => document.removeEventListener("click", glide));

        // Trigger positions are measured now; web fonts landing later reflow the
        // page, so measure again once they are in.
        void document.fonts.ready.then(() => ScrollTrigger.refresh());

        return () => cleanups.forEach((cleanup) => cleanup());
      });

      return () => media.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
