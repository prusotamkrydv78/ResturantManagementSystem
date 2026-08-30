import {
  ContactBlock,
  SiteImageEl,
  accentStyle,
  brandName,
  has,
  paragraphs,
  safeHref,
  sections,
  type TemplateProps,
} from "./shared";

/**
 * Slate — the dining-room page.
 *
 * The fullest of the five, and deliberately so: it is the design for a restaurant
 * that takes bookings, has a chef worth naming, and gets asked about private dining.
 * A cafe needs none of that, which is why the other templates do not carry it.
 *
 * Dark, type-led and slow. Photographs are punctuation rather than the argument,
 * because a room like this sells on the writing — the menu, the story, the name
 * above the pass — and a wall of pictures would say less.
 *
 * What is fixed here, and not the manager's to change: the order of the sections,
 * the rules and spacing between them, the anchored navigation, the way the menu sets
 * two columns of courses, and every label the design supplies itself. What they
 * write is the words and the pictures. That line is the product — a page that looks
 * composed, by somebody who cannot decompose it.
 */
export function SlateTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);
  const eventsHref = safeHref(content.events.buttonHref);
  const bookingHref = safeHref(content.contact.bookingUrl);

  const hasMenu = content.menuGroups.some(
    (group) => has(group.name) || group.items.length > 0,
  );
  const hasChef = has(content.chef.name) || has(content.chef.bio);
  const hasSpotlight = has(content.spotlight.name);
  const hasAwards = content.awards.length > 0;
  const hasEvents = has(content.events.title) || has(content.events.body);
  const hasMarquee = content.marquee.some(has);

  // Built from what exists rather than declared, so the bar never offers a link to a
  // section the manager has not written.
  const navLinks = [
    hasMenu && { href: "#menu", label: "Menu" },
    sections.about(content) && { href: "#story", label: "Story" },
    hasChef && { href: "#chef", label: "The kitchen" },
    sections.gallery(content) && { href: "#gallery", label: "Gallery" },
    hasEvents && { href: "#events", label: "Private dining" },
    { href: "#visit", label: "Visit" },
  ].filter((entry): entry is { href: string; label: string } => entry !== false);

  return (
    <div
      style={accentStyle(content.theme.accent, "#c9a227")}
      className="min-h-screen bg-zinc-950 font-sans text-zinc-300 antialiased"
    >
      {/* ------------------------------------------------------------- Top bar */}
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <span className="text-sm font-semibold tracking-[0.25em] whitespace-nowrap text-white uppercase">
            {name}
          </span>

          <div className="hidden items-center gap-7 text-xs tracking-[0.15em] text-zinc-400 uppercase md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {bookingHref !== null ? (
            <a
              href={bookingHref}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 border border-[var(--accent)] px-4 py-2 text-xs tracking-[0.15em] whitespace-nowrap text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-zinc-950"
            >
              Reserve
            </a>
          ) : (
            has(content.contact.phone) && (
              <a
                href={`tel:${content.contact.phone}`}
                className="shrink-0 text-xs tracking-[0.15em] whitespace-nowrap text-zinc-400 uppercase transition-colors hover:text-white"
              >
                {content.contact.phone}
              </a>
            )
          )}
        </div>
      </nav>

      {/* ---------------------------------------------------------------- Hero */}
      <header
        data-site-section="hero"
        className="relative isolate flex min-h-[38rem] items-end overflow-hidden border-b border-white/10"
      >
        {has(content.hero.imageUrl) ? (
          <>
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/30" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        )}

        <div className="mx-auto w-full max-w-6xl px-6 pt-32 pb-16">
          {has(content.hero.eyebrow) && (
            <p className="mb-6 text-xs font-medium tracking-[0.35em] text-[var(--accent)] uppercase">
              {content.hero.eyebrow}
            </p>
          )}

          <h1 className="max-w-3xl text-5xl leading-[1.02] font-light tracking-tight text-balance text-white sm:text-7xl">
            {has(content.hero.headline) ? content.hero.headline : name}
          </h1>

          {has(content.hero.body) && (
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-zinc-300">
              {content.hero.body}
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm">
            {primary !== null && has(content.hero.primaryLabel) && (
              <a
                href={primary}
                className="bg-[var(--accent)] px-7 py-3.5 text-xs font-semibold tracking-[0.15em] text-zinc-950 uppercase transition-opacity hover:opacity-90"
              >
                {content.hero.primaryLabel}
              </a>
            )}
            {secondary !== null && has(content.hero.secondaryLabel) && (
              <a
                href={secondary}
                className="border-b border-zinc-600 pb-1 text-xs tracking-[0.15em] text-zinc-300 uppercase transition-colors hover:border-white hover:text-white"
              >
                {content.hero.secondaryLabel}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ Accolades */}
      {hasMarquee && (
        <div className="border-b border-white/10 bg-[var(--accent)]/10 py-3.5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 text-center text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
            {content.marquee.filter(has).map((entry, index) => (
              <span key={index} className="flex items-center gap-10">
                {index > 0 && (
                  <span aria-hidden="true" className="text-[var(--accent)]/40">
                    &#10022;
                  </span>
                )}
                {entry}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- Story */}
      {sections.about(content) && (
        <section
          id="story"
          data-site-section="about"
          className="scroll-mt-20 border-b border-white/10 py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <SectionLabel>
                {has(content.about.title) ? content.about.title : "Our story"}
              </SectionLabel>
              <SiteImageEl
                url={content.about.imageUrl}
                alt={content.about.title}
                className="mt-8 aspect-4/5 w-full object-cover grayscale-[30%]"
              />
            </div>

            <div className="flex flex-col gap-6 text-lg leading-relaxed text-pretty text-zinc-400">
              {paragraphs(content.about.body).map((text, index) => (
                <p
                  key={index}
                  // The opening paragraph is set larger. A page that starts at one
                  // size all the way down reads as a document rather than a story.
                  className={
                    index === 0
                      ? "text-2xl leading-snug font-light text-zinc-200"
                      : undefined
                  }
                >
                  {text}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Chef */}
      {hasChef && (
        <section
          id="chef"
          data-site-section="chef"
          className="scroll-mt-20 border-b border-white/10 bg-zinc-900/40 py-24"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionLabel>The kitchen</SectionLabel>

              {has(content.chef.quote) && (
                <blockquote className="mt-8 text-3xl leading-snug font-light text-balance text-white">
                  &ldquo;{content.chef.quote}&rdquo;
                </blockquote>
              )}

              <div className="mt-6 flex flex-col gap-4 leading-relaxed text-pretty text-zinc-400">
                {paragraphs(content.chef.bio).map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>

              {has(content.chef.name) && (
                <div className="mt-8 border-t border-white/10 pt-5">
                  <p className="text-sm font-medium tracking-wide text-white">
                    {content.chef.name}
                  </p>
                  {has(content.chef.role) && (
                    <p className="mt-1 text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                      {content.chef.role}
                    </p>
                  )}
                </div>
              )}
            </div>

            <SiteImageEl
              url={content.chef.imageUrl}
              alt={content.chef.name}
              className="aspect-3/4 w-full object-cover grayscale"
            />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Menu */}
      {hasMenu && (
        <section
          id="menu"
          data-site-section="menuGroups"
          className="scroll-mt-20 border-b border-white/10 py-24"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <SectionLabel>The menu</SectionLabel>
              <Flourish />
            </div>

            {/* Two columns of courses at width, because a menu is read in columns and
                a single stack of thirty lines is a list rather than a menu. */}
            <div className="grid gap-x-16 gap-y-14 md:grid-cols-2">
              {content.menuGroups.map((group, index) => (
                <div key={index}>
                  {has(group.name) && (
                    <h3 className="text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
                      {group.name}
                    </h3>
                  )}
                  {has(group.description) && (
                    <p className="mt-2 text-sm text-zinc-500 italic">
                      {group.description}
                    </p>
                  )}

                  <ul className="mt-6 flex flex-col">
                    {group.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="flex items-baseline justify-between gap-5 border-b border-white/5 py-4 last:border-0"
                      >
                        <div className="min-w-0">
                          <h4 className="font-light text-white">{item.name}</h4>
                          {has(item.description) && (
                            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {has(item.price) && (
                          <span className="shrink-0 text-sm text-[var(--accent)] tabular-nums">
                            {item.price}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Spotlight */}
      {hasSpotlight && (
        <section
          data-site-section="spotlight"
          className="border-b border-white/10 bg-zinc-900/40"
        >
          <div className="mx-auto grid max-w-6xl items-stretch lg:grid-cols-2">
            <div className="min-h-[22rem] bg-zinc-900">
              <SiteImageEl
                url={content.spotlight.imageUrl}
                alt={content.spotlight.name}
                className="size-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center px-6 py-16 lg:px-14">
              {has(content.spotlight.eyebrow) && (
                <p className="text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
                  {content.spotlight.eyebrow}
                </p>
              )}
              <h3 className="mt-5 text-4xl font-light text-balance text-white">
                {content.spotlight.name}
              </h3>
              {has(content.spotlight.description) && (
                <p className="mt-5 leading-relaxed text-pretty text-zinc-400">
                  {content.spotlight.description}
                </p>
              )}
              {has(content.spotlight.price) && (
                <p className="mt-6 text-sm tracking-[0.2em] text-[var(--accent)] uppercase">
                  {content.spotlight.price}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Awards */}
      {hasAwards && (
        <section data-site-section="awards" className="border-b border-white/10 py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {content.awards.map((award, index) => (
              <div key={index} className="text-center">
                {has(award.year) && (
                  <p className="text-3xl font-light text-[var(--accent)] tabular-nums">
                    {award.year}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-white">{award.title}</p>
                {has(award.source) && (
                  <p className="mt-1 text-xs tracking-[0.15em] text-zinc-500 uppercase">
                    {award.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- Gallery */}
      {sections.gallery(content) && (
        <section
          id="gallery"
          data-site-section="gallery"
          className="scroll-mt-20 border-b border-white/10"
        >
          <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
            {content.gallery.map((image, index) => (
              <figure key={index} className="group relative overflow-hidden">
                <SiteImageEl
                  url={image.imageUrl}
                  alt={image.caption}
                  className="aspect-square w-full object-cover grayscale-[40%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                />
                {has(image.caption) && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-3 text-xs text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Testimonials */}
      {sections.testimonials(content) && (
        <section
          data-site-section="testimonials"
          className="border-b border-white/10 py-24"
        >
          <div className="mx-auto max-w-4xl px-6 text-center">
            <SectionLabel>In their words</SectionLabel>
            <Flourish />
            <div className="flex flex-col gap-14">
              {content.testimonials.map((quote, index) => (
                <figure key={index}>
                  <blockquote className="text-2xl leading-relaxed font-light text-balance text-zinc-200">
                    &ldquo;{quote.quote}&rdquo;
                  </blockquote>
                  {has(quote.author) && (
                    <figcaption className="mt-5 text-xs tracking-[0.25em] text-zinc-600 uppercase">
                      {quote.author}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ Private dining */}
      {hasEvents && (
        <section
          id="events"
          data-site-section="events"
          className="scroll-mt-20 border-b border-white/10 bg-zinc-900/40"
        >
          <div className="mx-auto grid max-w-6xl items-center lg:grid-cols-2">
            <div className="flex flex-col justify-center px-6 py-16 lg:px-14">
              <SectionLabel>
                {has(content.events.title) ? content.events.title : "Private dining"}
              </SectionLabel>
              <div className="mt-6 flex flex-col gap-4 leading-relaxed text-pretty text-zinc-400">
                {paragraphs(content.events.body).map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>
              {eventsHref !== null && has(content.events.buttonLabel) && (
                <a
                  href={eventsHref}
                  className="mt-8 self-start border border-[var(--accent)] px-7 py-3 text-xs tracking-[0.15em] text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-zinc-950"
                >
                  {content.events.buttonLabel}
                </a>
              )}
            </div>

            {/* Picture first on a phone, where the text would otherwise push it off
                the screen entirely, and second at width where the band reads left
                to right. */}
            <div className="order-first min-h-[20rem] bg-zinc-900 lg:order-last">
              <SiteImageEl
                url={content.events.imageUrl}
                alt={content.events.title}
                className="size-full object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- Visit */}
      {(sections.hours(content) || sections.contact(content)) && (
        <section
          id="visit"
          data-site-section="hours"
          className="scroll-mt-20 border-b border-white/10 py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-14 px-6 sm:grid-cols-2">
            {sections.hours(content) && (
              <div>
                <SectionLabel>Hours</SectionLabel>
                <dl className="mt-8 flex flex-col gap-3 text-sm">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 border-b border-white/5 pb-3"
                    >
                      <dt className="text-zinc-500">{row.label}</dt>
                      <dd className="text-zinc-200">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {sections.contact(content) && (
              <div data-site-section="contact">
                <SectionLabel>Find us</SectionLabel>
                <ContactBlock content={content} className="mt-8 text-sm text-zinc-400" />

                {bookingHref !== null && (
                  <a
                    href={bookingHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-7 inline-block bg-[var(--accent)] px-7 py-3 text-xs font-semibold tracking-[0.15em] text-zinc-950 uppercase transition-opacity hover:opacity-90"
                  >
                    Book a table
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------- CTA */}
      {sections.cta(content) && (
        <section data-site-section="cta" className="border-b border-white/10 py-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            {has(content.callToAction.title) && (
              <h2 className="text-4xl font-light text-balance text-white">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-5 text-pretty text-zinc-400">
                {content.callToAction.body}
              </p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-9 inline-block border border-[var(--accent)] px-9 py-3.5 text-xs tracking-[0.15em] text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-zinc-950"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Footer */}
      <footer data-site-section="footer" className="py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] text-white uppercase">
              {name}
            </p>
            {has(content.brand.tagline) && (
              <p className="mt-2 text-xs text-zinc-500">{content.brand.tagline}</p>
            )}
          </div>

          {sections.contact(content) && (
            <ContactBlock content={content} className="text-xs text-zinc-500" />
          )}

          <nav className="flex flex-col gap-2 text-xs sm:items-end">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 px-6 pt-6">
          <p className="text-xs text-zinc-600">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The one heading treatment this design uses, so every section announces itself alike. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
      {children}
    </h2>
  );
}

/** The short rule under a centred heading. Decoration the manager does not control. */
function Flourish() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-5 mb-10 h-px w-14 bg-[var(--accent)]/50"
    />
  );
}
