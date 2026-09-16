"use client";

import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";
import { photoGround, photoSrc, type PhotoRef } from "@/features/website/photos";
import type { Restaurant } from "@/types/restaurant";

/**
 * Harvest — the bistro page, loud and confident.
 *
 * This replaces a design that did not work, and the reason is worth keeping. The one
 * before it hung everything on an arched photograph, and an arch is not a shape CSS
 * gives you cheaply: a fifty-per-cent top radius on a portrait box is an ellipse
 * stretched over the height of the image, not a semicircle. The whole page rested on
 * a detail that came out wrong, and a design with one idea has nowhere to go when the
 * idea fails.
 *
 * So this one is built on three, none of which depends on a shape being exact.
 *
 * TYPE AGAINST THE PICTURE, NOT UNDER IT. The opening headline runs across the
 * photograph rather than sitting above or beside it. Aurora puts white type on a dark
 * image and Slate puts type on black; this sets near-black type on cream and lets the
 * picture come in from the right behind the last line of it. The overlap is the
 * composition.
 *
 * A RUNNING STRIP. The accolades scroll, slowly, in solid colour across the full
 * width. It is the only page of the three with anything moving in its body, and that
 * is the point: this restaurant is busy and says so.
 *
 * ONE SECTION BLOCKED OUT. The chef's line is set in cream on solid olive, full
 * bleed, at the size of a poster. On a pale page a single block of saturated colour
 * does more than ten sections of careful grey.
 *
 * TWO SOURCES, KEPT APART
 *
 * The restaurant's record supplies the name, the address and the two ways to reach
 * it. Everything else is sample copy, and every screen that shows this page says so.
 */

export function HarvestTemplate({
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
          "harvest site-page selection:bg-[var(--olive)] selection:text-[var(--paper)]",
          "[--ink:#1b1a16] [--line:#ddd7c8] [--muted:#6b6759] [--olive:#4f5d3a]",
          "[--paper:#f4f1e8] [--sand:#eae5d8] [--site-focus:#4f5d3a]",
        )}
        style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
      >
        <Masthead restaurant={restaurant} />
        <Opening restaurant={restaurant} content={content} />
        <Ticker items={content.accolades} />
        <Larder content={content} />
        <Carte content={content} />
        <Statement content={content} />
        <Gallery content={content} />
        <Celebrations content={content} />
        <Visit restaurant={restaurant} content={content} where={where} />
        <Footer restaurant={restaurant} where={where} />
      </div>
    </MotionConfig>
  );
}

const NAV = [
  { label: "Menu", href: "#menu" },
  { label: "The room", href: "#gallery" },
  { label: "Parties", href: "#celebrations" },
  { label: "Visit", href: "#visit" },
];

/* -------------------------------------------------------------------------- */
/* Chrome                                                                     */
/* -------------------------------------------------------------------------- */

/** Name left, links right, one solid button. Sticky, opaque, out of the way. */
function Masthead({ restaurant }: { restaurant: Restaurant }) {
  return (
    <header
      id="top"
      className="sticky top-0 z-30 border-b border-[var(--line)]"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <a href="#top" className="font-display text-lg leading-none sm:text-xl">
          {restaurant.name}
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--muted)] uppercase transition-colors hover:text-[var(--olive)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#visit"
          className="shrink-0 rounded-full bg-[var(--olive)] px-5 py-2.5 text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--paper)] uppercase transition-transform hover:scale-[1.04]"
        >
          Book
        </a>
      </div>
    </header>
  );
}

/**
 * The opening: type across the picture.
 *
 * The headline is set in four lines at the largest size on the page, and the
 * photograph enters from the right behind the lower half of it. Nothing is stacked —
 * they occupy the same rows of the grid, and the overlap is what makes the screen
 * read as composed rather than as a header followed by an image.
 */
