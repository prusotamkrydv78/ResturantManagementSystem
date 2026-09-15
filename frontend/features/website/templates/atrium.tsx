"use client";

import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";
import { PHOTO_GROUND, photoUrl, type PhotoTone } from "@/features/website/photos";
import type { Restaurant } from "@/types/restaurant";

/**
 * Atrium — half picture, half page.
 *
 * This replaces a design that did not work, and the reason is worth keeping because
 * it is the same reason the one before it failed. Both were concepts first: an arch,
 * then a broadsheet. A concept carries a page only if every detail of it lands, and
 * when one does not — an ellipse instead of an arch, a justified column that opened
 * rivers — there is nothing underneath to hold the thing up. So this design has no
 * concept. It has a structure, a lot of photography and a strong palette, which is
 * what the three that worked have.
 *
 * THE STRUCTURE
 *
 * A photograph that holds still while the writing moves past it. The middle third of
 * the page is a split: a picture fixed to the viewport on one side, chapters
 * scrolling on the other, and the picture changes as each chapter arrives. It is the
 * one arrangement none of the other three use, it shows four photographs in the space
 * one would normally take, and it does not depend on any single detail being perfect.
 *
 * THE PALETTE
 *
 * Deep navy and brass on warm off-white. Aurora is terracotta, Slate is gold on
 * black, Harvest is olive — blue was the one direction left, and it is the one that
 * reads as evening without going dark.
 *
 * TWO SOURCES, KEPT APART
 *
 * The restaurant's record supplies the name, the address and the two ways to reach
 * it. Everything else is sample copy, and every screen that shows this page says so.
 */

export function AtriumTemplate({
  restaurant,
  content = sampleContent(),
}: {
  restaurant: Restaurant;
  content?: SampleContent;
}) {
  const where = [restaurant.addressLine, restaurant.city, restaurant.country]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(", ");

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "atrium site-page selection:bg-[var(--brass)] selection:text-[var(--navy)]",
          "[--brass:#c08a4e] [--ink:#16202a] [--line:#ddd7cc] [--muted:#6a6459]",
          "[--navy:#1b2c3c] [--paper:#f6f3ed] [--sand:#ece7dc] [--site-focus:#c08a4e]",
        )}
        style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
      >
        <Bar restaurant={restaurant} />
        <Opening restaurant={restaurant} content={content} />
        <Chapters content={content} />
        <Carte content={content} />
        <Interlude content={content} />
        <Gallery content={content} />
        <Visit restaurant={restaurant} content={content} where={where} />
        <Footer restaurant={restaurant} content={content} where={where} />
      </div>
    </MotionConfig>
  );
}

const NAV = [
  { label: "The room", href: "#chapters" },
  { label: "Menu", href: "#menu" },
  { label: "Gallery", href: "#gallery" },
  { label: "Visit", href: "#visit" },
];

/* -------------------------------------------------------------------------- */
/* Chrome                                                                     */
/* -------------------------------------------------------------------------- */

