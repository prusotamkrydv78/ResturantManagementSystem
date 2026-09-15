"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";
import { GRAIN, PHOTO_GROUND, photoUrl, type PhotoTone } from "@/features/website/photos";
import type { Restaurant } from "@/types/restaurant";

/**
 * Aurora — the photography-first restaurant page.
 *
 * TWO SOURCES, KEPT APART
 *
 * The restaurant's own record supplies the facts: the name, the address, the two ways
 * to reach it. Everything else is sample copy, and every screen that shows this page
 * says so. A landing page needs a headline, a menu and opening hours long before a
 * manager has written any, and a wireframe with their own name in the corner tells
 * them nothing about the design.
 *
 * WHAT MAKES IT LOOK LIKE A RESTAURANT RATHER THAN A PRODUCT PAGE
 *
 * Three things, and they are the whole difference between this and the first attempt.
 *
 * A display serif carries every heading. The application is set in Inter, which is
 * right for a dense table and wrong for a dining room; a landing page set in the same
 * geometric sans as its admin panel looks like software no matter what else is done
 * to it.
 *
 * The type scale is violent rather than polite. A 64px headline against 15px body is
 * what makes a page feel composed; a tidy ladder of sizes two steps apart is what
 * makes it feel like a form.
 *
 * And the page is built out of full-bleed bands that alternate ground — paper, dark,
 * photograph — instead of a single column of cards on one background. A restaurant
 * page is a sequence of rooms, not a list.
 *
 * ITS OWN PALETTE
 *
 * None of the application's tokens. A restaurant's website should not look like the
 * software that built it, and the admin area's palette would otherwise follow this
 * page around. Everything is declared on the root element below, which is also where
 * a manager-chosen accent will eventually be written.
 */