function Opening({
  restaurant,
  content,
}: {
  restaurant: Restaurant;
  content: SampleContent;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <div className="relative grid items-center gap-8 lg:grid-cols-12">
          {/* The picture first in the DOM but placed to the right, so a phone gets
              the photograph at the top where it belongs and a desktop gets it behind
              the type. */}
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1">
            <Picture
              tone="greens"
              width={1400}
              height={1100}
              priority
              className="aspect-4/3 w-full rounded-2xl lg:aspect-5/4"
            />
          </div>

          <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:pr-4">
            <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-[var(--olive)] uppercase">
              {content.eyebrow}
            </p>

            <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,5rem)] leading-[0.94] text-balance">
              {content.headline}
            </h1>

            {/* The panel behind the paragraph is what makes the overlap legible. It
                is the page colour, not a tint, so it reads as the type sitting in
                front of the picture rather than as a box laid on top of it. */}
            <div
              className="mt-7 max-w-lg rounded-2xl p-6 lg:-mr-4"
              style={{ backgroundColor: "var(--paper)" }}
            >
              <p className="text-[15px] leading-[1.8] text-[var(--muted)]">
                {content.standfirst}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#visit"
                  className="group inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--paper)] transition-colors hover:bg-[var(--olive)]"
                >
                  Book a table
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
                <a
                  href="#menu"
                  className="rounded-full border border-[var(--line)] px-6 py-3 text-sm font-semibold transition-colors hover:border-[var(--olive)] hover:text-[var(--olive)]"
                >
                  The menu
                </a>
              </div>
            </div>

            {restaurant.city !== null && restaurant.city.trim() !== "" && (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                <MapPin className="size-4 text-[var(--olive)]" aria-hidden="true" />
                {restaurant.city}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The accolades, running.
 *
 * Duplicated once and translated by exactly half, which is what makes the loop
 * seamless: at minus fifty per cent the second copy is sitting where the first
 * started. Slow — forty seconds for a pass — because this is atmosphere and a strip
 * that hurries is a stock ticker.
 *
 * Stops entirely for a reduced-motion preference, and then reads as a static list,
 * which is a complete thing rather than a broken one.
 */
function Ticker({ items }: { items: string[] }) {
  const run = [...items, ...items];

  return (
    <div
      className="overflow-hidden py-3.5"
      style={{ backgroundColor: "var(--olive)" }}
    >
      <motion.div
        className="flex w-max items-center gap-10 pr-10"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {run.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex shrink-0 items-center gap-10 text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--paper)] uppercase"
          >
            {item}
            <span
              className="size-1 rounded-full bg-[var(--paper)]/50"
              aria-hidden="true"
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

/** The story, with an offset pair of pictures. */
function Larder({ content }: { content: SampleContent }) {
  return (
    <Band>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <Kicker>Who we are</Kicker>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05] text-balance">
            {content.story.title}
          </h2>
          <div className="mt-6 flex flex-col gap-4">
            {content.story.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-[15px] leading-[1.8] text-[var(--muted)]"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <dl className="mt-9 grid grid-cols-2 gap-6 border-t border-[var(--line)] pt-7">
            {content.heritage.facts.slice(0, 2).map((fact) => (
              <div key={fact.label}>
                <dd className="font-display tabular text-3xl leading-none text-[var(--olive)]">
                  {fact.value}
                </dd>
                <dt className="mt-2 text-[0.65rem] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
                  {fact.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* Offset rather than stacked. Two pictures of the same size in a column is a
            list; one pushed down against the other is a pair. */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-7 lg:gap-5">
          <Picture
            tone="room"
            width={800}
            height={1000}
            className="aspect-4/5 w-full rounded-2xl"
          />
          <Picture
            tone="fire"
            width={800}
            height={1000}
            className="aspect-4/5 w-full rounded-2xl lg:mt-14"
          />
        </div>
      </div>
    </Band>
  );
}

/**
 * The menu, with the course number set very large behind the heading.
 *
 * The numeral is outlined rather than filled — the eye reads it as ornament and skips
 * to the words, which is what you want from something at six times the body size. It
 * also gives the section a left edge to hang off without drawing a rule.
 */
function Carte({ content }: { content: SampleContent }) {
  return (
    <Band id="menu" tone="sand">
      <header className="max-w-2xl">
        <Kicker>The menu</Kicker>
        <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05]">
          What we are cooking
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
          It changes with the market. Ask us what is good today and we will tell you
          honestly.
        </p>
      </header>

      <div className="mt-14 flex flex-col gap-14">
        {content.courses.map((course, index) => (
          <section key={course.name}>
            <div className="flex items-end gap-5">
              <span
                aria-hidden="true"
                className="font-display shrink-0 text-[3.5rem] leading-[0.75] text-transparent select-none sm:text-[4.5rem]"
                style={{ WebkitTextStroke: "1px var(--olive)" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 pb-1">
                <h3 className="font-display text-2xl leading-none">{course.name}</h3>
                {course.note !== "" && (
                  <p className="mt-2 text-sm text-[var(--muted)]">{course.note}</p>
                )}
              </div>
            </div>

            <ul className="mt-8 grid gap-x-12 gap-y-6 md:grid-cols-2">
              {course.lines.map((line) => (
                <li key={line.name} className="border-t border-[var(--line)] pt-4">
                  <div className="flex items-baseline gap-3">
                    <h4 className="min-w-0 text-base font-semibold">{line.name}</h4>
                    <span
                      className="h-px min-w-4 flex-1 translate-y-[-3px] bg-[var(--line)]"
                      aria-hidden="true"
                    />
                    <span className="tabular shrink-0 text-sm font-semibold text-[var(--olive)]">
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
 * The chef, blocked out in solid colour at poster size.
 *
 * The one full-bleed saturated band on the page, and the reason the rest of it can
 * stay quiet. A pale page needs exactly one moment of loud, and it should be the
 * sentence the restaurant most wants remembered.
 */
function Statement({ content }: { content: SampleContent }) {
  const { chef } = content;

  return (
    <section style={{ backgroundColor: "var(--olive)", color: "var(--paper)" }}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-8">
            <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-[var(--paper)]/60 uppercase">
              In the kitchen
            </p>
            <blockquote className="font-display mt-6 text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.05] text-balance">
              &ldquo;{chef.quote}&rdquo;
            </blockquote>
            <p className="mt-8 text-sm">
              <span className="font-semibold">{chef.name}</span>
              <span className="text-[var(--paper)]/60"> · {chef.role}</span>
            </p>
          </div>

          <div className="lg:col-span-4">
            <Picture
              tone="pass"
              width={800}
              height={1000}
              className="aspect-4/5 w-full rounded-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The room, as a grid of unequal heights.
 *
 * Alternating tall and short rather than a row of identical tiles: a contact sheet is
 * what you get when every picture is the same shape, and this page is not filing
 * photographs, it is showing off.
 */
function Gallery({ content }: { content: SampleContent }) {
  return (
    <Band id="gallery">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>The room</Kicker>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05]">
            A look inside
          </h2>
        </div>
      </header>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {content.gallery.slice(0, 4).map((shot, index) => (
          <figure key={shot.caption} className="flex flex-col gap-3">
            <Picture
              tone={shot.photo}
              width={700}
              height={900}
              className={cn(
                "w-full rounded-2xl",
                index % 2 === 0 ? "aspect-3/4" : "aspect-3/4 lg:mt-10",
              )}
            />
            <figcaption
              className={cn(
                "text-xs text-[var(--muted)]",
                index % 2 === 1 && "lg:mt-10",
              )}
            >
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </Band>
  );
}

/** What the room gets booked for. */
function Celebrations({ content }: { content: SampleContent }) {
  const { privateDining } = content;

  return (
    <Band id="celebrations" tone="sand">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          <Picture
            tone="wine"
            width={1200}
            height={900}
            className="aspect-4/3 w-full rounded-2xl"
          />
        </div>

        <div className="lg:col-span-6">
          <Kicker>Parties</Kicker>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05] text-balance">
            {privateDining.title}
          </h2>
          <p className="mt-6 text-[15px] leading-[1.8] text-[var(--muted)]">
            {privateDining.body}
          </p>
          <p className="mt-4 text-sm text-[var(--muted)]/80 italic">
            {privateDining.note}
          </p>
          <a
            href="#visit"
            className="mt-8 inline-flex rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--paper)] transition-colors hover:bg-[var(--olive)]"
          >
            Ask about a booking
          </a>
        </div>
      </div>
    </Band>
  );
}

/** Where it is, when it opens, how to reach it. */
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
    <Band id="visit">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <Kicker>Visit</Kicker>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.05]">
            Come and eat
          </h2>

          <dl className="mt-9 flex flex-col gap-6">
            {where !== "" && (
              <Fact icon={MapPin} label="Where">
                {where}
              </Fact>
            )}
            {restaurant.contactPhone !== null && restaurant.contactPhone.trim() !== "" && (
              <Fact icon={Phone} label="Telephone">
                <a
                  href={`tel:${restaurant.contactPhone}`}
                  className="underline decoration-[var(--line)] underline-offset-4 transition-colors hover:text-[var(--olive)]"
                >
                  {restaurant.contactPhone}
                </a>
              </Fact>
            )}
            {restaurant.contactEmail !== null && restaurant.contactEmail.trim() !== "" && (
              <Fact icon={Mail} label="Email">
                <a
                  href={`mailto:${restaurant.contactEmail}`}
                  className="underline decoration-[var(--line)] underline-offset-4 transition-colors hover:text-[var(--olive)]"
                >
                  {restaurant.contactEmail}
                </a>
              </Fact>
            )}
          </dl>
        </div>

        <div className="lg:col-span-7">
          <div
            className="rounded-2xl p-7 sm:p-9"
            style={{ backgroundColor: "var(--sand)" }}
          >
            <h3 className="inline-flex items-center gap-2 text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
              <Clock className="size-3.5 text-[var(--olive)]" aria-hidden="true" />
              Opening hours
            </h3>

            <dl className="mt-6 flex flex-col">
              {content.hours.map((row) => (
                <div
                  key={row.days}
                  className="flex items-baseline gap-4 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <dt className="font-display min-w-0 flex-1 text-lg">{row.days}</dt>
                  <dd
                    className={cn(
                      "tabular shrink-0 text-sm",
                      row.time.toLowerCase() === "closed"
                        ? "text-[var(--muted)]/70"
                        : "font-semibold",
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

/** The last word. */
function Footer({ restaurant, where }: { restaurant: Restaurant; where: string }) {
  return (
    <footer style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-display text-xl leading-none">{restaurant.name}</span>
        {where !== "" && (
          <span className="text-xs text-[var(--paper)]/45">{where}</span>
        )}
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
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}

/** The small line above a heading. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.22em] text-[var(--olive)] uppercase">
      <span className="h-0.5 w-6 rounded-full bg-[var(--olive)]" aria-hidden="true" />
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
    <div className="flex items-start gap-3.5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--sand)] text-[var(--olive)]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
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
 * Rounded generously and squarely — a plain large radius, not a shape. The design
 * this replaced tried to make an arch out of a border radius and got an ellipse.
 */
function Picture({
  tone,
  width,
  height,
  className,
  priority = false,
}: {
  tone: PhotoRef;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundImage: photoGround(tone), backgroundSize: "cover" }}
    >
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(tone, width, height)}
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