/** A slim bar, always there, on the paper colour. Nothing clever. */
function Bar({ restaurant }: { restaurant: Restaurant }) {
  return (
    <header
      id="top"
      className="sticky top-0 z-40 border-b border-[var(--line)]"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <a href="#top" className="font-display text-lg leading-none sm:text-xl">
          {restaurant.name}
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase transition-colors hover:text-[var(--navy)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#visit"
          className="shrink-0 rounded-full bg-[var(--navy)] px-5 py-2.5 text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--paper)] uppercase transition-colors hover:bg-[var(--brass)]"
        >
          Reserve
        </a>
      </div>
    </header>
  );
}

/**
 * The opening: a photograph on one half, a navy block on the other.
 *
 * Both full height, edge to edge, meeting in the middle. Aurora lays type over a
 * picture and Harvest overlaps the two; this simply gives each of them half the
 * screen, which is the most confident of the three arrangements and the only one
 * where the photograph is never dimmed to make room for words.
 */
function Opening({
  restaurant,
  content,
}: {
  restaurant: Restaurant;
  content: SampleContent;
}) {
  return (
    <section className="grid lg:min-h-[calc(100svh-4.5rem)] lg:grid-cols-2">
      <div className="relative order-1 min-h-[22rem] lg:order-none lg:min-h-0">
        <Picture tone="hall" width={1400} height={1800} priority fill />
      </div>

      <div
        className="order-2 flex items-center px-6 py-16 sm:px-12 lg:order-none lg:px-14 xl:px-20"
        style={{ backgroundColor: "var(--navy)", color: "var(--paper)" }}
      >
        <div className="max-w-lg">
          <p className="text-[0.7rem] font-semibold tracking-[0.26em] text-[var(--brass)] uppercase">
            {content.eyebrow}
          </p>

          <h1 className="font-display mt-6 text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] text-balance">
            {content.headline}
          </h1>

          <p className="mt-7 text-[15px] leading-[1.85] text-[var(--paper)]/65">
            {content.standfirst}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#visit"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--brass)] px-7 py-3.5 text-sm font-semibold text-[var(--navy)] transition-transform hover:scale-[1.03]"
            >
              Reserve a table
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
            <a
              href="#menu"
              className="rounded-full border border-[var(--paper)]/25 px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-[var(--paper)] hover:text-[var(--navy)]"
            >
              See the menu
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-[var(--paper)]/15 pt-8">
            {content.heritage.facts.slice(0, 3).map((fact) => (
              <div key={fact.label}>
                <dd className="font-display tabular text-2xl leading-none text-[var(--brass)]">
                  {fact.value}
                </dd>
                <dt className="mt-2 text-[0.6rem] font-semibold tracking-[0.16em] text-[var(--paper)]/45 uppercase">
                  {fact.label}
                </dt>
              </div>
            ))}
          </dl>

          {restaurant.city !== null && restaurant.city.trim() !== "" && (
            <p className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--paper)]/55">
              <MapPin className="size-4 text-[var(--brass)]" aria-hidden="true" />
              {restaurant.city}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The split                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The signature: a picture fixed to the viewport, chapters moving past it.
 *
 * Four chapters and four photographs. The picture on the left is pinned for the whole
 * section and crossfades as each chapter reaches the middle of the screen, so a reader
 * scrolling one column is quietly being shown four images in the room one would
 * normally take.
 *
 * Below the large breakpoint it becomes what it has to become: each chapter with its
 * own picture above it. A pinned panel needs a tall viewport and a second column, and
 * a phone has neither.
 */
function Chapters({ content }: { content: SampleContent }) {
  const chapters = [
    {
      kicker: "The room",
      title: content.story.title,
      body: content.story.body[0] ?? "",
      tone: "room" as PhotoTone,
    },
    {
      kicker: "The kitchen",
      title: content.chef.quote,
      body: content.chef.bio,
      tone: "pass" as PhotoTone,
      footnote: `${content.chef.name} · ${content.chef.role}`,
    },
    {
      kicker: "The fire",
      title: "Everything meets the coals",
      body: content.story.body[1] ?? "",
      tone: "fire" as PhotoTone,
    },
    {
      kicker: "The cellar",
      title: content.cellar.title,
      body: content.cellar.body,
      tone: "wine" as PhotoTone,
    },
  ];

  const [active, setActive] = useState(0);

  return (
    <section id="chapters" className="lg:grid lg:grid-cols-2">
      {/* The pinned half. Hidden rather than collapsed on narrow screens, because the
          pictures reappear inside each chapter below. */}
      <div className="hidden lg:block">
        <div className="sticky top-[4.5rem] h-[calc(100svh-4.5rem)] overflow-hidden">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.kicker}
              className="absolute inset-0 transition-opacity duration-[900ms] ease-in-out"
              style={{ opacity: index === active ? 1 : 0 }}
            >
              <Picture tone={chapter.tone} width={1400} height={1800} fill />
            </div>
          ))}

          {/* Which of the four, as four short rules along the bottom. A reader who
              cannot tell that the picture is keeping pace with the writing will
              assume it is decorative. */}
          <div className="absolute inset-x-0 bottom-8 flex justify-center gap-2">
            {chapters.map((chapter, index) => (
              <span
                key={chapter.kicker}
                aria-hidden="true"
                className={cn(
                  "h-0.5 rounded-full transition-all duration-500",
                  index === active
                    ? "w-10 bg-[var(--brass)]"
                    : "w-5 bg-[var(--paper)]/35",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        {chapters.map((chapter, index) => (
          <Chapter
            key={chapter.kicker}
            index={index}
            onEnter={setActive}
            tone={chapter.tone}
          >
            <Kicker>{chapter.kicker}</Kicker>
            <h2 className="font-display mt-6 text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.12] text-balance">
              {chapter.title}
            </h2>
            <p className="mt-6 text-[15px] leading-[1.9] text-[var(--muted)]">
              {chapter.body}
            </p>
            {chapter.footnote !== undefined && (
              <p className="mt-6 text-sm font-semibold">{chapter.footnote}</p>
            )}
          </Chapter>
        ))}
      </div>
    </section>
  );
}

/**
 * One chapter, and the thing that tells the panel it has arrived.
 *
 * The observer band is the middle fifth of the viewport, so a chapter takes over when
 * it is genuinely the thing being read rather than when its top edge crosses the fold
 * — which on tall chapters would swap the picture far too early.
 */
function Chapter({
  index,
  onEnter,
  tone,
  children,
}: {
  index: number;
  onEnter: (index: number) => void;
  /** Drawn above the writing on narrow screens, where there is no pinned panel. */
  tone: PhotoTone;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;

    if (node === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onEnter(index);
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [index, onEnter]);

  return (
    <div
      ref={ref}
      className="flex flex-col justify-center border-b border-[var(--line)] px-6 py-16 last:border-0 sm:px-12 lg:min-h-[calc(100svh-4.5rem)] lg:px-14 lg:py-20 xl:px-20"
    >
      <div className="lg:hidden">
        <Picture
          tone={tone}
          width={1100}
          height={800}
          className="mb-8 aspect-4/3 w-full rounded-xl"
        />
      </div>
      <Reveal>{children}</Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The menu.
 *
 * Three courses as three columns on a wide screen, so the whole thing is visible at
 * once without scrolling — this design has already asked the reader to scroll through
 * four chapters, and a menu that demanded three more screens would be the point at
 * which they stopped.
 */
function Carte({ content }: { content: SampleContent }) {
  return (
    <Band id="menu" tone="sand">
      <header className="max-w-2xl">
        <Kicker>The menu</Kicker>
        <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.06]">
          What we are cooking
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
          It changes with the market. There is a set menu at{" "}
          <span className="tabular font-semibold text-[var(--ink)]">
            {content.tasting.price}
          </span>{" "}
          for the whole table.
        </p>
      </header>

      <div className="mt-12 grid gap-x-10 gap-y-12 lg:grid-cols-3">
        {content.courses.map((course) => (
          <section key={course.name}>
            <div className="flex items-baseline gap-3 border-b border-[var(--ink)]/15 pb-3">
              <h3 className="font-display text-xl leading-none">{course.name}</h3>
            </div>

            <ul className="mt-6 flex flex-col gap-5">
              {course.lines.map((line) => (
                <li key={line.name}>
                  <div className="flex items-baseline gap-3">
                    <h4 className="min-w-0 text-[15px] font-semibold">{line.name}</h4>
                    <span
                      className="h-px min-w-4 flex-1 translate-y-[-3px] bg-[var(--ink)]/12"
                      aria-hidden="true"
                    />
                    <span className="tabular shrink-0 text-sm font-semibold text-[var(--brass)]">
                      {line.price}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                    {line.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Band>
  );
}

/**
 * A full-bleed photograph with one line over it.
 *
 * The page has been split down the middle for most of its length; this is the moment
 * it opens out. One picture, edge to edge, and the shortest sentence on the page.
 */
function Interlude({ content }: { content: SampleContent }) {
  const quote = content.quotes[0];

  return (
    <section className="relative isolate flex min-h-[26rem] items-center overflow-hidden sm:min-h-[32rem]">
      <Picture tone="plated" width={2200} height={1200} fill />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgb(16 22 30 / 0.88) 0%, rgb(16 22 30 / 0.6) 55%, rgb(16 22 30 / 0.3) 100%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-12 lg:px-14 xl:px-20">
        <figure className="max-w-2xl">
          <blockquote className="font-display text-[clamp(1.6rem,3.2vw,2.75rem)] leading-[1.18] text-balance text-[var(--paper)]">
            &ldquo;{quote?.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-7 text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--brass)] uppercase">
            {quote?.author}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** The room, as a clean three-across grid. No tricks; the pictures are the point. */
function Gallery({ content }: { content: SampleContent }) {
  return (
    <Band id="gallery">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>The room</Kicker>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.06]">
            A look inside
          </h2>
        </div>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {content.gallery.slice(0, 3).map((shot) => (
          <figure key={shot.caption} className="flex flex-col gap-3">
            <Picture
              tone={shot.photo}
              width={900}
              height={1100}
              className="aspect-4/5 w-full rounded-xl"
            />
            <figcaption className="text-xs text-[var(--muted)]">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </Band>
  );
}

/** Where it is, when it opens, how to reach it — on the navy, to close the page. */
function Visit({
  restaurant,
  content,
  where,
}: {
  restaurant: Restaurant;
  content: SampleContent;
  where: string;
}) {
  return (
    <section
      id="visit"
      style={{ backgroundColor: "var(--navy)", color: "var(--paper)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-14 xl:px-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.22em] text-[var(--brass)] uppercase">
              <span className="h-0.5 w-6 rounded-full bg-[var(--brass)]" aria-hidden="true" />
              Visit
            </p>
            <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.06]">
              Come and eat
            </h2>

            <dl className="mt-9 flex flex-col gap-6">
              {where !== "" && (
                <Fact icon={MapPin} label="Where">
                  {where}
                </Fact>
              )}
              {restaurant.contactPhone !== null &&
                restaurant.contactPhone.trim() !== "" && (
                  <Fact icon={Phone} label="Telephone">
                    <a
                      href={`tel:${restaurant.contactPhone}`}
                      className="underline decoration-[var(--paper)]/25 underline-offset-4 transition-colors hover:text-[var(--brass)]"
                    >
                      {restaurant.contactPhone}
                    </a>
                  </Fact>
                )}
              {restaurant.contactEmail !== null &&
                restaurant.contactEmail.trim() !== "" && (
                  <Fact icon={Mail} label="Email">
                    <a
                      href={`mailto:${restaurant.contactEmail}`}
                      className="break-all underline decoration-[var(--paper)]/25 underline-offset-4 transition-colors hover:text-[var(--brass)]"
                    >
                      {restaurant.contactEmail}
                    </a>
                  </Fact>
                )}
            </dl>
          </div>

          <div className="lg:col-span-7">
            <h3 className="inline-flex items-center gap-2 text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--paper)]/55 uppercase">
              <Clock className="size-3.5 text-[var(--brass)]" aria-hidden="true" />
              Opening hours
            </h3>

            <dl className="mt-6 flex flex-col">
              {content.hours.map((row) => (
                <div
                  key={row.days}
                  className="flex items-baseline gap-4 border-b border-[var(--paper)]/12 py-4 first:border-t"
                >
                  <dt className="font-display min-w-0 flex-1 text-lg">{row.days}</dt>
                  <dd
                    className={cn(
                      "tabular shrink-0 text-sm",
                      row.time.toLowerCase() === "closed"
                        ? "text-[var(--paper)]/40"
                        : "font-semibold",
                    )}
                  >
                    {row.time}
                  </dd>
                </div>
              ))}
            </dl>

            <a
              href={`tel:${restaurant.contactPhone ?? ""}`}
              className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-[var(--brass)] px-7 py-3.5 text-sm font-semibold text-[var(--navy)] transition-transform hover:scale-[1.03]"
            >
              Reserve a table
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The last line. */
function Footer({
  restaurant,
  content,
  where,
}: {
  restaurant: Restaurant;
  content: SampleContent;
  where: string;
}) {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-12 lg:px-14 xl:px-20">
        <span className="font-display text-lg leading-none">{restaurant.name}</span>
        <span className="text-xs text-[var(--muted)]">
          {where !== "" ? `${where} · ` : ""}Est. {content.heritage.since}
        </span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/** A band of the page. One rhythm, so the sections cannot drift apart. */
function Band({
  id,
  tone = "paper",
  children,
}: {
  id?: string;
  tone?: "paper" | "sand";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{ backgroundColor: tone === "sand" ? "var(--sand)" : "var(--paper)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-12 sm:py-24 lg:px-14 xl:px-20">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}

/** The small line above a heading. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.22em] text-[var(--brass)] uppercase">
      <span className="h-0.5 w-6 rounded-full bg-[var(--brass)]" aria-hidden="true" />
      {children}
    </p>
  );
}

/** One fact from the restaurant's record, on the navy. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--paper)]/10 text-[var(--brass)]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--paper)]/45 uppercase">
          {label}
        </dt>
        <dd className="mt-1 text-[15px] leading-relaxed">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Where a photograph goes.
 *
 * Positioned against the frame rather than laid inside it, so a source returning
 * something smaller than requested cannot leave the ground showing round it. The warm
 * gradient underneath shows while it loads and remains if it never arrives; an image
 * that errors hides itself for the same reason.
 *
 * FILL IS A PROP, NOT A CLASS, and that is the whole reason this page had three blank
 * halves. A picture that has to cover its parent needs `absolute inset-0`, and a
 * caller passing that in className loses: Tailwind emits `relative` after `absolute`,
 * so the frame's own rule wins, the box collapses to nothing in the flow, and the
 * photograph is simply not there. `cn` is a join with no notion of conflicts, so
 * nothing catches it. Naming the two modes means the component sets one position and
 * a caller cannot contradict it.
 */
function Picture({
  tone,
  width,
  height,
  className,
  fill = false,
  priority = false,
}: {
  tone: PhotoTone;
  width: number;
  height: number;
  className?: string;
  /** Cover the nearest positioned ancestor, rather than taking a size of its own. */
  fill?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden",
        fill ? "absolute inset-0" : "relative",
        className,
      )}
      style={{ backgroundImage: PHOTO_GROUND[tone], backgroundSize: "cover" }}
    >
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(tone, width, height)}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 block h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** A band arriving as it is scrolled to. Once, and gently. */
function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -15% 0px" }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
