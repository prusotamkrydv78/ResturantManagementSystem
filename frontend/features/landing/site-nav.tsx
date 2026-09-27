"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

/**
 * The landing header, alive.
 *
 * `HeaderShell` stays put the whole way down: a full-width bar at the top that
 * pulls in and floats once the page has left the top. `SectionNav` follows the page: a pill slides under the link for the
 * section on screen, and the address bar's hash follows too, so a copied link
 * lands where the visitor was.
 */

/** Every section the address bar follows, top to bottom. */
const TRACKED = ["top", "how-it-works", "features", "story", "screens", "roles", "access", "finale"];

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const onScroll = () => setRaised(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-raised={raised || undefined}
      className="group/header sticky top-0 z-40 transition-[padding] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] data-[raised]:px-3 sm:data-[raised]:px-4"
    >
      {children}
    </header>
  );
}

export function SectionNav({ items }: { items: ReadonlyArray<{ label: string; href: string }> }) {
  const [active, setActive] = useState("top");

  useEffect(() => {
    // Measured on scroll rather than observed: the section on screen is the last
    // one whose top has passed the middle of the window. An IntersectionObserver
    // on a zero-height line missed sections under the smooth scroll and the pins.
    let frame = 0;
    let current = "";

    const measure = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let found = TRACKED[0]!;

      for (const id of TRACKED) {
        const section = document.getElementById(id);

        if (section && section.getBoundingClientRect().top <= middle) {
          found = id;
        }
      }

      if (found !== current) {
        current = found;
        setActive(found);
        // Replace, not push: scrolling should not fill the back button.
        history.replaceState(null, "", found === "top" ? window.location.pathname : `#${found}`);
      }
    };

    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure);
      }
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const on = item.href === `#${active}`;

        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={on ? "true" : undefined}
            className={cn(
              "relative isolate rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              on ? "text-accent-fg" : "text-muted hover:text-text",
            )}
          >
            {on && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 -z-10 rounded-lg bg-accent"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
