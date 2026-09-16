"use client";

import { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sampleContent, type SampleContent } from "@/features/website/sample-content";
import { GRAIN, photoGround, photoSrc, type PhotoRef } from "@/features/website/photos";
import type { Restaurant } from "@/types/restaurant";

/**
 * Slate — the dining-room page, dark and led by type.
 *
 * HOW IT DIFFERS FROM AURORA, WHICH IS THE WHOLE POINT
 *
 * Two designs that scroll the same way in different colours are one design with a
 * switch on it. This is built on three decisions Aurora does not make.
 *
 * The page has a SPINE rather than a masthead. On a wide screen the name, the
 * navigation and the reservation sit in a fixed column down the left, and the content
 * moves past them. A restaurant of this kind is chosen deliberately — somebody is
 * reading the menu, top to bottom, deciding — and a nav bar that scrolls away takes
 * the booking button with it exactly when they have made up their mind.
 *
 * The MENU IS THE PAGE, not a section of it. Aurora shows four dishes as cards and
 * sends you elsewhere to read the rest; here the carte runs in full, in courses, with
 * leader rules, priced. It is the longest thing on the page and everything above it
 * is preface.
 *
 * PHOTOGRAPHS ARE PUNCTUATION. Three portraits down the page, small, plus one behind
 * the hero that is taken so far down in brightness and colour that it reads as the
 * texture of a dark room rather than as a picture of one. A dining room that argues
 * in writing and then papers the walls with photographs is not sure what it is.
 * Restraint is the argument.
 *
 * TWO SOURCES, KEPT APART
 *
 * The restaurant's record supplies the name, the address and the two ways to reach
 * it. Everything else is sample copy, and every screen that shows this page says so.
 *
 * ITS OWN PALETTE
 *
 * None of the application's tokens, and none of Aurora's either: near-black, warm
 * bone, and an old gold that reads as brass rather than as yellow. Declared on the
 * root below, which is where a manager-chosen accent will eventually be written.
 */