export function AuroraTemplate({
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
    <div
      className={cn(
        "aurora site-page selection:bg-[var(--accent)] selection:text-white",
        "[--accent:#b8543a] [--accent-soft:#e8d9cf] [--ink:#181310] [--muted:#6d6157]",
        "[--site-focus:#b8543a]",
        "[--night:#141010] [--paper:#faf6f1] [--sand:#f0e8de]",
      )}
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      <Hero restaurant={restaurant} content={content} />
      <Marquee items={content.accolades} />
      <Story content={content} />
      <Menu content={content} />
      <Spotlight content={content} />
      <Reasons content={content} />
      <Gallery content={content} />
      <Quote content={content} />
      <Visit restaurant={restaurant} content={content} where={where} />
      <Footer restaurant={restaurant} content={content} where={where} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The first screen                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A full-height photograph with the name over it.
 *
 * Full height rather than a banner, because this design's argument is the room and
 * the food, and an image cropped to 400px is an illustration rather than an argument.
 *
 * The restaurant's name is set enormous and the headline sits under it at a fraction
 * of the size — the reverse of the usual arrangement. On a restaurant page the name
 * IS the headline: somebody arriving from a search already knows they want dinner and
 * is deciding whether they want it here.
 */
function Hero({
  restaurant,
  content,
}: {
  restaurant: Restaurant;
  content: SampleContent;
}) {
  return (
    <section className="relative isolate flex min-h-svh flex-col">
      {/* Wrapped rather than given `absolute inset-0` directly.
 
          Both Photo and Slideshow declare `relative` on themselves, because the image
          inside is positioned against them. Tailwind emits `relative` after
          `absolute`, so a caller passing `absolute inset-0` in className loses: the
          class is present and the later rule wins, the frame collapses to nothing in
          the flow, and the hero renders with no picture at all. A positioned wrapper
          keeps both rules where they belong. */}
      <div className="absolute inset-0">
        <Slideshow
          tones={["room", "pass", "fire", "plated"]}
          width={2400}
          height={1600}
          className="h-full w-full"
        />
      </div>

      {/* Two washes, and both had to get heavier.

          The first attempt read the photograph as a dark image and it is not: a dining
          room shot at lunchtime is mostly bright plaster and windows, and white nav
          links at 65% over that were invisible. The top band is now dark enough to
          carry small type over the brightest picture the source is likely to return,
          which is the only width this has to work at.

          Still two bands rather than one flat overlay: a single wash dark enough for
          the corners drowns the middle of the picture, which is the part worth
          looking at. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(10 7 6 / 0.72) 0%, rgb(10 7 6 / 0.28) 22%, rgb(10 7 6 / 0.20) 40%, rgb(10 7 6 / 0.88) 90%, rgb(10 7 6 / 0.94) 100%)",
        }}
      />
      <Grain />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-7">
        <span className="font-display text-base tracking-[0.22em] text-white uppercase drop-shadow-[0_1px_8px_rgb(0_0_0/0.6)]">
          {restaurant.name}
        </span>

        {/* Full white with a shadow under it, not a tint of white.

            Navigation over a photograph is the one place on a page where the
            background cannot be predicted, so it cannot be dimmed and left to luck.
            The underline appears on hover rather than the colour changing, because
            there is no colour above white to change to. */}
        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-[0.16em] text-white uppercase underline decoration-transparent decoration-1 underline-offset-[6px] drop-shadow-[0_1px_8px_rgb(0_0_0/0.7)] transition-colors hover:decoration-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#visit"
          className="rounded-full border border-white/70 bg-black/25 px-5 py-2 text-xs font-medium tracking-[0.14em] text-white uppercase backdrop-blur-sm transition-colors hover:bg-white hover:text-[var(--ink)]"
        >
          Book
        </a>
      </header>

      <div className="relative z-10 mx-auto mt-auto w-full max-w-6xl px-6 pb-16">
        <p className="text-[0.7rem] font-medium tracking-[0.3em] text-white/75 uppercase">
          {content.eyebrow}
        </p>

        <h1 className="font-display mt-5 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] font-normal text-balance text-white">
          {restaurant.name}
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
          {content.headline}. {content.standfirst}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
          <a
            href="#visit"
            className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--accent)] px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#a04830]"
          >
            Reserve a table
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
          {/* A bordered button rather than an underlined link. The secondary action
              beside a filled one still has to be findable, and a tint of white on an
              unpredictable photograph is the first thing to disappear. */}
          <a
            href="#menu"
            className="rounded-full border border-white/45 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink)]"
          >
            Read the menu
          </a>

          {restaurant.city !== null && restaurant.city.trim() !== "" && (
            <span className="ml-auto hidden items-center gap-2 text-sm text-white/75 sm:inline-flex">
              <MapPin className="size-4" aria-hidden="true" />
              {restaurant.city}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

const NAV = [
  { label: "Menu", href: "#menu" },
  { label: "The room", href: "#gallery" },
  { label: "Visit", href: "#visit" },
];

/** Accolades, running across a thin dark rule. Small, and read in passing. */
function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative isolate overflow-hidden" style={{ backgroundColor: "var(--night)" }}>
      <Grain />
      <ul className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-2 px-6 py-5">
        {items.map((item) => (
          <li
            key={item}
            className="text-[0.7rem] font-medium tracking-[0.2em] text-white/45 uppercase"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The writing, with a tall picture beside it.
 *
 * Asymmetric on purpose: a 50/50 split of text and image is the most common band on
 * the internet and reads as a slide. The text column is narrower than the picture and
 * sits low against it, which is what a magazine spread does.
 */
function Story({ content }: { content: SampleContent }) {
  return (
    <Band>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5 lg:pt-8">
          <Kicker>Who we are</Kicker>
          <h2 className="font-display mt-6 text-[clamp(2rem,3.6vw,3rem)] leading-[1.06] text-balance">
            {content.story.title}
          </h2>
          <div className="mt-7 flex flex-col gap-5">
            {content.story.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-[15px] leading-[1.75] text-[var(--muted)]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <Slideshow
            tones={["pass", "room", "greens"]}
            width={1400}
            height={1000}
            className="aspect-4/3 w-full rounded-[2px]"
          />
          <p className="mt-3 text-xs tracking-wide text-[var(--muted)]">
            The pass, a little before service.
          </p>
        </div>
      </div>
    </Band>
  );
}

/**
 * The menu, set as a bill of fare rather than as a grid of product cards.
 *
 * Name and price on one line with a rule running between them: it is how a menu is
 * printed, it is instantly recognisable as one, and it survives a long dish name and
 * a short one equally. Two photographs sit alongside rather than one per dish —
 * four little pictures in a row turn a menu into a shopping page.
 */
function Menu({ content }: { content: SampleContent }) {
  return (
    <Band id="menu" tone="sand">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <Kicker>The menu</Kicker>
          <h2 className="font-display mt-6 text-[clamp(2rem,3.6vw,3rem)] leading-[1.06]">
            Signature dishes
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            It changes most days, because the market does. These are the ones that
            keep coming back.
          </p>

          <ul className="mt-10 flex flex-col">
            {content.dishes.map((dish) => (
              <li
                key={dish.name}
                className="border-t border-[var(--ink)]/10 py-6 last:border-b"
              >
                <div className="flex items-baseline gap-4">
                  <h3 className="font-display shrink-0 text-xl leading-none">
                    {dish.name}
                  </h3>
                  <span
                    className="h-px min-w-6 flex-1 translate-y-[-3px] bg-[var(--ink)]/15"
                    aria-hidden="true"
                  />
                  <span className="tabular shrink-0 text-base font-medium text-[var(--accent)]">
                    {dish.price}
                  </span>
                </div>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
                  {dish.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Two pictures, stacked and offset. The lower one is pushed down so the pair
            reads as a hand of photographs rather than as a column. */}
        <div className="flex flex-col gap-6 lg:col-span-5 lg:pt-16">
          <Photo
            tone="fire"
            width={1000}
            height={1250}
            className="aspect-4/5 w-full rounded-[2px]"
          />
          <Photo
            tone="greens"
            width={1000}
            height={800}
            className="aspect-5/4 w-full rounded-[2px] lg:ml-10"
          />
        </div>
      </div>
    </Band>
  );
}

/**
 * One dish, given the whole width and a dark ground.
 *
 * The page needs a moment where a photograph is the only thing happening. Everywhere
 * else the pictures are in service of words; here it is the other way round.
 */
function Spotlight({ content }: { content: SampleContent }) {
  const { spotlight } = content;

  return (
    <section
      className="relative isolate overflow-hidden"
      style={{ backgroundColor: "var(--night)" }}
    >
      <div className="grid lg:grid-cols-2">
        <Slideshow
          tones={["plated", "fire", "dessert"]}
          width={1600}
          height={1400}
          className="aspect-4/3 w-full lg:aspect-auto lg:h-full lg:min-h-[34rem]"
        />

        <div className="relative flex items-center px-6 py-16 sm:px-12 lg:py-24">
          <Grain />
          <div className="relative max-w-md">
            <Kicker tone="dark">{spotlight.eyebrow}</Kicker>
            <h2 className="font-display mt-6 text-[clamp(2rem,3.4vw,2.75rem)] leading-[1.08] text-white">
              {spotlight.name}
            </h2>
            <p className="mt-6 text-[15px] leading-[1.8] text-white/60">
              {spotlight.description}
            </p>
            <p className="tabular mt-8 text-lg font-medium text-[var(--accent-soft)]">
              {spotlight.price}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Three reasons, as numbered columns on paper. Type only — the page needs a rest. */
function Reasons({ content }: { content: SampleContent }) {
  return (
    <Band>
      <div className="grid gap-10 sm:grid-cols-3 sm:gap-12">
        {content.reasons.map((reason, index) => (
          <div key={reason.title} className="flex flex-col">
            <span className="font-display tabular text-3xl text-[var(--accent)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className="mt-5 h-px w-10 bg-[var(--ink)]/20"
              aria-hidden="true"
            />
            <h3 className="font-display mt-5 text-xl leading-snug">{reason.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {reason.body}
            </p>
          </div>
        ))}
      </div>
    </Band>
  );
}

/**
 * The room, as a mosaic.
 *
 * Deliberately not a grid of equal squares, which reads as a contact sheet. One
 * picture takes half the width and full height, and the rest fall in beside it at
 * different shapes, so the eye has somewhere to start and something to do afterwards.
 */
function Gallery({ content }: { content: SampleContent }) {
  const [lead, ...rest] = content.gallery;

  return (
    <Band id="gallery" tone="sand">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>The room</Kicker>
          <h2 className="font-display mt-6 text-[clamp(2rem,3.6vw,3rem)] leading-[1.06]">
            A look inside
          </h2>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-4 sm:grid-rows-2">
        {lead !== undefined && (
          <Shot shot={lead} width={1400} height={1600} className="sm:col-span-2 sm:row-span-2" />
        )}
        {rest.slice(0, 4).map((shot) => (
          <Shot key={shot.caption} shot={shot} width={900} height={700} />
        ))}
      </div>
    </Band>
  );
}

function Shot({
  shot,
  width,
  height,
  className,
}: {
  shot: SampleContent["gallery"][number];
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <figure className={cn("group relative overflow-hidden rounded-[2px]", className)}>
      <Photo
        tone={shot.photo}
        width={width}
        height={height}
        className="h-full min-h-40 w-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
      />
      <figcaption className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/75 to-transparent p-4 text-xs font-medium tracking-wide text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        {shot.caption}
      </figcaption>
    </figure>
  );
}

/**
 * One quotation, set large.
 *
 * One rather than a row of three. A wall of praise reads as advertising and gets
 * skipped; a single line given real size gets read.
 */
function Quote({ content }: { content: SampleContent }) {
  const quote = content.quotes[0];

  if (quote === undefined) {
    return null;
  }

  return (
    <Band>
      <figure className="mx-auto max-w-3xl text-center">
        <span className="font-display block text-5xl leading-none text-[var(--accent)]/35">
          &ldquo;
        </span>
        <blockquote className="font-display mt-2 text-[clamp(1.5rem,2.8vw,2.25rem)] leading-[1.3] text-balance">
          {quote.quote}
        </blockquote>
        <figcaption className="mt-7 text-[0.7rem] font-medium tracking-[0.2em] text-[var(--muted)] uppercase">
          {quote.author}
        </figcaption>
      </figure>
    </Band>
  );
}

/**
 * Where the restaurant is and how to reach it.
 *
 * Everything in the left column comes from the restaurant's own record. It is the one
 * part of this page that is already true, and it is also the part a visitor came for.
 */
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
    <Band id="visit" tone="sand">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Kicker>Find us</Kicker>
          <h2 className="font-display mt-6 text-[clamp(2rem,3.6vw,3rem)] leading-[1.06]">
            Come and eat
          </h2>

          <dl className="mt-9 flex flex-col">
            {where !== "" && (
              <Fact icon={MapPin} label="Address">
                {where}
              </Fact>
            )}
            {restaurant.contactPhone !== null && restaurant.contactPhone.trim() !== "" && (
              <Fact icon={Phone} label="Telephone">
                <a
                  href={`tel:${restaurant.contactPhone}`}
                  className="underline decoration-[var(--ink)]/20 underline-offset-4 transition-colors hover:text-[var(--accent)]"
                >
                  {restaurant.contactPhone}
                </a>
              </Fact>
            )}
            {restaurant.contactEmail !== null && restaurant.contactEmail.trim() !== "" && (
              <Fact icon={Mail} label="Email">
                <a
                  href={`mailto:${restaurant.contactEmail}`}
                  className="underline decoration-[var(--ink)]/20 underline-offset-4 transition-colors hover:text-[var(--accent)]"
                >
                  {restaurant.contactEmail}
                </a>
              </Fact>
            )}
          </dl>

          <a
            href={`tel:${restaurant.contactPhone ?? ""}`}
            className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-[var(--ink)] px-7 py-3.5 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--accent)]"
          >
            Reserve a table
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>

        <div className="lg:col-span-7">
          <div className="border-t border-[var(--ink)]/10 pt-6">
            <h3 className="inline-flex items-center gap-2 text-[0.7rem] font-medium tracking-[0.2em] text-[var(--muted)] uppercase">
              <Clock className="size-3.5" aria-hidden="true" />
              Opening hours
            </h3>

            <dl className="mt-5 flex flex-col">
              {content.hours.map((row) => (
                <div
                  key={row.days}
                  className="flex items-baseline gap-4 border-b border-[var(--ink)]/10 py-4"
                >
                  <dt className="font-display shrink-0 text-lg">{row.days}</dt>
                  <span
                    className="h-px min-w-6 flex-1 translate-y-[-2px] bg-[var(--ink)]/12"
                    aria-hidden="true"
                  />
                  <dd
                    className={cn(
                      "tabular shrink-0 text-sm",
                      row.time.toLowerCase() === "closed"
                        ? "text-[var(--muted)]"
                        : "font-medium",
                    )}
                  >
                    {row.time}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </Band>
  );
}

/**
 * The closing invitation and the small print, as one dark band.
 *
 * Joined rather than stacked as two sections. A call to action followed by a separate
 * footer is two endings, and the second one always looks like an afterthought.
 */
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
    <footer
      className="relative isolate overflow-hidden"
      style={{ backgroundColor: "var(--night)" }}
    >
      <Grain />

      <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-display max-w-2xl text-[clamp(2rem,4vw,3.25rem)] leading-[1.06] text-balance text-white">
            {content.closing.title}
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
            {content.closing.body}
          </p>
          <a
            href="#visit"
            className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-[var(--paper)] px-7 py-3.5 text-sm font-medium text-[var(--ink)] transition-transform hover:scale-[1.02]"
          >
            Reserve a table
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>

        <div className="mt-20 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-sm tracking-[0.22em] text-white/80 uppercase">
            {restaurant.name}
          </span>
          {where !== "" && (
            <span className="text-xs text-white/35">{where}</span>
          )}
        </div>
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
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24 lg:py-32">{children}</div>
    </section>
  );
}

/** The small line above a heading, with a rule leading into it. */
function Kicker({
  tone = "light",
  children,
}: {
  tone?: "light" | "dark";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-[0.7rem] font-medium tracking-[0.24em] uppercase",
        tone === "dark" ? "text-[var(--accent-soft)]" : "text-[var(--accent)]",
      )}
    >
      <span
        className={cn(
          "h-px w-7",
          tone === "dark" ? "bg-[var(--accent-soft)]/50" : "bg-[var(--accent)]/50",
        )}
        aria-hidden="true"
      />
      {children}
    </p>
  );
}

/** One fact from the restaurant's record. */
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
    <div className="flex items-start gap-4 border-b border-[var(--ink)]/10 py-5 first:border-t">
      <Icon className="mt-1 size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[0.7rem] font-medium tracking-[0.2em] text-[var(--muted)] uppercase">
          {label}
        </dt>
        <dd className="mt-1.5 text-[15px] leading-relaxed">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Where a photograph goes.
 *
 * The image is positioned against the frame rather than laid in it, which is the
 * thing that was wrong the first time: an `img` sized with height:100% inside a box
 * whose own height comes from an aspect ratio will, if the source returns something
 * smaller than it was asked for, sit at its natural size in the middle and leave the
 * ground showing round it as a coloured slab. Absolute inset-0 cannot do that — the
 * picture is the frame, and object-cover decides what is lost.
 *
 * The ground underneath shows through while the image loads and remains if it never
 * arrives, so a page with no network degrades to the composition it had rather than
 * to broken-image icons. A picture that errors hides itself for the same reason. The
 * img carries no alt text because it is decoration: the section around it already
 * says what is being shown.
 *
 * Plain img rather than next/image: these are demonstration pictures from one host at
 * sizes this file already knows, and the optimiser would add build configuration and
 * a runtime hop for no benefit a preview can use.
 */
function Photo({
  tone,
  width,
  height,
  className,
  priority = false,
}: {
  tone: PhotoTone;
  /** What to ask the source for. Roughly twice the painted size. */
  width: number;
  height: number;
  className?: string;
  /** The hero, which should not wait for anything above it. */
  priority?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundImage: PHOTO_GROUND[tone], backgroundSize: "cover" }}
    >
      <Frame tone={tone} width={width} height={height} priority={priority} />
    </div>
  );
}

/**
 * The picture itself, filling whatever it is put inside.
 *
 * Separated from the frame so the slideshow below can stack several of them in one
 * box and fade between them without repeating the positioning rules.
 */
function Frame({
  tone,
  width,
  height,
  priority = false,
}: {
  tone: PhotoTone;
  width: number;
  height: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(tone, width, height)}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 block h-full w-full object-cover"
    />
  );
}

/**
 * Several photographs in one frame, fading from one to the next.
 *
 * On a page whose argument is the room and the food, one still picture per slot shows
 * a quarter of what a restaurant has to show. A slow crossfade puts the rest of it on
 * screen without asking anybody to click anything, and it is the one piece of motion
 * on the page: everything else here is still, so this reads as the room breathing
 * rather than as a carousel demanding attention.
 *
 * Slow on purpose. Six seconds a picture and a second and a half to cross, which is
 * long enough that somebody reading the paragraph beside it is never interrupted —
 * the moment a fade is quick enough to notice mid-sentence it stops being atmosphere
 * and becomes a distraction.
 *
 * Honours a reduced-motion preference by not running at all: the first picture is
 * shown and left alone, which is a complete page rather than a degraded one.
 */
function Slideshow({
  tones,
  width,
  height,
  className,
  holdMs = 6000,
}: {
  tones: PhotoTone[];
  width: number;
  height: number;
  className?: string;
  holdMs?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced === true || tones.length < 2) {
      return;
    }

    const timer = setInterval(
      () => setShown((current) => (current + 1) % tones.length),
      holdMs,
    );

    return () => clearInterval(timer);
  }, [reduced, tones.length, holdMs]);

  return (
    <div aria-hidden="true" className={cn("relative overflow-hidden", className)}>
      {tones.map((tone, index) => (
        <div
          key={tone}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{
            backgroundImage: PHOTO_GROUND[tone],
            backgroundSize: "cover",
            opacity: index === shown ? 1 : 0,
          }}
        >
          {/* Only the first is eager. The rest have six seconds before anybody needs
              them, and loading four photographs at once to show one is how a hero
              ends up slower than the page under it. */}
          <Frame
            tone={tone}
            width={width}
            height={height}
            priority={index === 0}
          />
        </div>
      ))}
    </div>
  );
}

/** A fine noise, so a large dark area reads as a surface rather than a swatch. */
function Grain() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}