export function SlateTemplate({
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
    // reducedMotion="user" rather than the CSS clamp further up the product: these
    // reveals are JavaScript transforms, and a rule that shortens animation-duration
    // cannot reach them.
    <MotionConfig reducedMotion="user">
    <div
      className={cn(
        "slate site-page min-h-svh selection:bg-[var(--gold)] selection:text-[var(--page)]",
        "[--band:#1b1a18] [--gold:#b9a06a] [--ink:#f2ede6] [--line:#312e2a]",
        "[--site-focus:#b9a06a]",
        "[--muted:#8d867a] [--page:#141312]",
      )}
      style={{ backgroundColor: "var(--page)", color: "var(--ink)" }}
    >
      <TopBar restaurant={restaurant} />

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Spine restaurant={restaurant} />

        <main className="min-w-0">
          <Overture restaurant={restaurant} content={content} />
          <Creed content={content} />
          <Carte content={content} />
          <Cellar content={content} />
          <Kitchen content={content} />
          <Laurels content={content} />
          <PrivateDining content={content} />
          <Visit restaurant={restaurant} content={content} where={where} />
          <Colophon restaurant={restaurant} where={where} />
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}

const NAV = [
  { label: "The carte", href: "#carte" },
  { label: "The kitchen", href: "#kitchen" },
  { label: "Private dining", href: "#private" },
  { label: "Visit", href: "#visit" },
];

/* -------------------------------------------------------------------------- */
/* The spine                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The fixed column down the left.
 *
 * Everything that has to stay reachable while somebody reads two screens of menu: the
 * name, where the sections are, and the way to book. It is the reason this design can
 * afford a menu that runs long — nothing is ever more than one glance from the
 * booking line.
 *
 * The rule down its right edge is the only border on the page. On a dark ground a
 * hairline does the work a whole panel would have to do on a pale one.
 */
function Spine({ restaurant }: { restaurant: Restaurant }) {
  const active = useActiveSection(NAV.map((link) => link.href.slice(1)));

  return (
    <aside className="sticky top-0 hidden h-svh flex-col border-r border-[var(--line)] px-8 py-10 lg:flex">
      <a href="#top" className="block">
        <span className="font-display block text-[1.35rem] leading-[1.15] text-balance">
          {restaurant.name}
        </span>
        <span className="mt-3 block h-px w-10 bg-[var(--gold)]" aria-hidden="true" />
      </a>

      <nav className="mt-12 flex flex-col gap-1">
        {NAV.map((link) => {
          const isActive = active === link.href.slice(1);

          return (
            <a
              key={link.href}
              href={link.href}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "group flex items-center gap-3 py-2 text-sm transition-colors",
                isActive ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {/* The marker grows rather than appearing, so the eye follows it down
                  the list instead of noticing a new thing each time. */}
              <span
                aria-hidden="true"
                className={cn(
                  "h-px bg-[var(--gold)] transition-all duration-300",
                  isActive ? "w-6" : "w-2 group-hover:w-4",
                )}
              />
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <a
          href="#visit"
          className="group inline-flex items-center justify-between gap-2 border border-[var(--gold)]/60 px-4 py-3 text-xs font-medium tracking-[0.18em] text-[var(--gold)] uppercase transition-colors hover:bg-[var(--gold)] hover:text-[var(--page)]"
        >
          Reserve
          <ArrowUpRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </a>
        <p className="text-[0.65rem] leading-relaxed tracking-[0.12em] text-[var(--muted)] uppercase">
          Dinner Tue–Sun
        </p>
      </div>
    </aside>
  );
}

/** The same information as a bar, for screens with no room for a column. */
function TopBar({ restaurant }: { restaurant: Restaurant }) {
  return (
    <header
      id="top"
      className="sticky top-0 z-30 border-b border-[var(--line)] lg:hidden"
      style={{ backgroundColor: "var(--page)" }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <span className="font-display truncate text-base">{restaurant.name}</span>
        <a
          href="#visit"
          className="shrink-0 border border-[var(--gold)]/60 px-3 py-1.5 text-[0.65rem] font-medium tracking-[0.18em] text-[var(--gold)] uppercase"
        >
          Reserve
        </a>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The first screen: type, and nothing else.
 *
 * Aurora opens with a photograph because its argument is the food. This one opens
 * with the name set very large on black, because its argument is that the room knows
 * what it is doing — and the most confident thing a restaurant can put on its first
 * screen is its own name and a single sentence.
 */
function Overture({
  restaurant,
  content,
}: {
  restaurant: Restaurant;
  content: SampleContent;
}) {
  return (
    <section className="relative isolate flex min-h-[85svh] flex-col justify-center overflow-hidden px-6 py-24 sm:px-12 lg:px-16">
      {/* A photograph, but only just.

          This design opens with type on black on purpose, and the risk of putting a
          picture behind it is that Slate turns into Aurora with a different palette.
          It does not, because of what is done to the image: taken down to a third of
          its brightness and half its colour, it stops being a photograph making an
          argument and becomes the texture of a dark room. The name is still the only
          thing on the first screen anybody reads.

          It drifts, very slowly, over half a minute. Not a slideshow like Aurora's —
          one room, moving about as much as a room does. */}
      <motion.div
        className="absolute inset-0 -z-10"
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 32, ease: "linear" }}
      >
        <Photo
          tone="hall"
          width={2200}
          height={1400}
          priority
          className="h-full w-full brightness-[0.34] saturate-[0.5]"
        />
      </motion.div>

      {/* Three scrims, each doing one job: the left third carries the headline, the
          floor carries the scroll cue, and the whole is pulled back towards the page
          colour so the hero and the band under it read as one surface. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to right, rgb(20 19 18 / 0.94) 0%, rgb(20 19 18 / 0.72) 38%, rgb(20 19 18 / 0.42) 100%)",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgb(20 19 18 / 0.55) 0%, transparent 30%, transparent 62%, rgb(20 19 18 / 0.96) 100%)",
        }}
      />

      <Grain />

      <div className="relative max-w-4xl">
        <p className="text-[0.65rem] font-medium tracking-[0.34em] text-[var(--gold)] uppercase">
          {content.eyebrow}
        </p>

        <h1 className="font-display mt-8 text-[clamp(2.5rem,7.5vw,6rem)] leading-[0.92] text-balance">
          {restaurant.name}
        </h1>

        <div
          className="mt-10 h-px w-24 bg-[var(--gold)]"
          aria-hidden="true"
        />

        <p className="mt-10 max-w-xl text-lg leading-[1.7] text-[var(--muted)]">
          {content.standfirst}
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a
            href="#carte"
            className="group inline-flex items-center gap-2.5 text-sm tracking-[0.1em] uppercase"
          >
            Read the carte
            <span className="h-px w-8 bg-[var(--gold)] transition-all group-hover:w-12" />
          </a>
          <a
            href="#visit"
            className="text-sm tracking-[0.1em] text-[var(--muted)] uppercase transition-colors hover:text-[var(--ink)]"
          >
            Book a table
          </a>
        </div>
      </div>

      {/* A cue, because this first screen is type on black and gives the eye no other
          reason to believe there is more below it. A photograph cropped at the fold
          does that work by itself; a paragraph ending in white space does not. */}
      <span
        aria-hidden="true"
        className="absolute bottom-10 left-6 hidden items-center gap-3 sm:left-12 lg:left-16 lg:flex"
      >
        <span className="text-[0.6rem] tracking-[0.3em] text-[var(--muted)] uppercase">
          Scroll
        </span>
        <motion.span
          className="block h-px w-12 origin-left bg-[var(--gold)]/60"
          animate={{ scaleX: [0.3, 1, 0.3] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
    </section>
  );
}

/**
 * The statement, with the first of the three photographs beside it.
 *
 * Portrait-shaped and deliberately narrow. On a page that argues in writing, a picture
 * is there to prove the writing is true, not to take over from it.
 */
function Creed({ content }: { content: SampleContent }) {
  return (
    <Band>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <Kicker>Who we are</Kicker>
          <h2 className="font-display mt-7 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.12] text-balance">
            {content.story.title}
          </h2>
          <div className="mt-8 flex max-w-2xl flex-col gap-6">
            {content.story.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-[15px] leading-[1.85] text-[var(--muted)]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <Photo tone="room" width={900} height={1200} className="aspect-3/4 w-full" />
          <p className="mt-4 text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
            Twenty-eight seats, one sitting
          </p>
        </div>
      </div>
    </Band>
  );
}

/**
 * The carte — the longest and most important thing on the page.
 *
 * Set as a printed menu: course heading, then a line per dish with the price carried
 * out to the right on a leader rule. That arrangement is four hundred years old
 * because it works — the eye reads names down the left and prices down the right, and
 * a long dish name and a short one cost the same effort.
 *
 * One column rather than two, at a measure narrower than the page. A menu in two
 * columns is a menu somebody is comparing; a menu in one column is a menu somebody is
 * reading, which is what this restaurant wants.
 */
function Carte({ content }: { content: SampleContent }) {
  return (
    <Band id="carte" tone="band">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <Kicker centred>The carte</Kicker>
          <h2 className="font-display mt-7 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.12]">
            Dinner
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">
            Written each afternoon, after the delivery. What is below is tonight.
          </p>
        </header>

        {/* The set menu, before the carte rather than after it.

            A restaurant that offers one wants it read first - it is the kitchen's own
            argument, and a reader who has already chosen three courses from the carte
            is not going to change their mind at the bottom of the page. Bordered in
            gold and given a price on its own line, because that is the one number
            somebody is looking for and burying it in a paragraph hides it. */}
        <div className="mt-14 border border-[var(--gold)]/35 px-6 py-8 sm:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <h3 className="font-display text-2xl leading-none">
              {content.tasting.name}
            </h3>
            <span className="tabular font-display text-2xl leading-none text-[var(--gold)]">
              {content.tasting.price}
            </span>
          </div>

          <p className="mt-5 max-w-xl text-[15px] leading-[1.8] text-[var(--muted)]">
            {content.tasting.note}
          </p>

          <p className="mt-5 border-t border-[var(--line)] pt-4 text-xs tracking-[0.06em] text-[var(--muted)]/75 italic">
            {content.tasting.terms}
          </p>
        </div>

        <div className="mt-16 flex items-center gap-5">
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden="true" />
          <span className="text-[0.65rem] tracking-[0.28em] text-[var(--muted)] uppercase">
            Or from the carte
          </span>
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden="true" />
        </div>

        <div className="mt-16 flex flex-col gap-14">
          {content.courses.map((course) => (
            <section key={course.name}>
              <div className="flex items-baseline gap-4">
                <h3 className="font-display shrink-0 text-xl tracking-[0.14em] text-[var(--gold)] uppercase">
                  {course.name}
                </h3>
                <span
                  className="h-px flex-1 translate-y-[-3px] bg-[var(--line)]"
                  aria-hidden="true"
                />
              </div>

              {course.note !== "" && (
                <p className="mt-3 text-xs tracking-[0.06em] text-[var(--muted)] italic">
                  {course.note}
                </p>
              )}

              <ul className="mt-7 flex flex-col gap-6">
                {course.lines.map((line) => (
                  <li key={line.name}>
                    <div className="flex items-baseline gap-3">
                      <h4 className="font-display shrink-0 text-lg leading-none">
                        {line.name}
                      </h4>
                      {/* The leader. Dotted rather than solid, because that is what a
                          printed menu uses and the eye has learned to travel along it. */}
                      <span
                        aria-hidden="true"
                        className="h-px min-w-5 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--muted)]/45"
                      />
                      <span className="tabular shrink-0 text-base text-[var(--gold)]">
                        {line.price}
                      </span>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                      {line.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-[var(--line)] pt-6 text-center text-xs leading-relaxed text-[var(--muted)]">
          A discretionary service charge of ten per cent is added for parties of six or
          more. Please tell us about any allergies before you order.
        </p>
      </div>
    </Band>
  );
}

/**
 * The wine.
 *
 * Short, and it exists because the page was making a promise it did not keep: the
 * awards list claims a prize for the wine list and nothing anywhere else mentioned
 * wine. A reader who noticed that learned something true about the restaurant, and it
 * was not the intended lesson.
 *
 * Set at the same measure as the carte above it, so it reads as a footnote to the
 * menu rather than as a section competing with it.
 */
function Cellar({ content }: { content: SampleContent }) {
  return (
    <Band>
      <div className="mx-auto max-w-3xl">
        <Kicker>The cellar</Kicker>
        <h2 className="font-display mt-7 text-[clamp(1.5rem,2.4vw,2.25rem)] leading-[1.15] text-balance">
          {content.cellar.title}
        </h2>
        <p className="mt-7 text-[15px] leading-[1.9] text-[var(--muted)]">
          {content.cellar.body}
        </p>
      </div>
    </Band>
  );
}

/**
 * The chef.
 *
 * The quotation is set larger than the biography under it, which is the right way
 * round: a sentence in somebody's own words says more about how a kitchen is run than
 * a paragraph about where they trained.
 */
function Kitchen({ content }: { content: SampleContent }) {
  const { chef } = content;

  return (
    <Band id="kitchen">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Photo tone="pass" width={900} height={1200} className="aspect-3/4 w-full" />
        </div>

        <div className="lg:col-span-7 lg:pt-6">
          <Kicker>The kitchen</Kicker>

          <blockquote className="font-display mt-7 text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.25] text-balance">
            &ldquo;{chef.quote}&rdquo;
          </blockquote>

          <div className="mt-8 flex items-baseline gap-3">
            <span className="text-sm tracking-[0.14em] uppercase">{chef.name}</span>
            <span className="h-px w-6 bg-[var(--gold)]" aria-hidden="true" />
            <span className="text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
              {chef.role}
            </span>
          </div>

          <p className="mt-8 max-w-2xl text-[15px] leading-[1.85] text-[var(--muted)]">
            {chef.bio}
          </p>
        </div>
      </div>
    </Band>
  );
}

/**
 * Awards, as a ruled list rather than a row of badges.
 *
 * Badges are what a software page does. A dining room lists what it won, who said so
 * and when, in the order it happened, and lets the reader decide whether it matters.
 */
function Laurels({ content }: { content: SampleContent }) {
  return (
    <Band tone="band">
      <Kicker>Recognition</Kicker>

      <ul className="mt-10 flex flex-col">
        {content.awards.map((award) => (
          <li
            key={`${award.title}-${award.year}`}
            className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-[var(--line)] py-6 last:border-b"
          >
            <span className="tabular font-display w-16 shrink-0 text-sm text-[var(--gold)]">
              {award.year}
            </span>
            <span className="font-display min-w-0 flex-1 text-lg">{award.title}</span>
            <span className="text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
              {award.source}
            </span>
          </li>
        ))}
      </ul>
    </Band>
  );
}

/** The room, hired. The third and last photograph. */
function PrivateDining({ content }: { content: SampleContent }) {
  const { privateDining } = content;

  return (
    <section id="private" className="relative isolate overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <Photo
          tone="wine"
          width={1400}
          height={1200}
          className="aspect-4/3 w-full lg:aspect-auto lg:h-full lg:min-h-[30rem]"
        />

        <div
          className="relative flex items-center px-6 py-20 sm:px-12 lg:px-16"
          style={{ backgroundColor: "var(--band)" }}
        >
          <Grain />
          <div className="relative max-w-md">
            <Kicker>Private dining</Kicker>
            <h2 className="font-display mt-7 text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.14] text-balance">
              {privateDining.title}
            </h2>
            <p className="mt-7 text-[15px] leading-[1.85] text-[var(--muted)]">
              {privateDining.body}
            </p>
            <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]/70 italic">
              {privateDining.note}
            </p>
            <a
              href="#visit"
              className="group mt-9 inline-flex items-center gap-2.5 text-sm tracking-[0.1em] uppercase"
            >
              Enquire
              <span className="h-px w-8 bg-[var(--gold)] transition-all group-hover:w-12" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Where it is, when it opens, how to reach it.
 *
 * Three columns of the same weight: on this design the hours are not a footnote to
 * the address, they are the thing somebody checks before they ring.
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
  const reach = [
    restaurant.contactPhone !== null && restaurant.contactPhone.trim() !== ""
      ? { icon: Phone, value: restaurant.contactPhone, href: `tel:${restaurant.contactPhone}` }
      : null,
    restaurant.contactEmail !== null && restaurant.contactEmail.trim() !== ""
      ? {
          icon: Mail,
          value: restaurant.contactEmail,
          href: `mailto:${restaurant.contactEmail}`,
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <Band id="visit">
      <div className="grid gap-12 md:grid-cols-3 md:gap-10">
        <div>
          <Kicker>Find us</Kicker>
          {where !== "" && (
            <p className="font-display mt-7 text-xl leading-[1.35]">{where}</p>
          )}
          <p className="mt-4 inline-flex items-center gap-2 text-xs tracking-[0.12em] text-[var(--muted)] uppercase">
            <MapPin className="size-3.5 text-[var(--gold)]" aria-hidden="true" />
            Reservations advised
          </p>
        </div>

        <div>
          <Kicker>Hours</Kicker>
          <dl className="mt-7 flex flex-col">
            {content.hours.map((row) => (
              <div
                key={row.days}
                className="flex items-baseline gap-4 border-b border-[var(--line)] py-3.5 first:border-t"
              >
                <dt className="min-w-0 flex-1 text-sm text-[var(--muted)]">{row.days}</dt>
                <dd
                  className={cn(
                    "tabular shrink-0 text-sm",
                    row.time.toLowerCase() === "closed"
                      ? "text-[var(--muted)]/60"
                      : "text-[var(--ink)]",
                  )}
                >
                  {row.time}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <Kicker>Reach us</Kicker>
          <ul className="mt-7 flex flex-col gap-5">
            {reach.map((entry) => (
              <li key={entry.value}>
                <a
                  href={entry.href}
                  className="group inline-flex items-center gap-3 text-[15px] transition-colors hover:text-[var(--gold)]"
                >
                  <entry.icon
                    className="size-4 shrink-0 text-[var(--gold)]"
                    aria-hidden="true"
                  />
                  {entry.value}
                </a>
              </li>
            ))}
          </ul>

          <a
            href={reach[0]?.href ?? "#visit"}
            className="group mt-9 inline-flex items-center justify-between gap-6 border border-[var(--gold)]/60 px-5 py-3.5 text-xs font-medium tracking-[0.18em] text-[var(--gold)] uppercase transition-colors hover:bg-[var(--gold)] hover:text-[var(--page)]"
          >
            Reserve a table
            <ArrowUpRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </Band>
  );
}

/** The last line. One rule, the name, and nothing else. */
function Colophon({ restaurant, where }: { restaurant: Restaurant; where: string }) {
  return (
    <footer className="border-t border-[var(--line)] px-6 py-10 sm:px-12 lg:px-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="font-display text-sm tracking-[0.22em] uppercase">
          {restaurant.name}
        </span>
        {where !== "" && (
          <span className="text-xs text-[var(--muted)]">{where}</span>
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
  tone = "page",
  children,
}: {
  id?: string;
  tone?: "page" | "band";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative isolate overflow-hidden"
      style={{ backgroundColor: tone === "band" ? "var(--band)" : "var(--page)" }}
    >
      {tone === "band" && <Grain />}
      <div className="relative px-6 py-20 sm:px-12 sm:py-24 lg:px-16 lg:py-28">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}

/**
 * A band arriving as it is scrolled to.
 *
 * Eighteen pixels and seven tenths of a second, once. The point is not the movement -
 * nobody should be able to describe it afterwards - it is that a section resolves
 * rather than simply being there, which is the difference between a page that feels
 * printed and one that feels assembled.
 *
 * Once, and never again: a band that re-animates every time it is scrolled past turns
 * a long menu into a flickering thing, and this design's whole argument is composure.
 * The margin starts it before the section reaches the middle of the screen, so the
 * movement finishes while it is still being approached rather than under the eye.
 */
function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -15% 0px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** The small line above a heading, with a rule leading into it. */
function Kicker({
  centred = false,
  children,
}: {
  centred?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-[0.65rem] font-medium tracking-[0.28em] text-[var(--gold)] uppercase",
        centred && "justify-center",
      )}
    >
      <span className="h-px w-6 bg-[var(--gold)]/60" aria-hidden="true" />
      {children}
      {centred && <span className="h-px w-6 bg-[var(--gold)]/60" aria-hidden="true" />}
    </p>
  );
}

/**
 * Where a photograph goes.
 *
 * The image is positioned against the frame rather than laid inside it, so a source
 * returning something smaller than requested cannot leave the ground showing round
 * it. The warm ground underneath is what shows while it loads and what remains if it
 * never arrives; an image that errors hides itself for the same reason.
 *
 * Desaturated slightly and darkened, which is the one thing that keeps three
 * photographs from three different shoots looking like one restaurant's. On a page
 * this dark a full-colour photograph is also the only thing shouting.
 */
function Photo({
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
  /** The hero, which must not wait behind three portraits further down the page. */
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
          className="absolute inset-0 block h-full w-full object-cover brightness-[0.82] saturate-[0.78]"
        />
      )}
    </div>
  );
}

/** A fine noise, so a large dark area reads as a surface rather than a swatch. */
function Grain() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

/**
 * Which section is on screen, for the marker in the spine.
 *
 * An observer rather than a scroll listener: the browser reports the crossings it
 * already tracks instead of the page recomputing every element's position sixty times
 * a second while somebody reads a menu.
 *
 * The band is the middle of the viewport, so a section counts as current when it is
 * being read rather than when its top edge happens to cross the top of the window —
 * which on a page of long sections would mark the next one far too early.
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);

        if (visible !== undefined) {
          setActive(visible.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [ids]);

  return active;
}
