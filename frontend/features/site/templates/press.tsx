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
import { CardSlider } from "./card-slider";

/**
 * Press — the page set like a printed menu.
 *
 * For the hotel dining room, the old grill, the restaurant whose name is already
 * the argument. It carries the menu in courses and the accolades and very little
 * else: no dish of the moment, no private-dining block, no reasons-to-visit list.
 * Restraint is the design, and a feature added here would cost more than it gave.
 *
 * The setting is typographic rather than photographic. A masthead with rules above
 * and below, a narrow measure, small caps in place of headings, and the story set
 * in two columns behind a drop cap — the conventions of print, used because they
 * are what a page like this is imitating. The photographs are there, but they are
 * held in hairline frames and drained of colour so that nothing on the page
 * outshouts the type.
 *
 * Fixed here: the masthead, the measure, the rules, the centred menu, the drop cap,
 * the grey of the photographs, and every label the design supplies itself. What a
 * manager writes is the words and the pictures.
 */
export function PressTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);
  const bookingHref = safeHref(content.contact.bookingUrl);

  const hasMenu = content.menuGroups.some(
    (group) => has(group.name) || group.items.length > 0,
  );
  const hasAwards = content.awards.length > 0;

  const navLinks = [
    hasMenu && { href: "#menu", label: "Menu" },
    sections.about(content) && { href: "#story", label: "The house" },
    hasAwards && { href: "#awards", label: "Accolades" },
    { href: "#visit", label: "Reservations" },
  ].filter((entry): entry is { href: string; label: string } => entry !== false);

  return (
    <div
      style={accentStyle(content.theme.accent, "#1e3a5f")}
      className="min-h-screen bg-white font-serif text-neutral-800 antialiased"
    >
      {/* ------------------------------------------------------------ Masthead */}
      {/* Rules above and below, the name between them, the links under that. The
          proportions are the point and they are not the manager's to change. */}
      <header className="border-b-[3px] border-double border-neutral-800">
        <div className="mx-auto max-w-4xl px-5 pt-8 pb-6 text-center sm:px-6 sm:pt-10">
          {has(content.brand.tagline) && (
            <p className="text-2xs tracking-[0.36em] text-neutral-500 uppercase">
              {content.brand.tagline}
            </p>
          )}

          <h1 className="mt-4 text-[2rem] leading-tight tracking-tight text-balance text-neutral-900 sm:text-5xl">
            {name}
          </h1>

          <nav className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 border-t border-neutral-300 pt-5 text-2xs tracking-[0.2em] text-neutral-600 uppercase sm:gap-x-9 sm:text-xs">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-[var(--accent)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* ---------------------------------------------------------------- Hero */}
      <section data-site-section="hero" className="border-b border-neutral-300">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center sm:px-6 sm:py-16">
          {has(content.hero.eyebrow) && (
            <p className="text-2xs tracking-[0.3em] text-[var(--accent)] uppercase">
              {content.hero.eyebrow}
            </p>
          )}

          {has(content.hero.headline) && (
            <h2 className="mt-5 text-3xl leading-snug text-balance text-neutral-900 italic sm:text-4xl">
              {content.hero.headline}
            </h2>
          )}

          {has(content.hero.body) && (
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-neutral-600">
              {content.hero.body}
            </p>
          )}

          {(primary !== null || secondary !== null) && (
            <div className="mt-9 flex flex-wrap items-center justify-center gap-5">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="border border-[var(--accent)] bg-[var(--accent)] px-7 py-2.5 text-2xs tracking-[0.18em] text-white uppercase transition-opacity hover:opacity-85"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="border-b border-neutral-400 pb-0.5 text-2xs tracking-[0.18em] text-neutral-600 uppercase transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          )}
        </div>

        {/* A single plate, letterboxed and framed. Wider than the measure so the
            page has one moment of air in it, and no wider. */}
        {has(content.hero.imageUrl) && (
          <div className="mx-auto max-w-5xl px-5 pb-12 sm:px-6 sm:pb-16">
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="aspect-4/3 w-full border border-neutral-300 object-cover p-1.5 sm:aspect-16/9 lg:aspect-21/9"
            />
          </div>
        )}
      </section>

      {/* --------------------------------------------------------------- Story */}
      {sections.about(content) && (
        <section
          id="story"
          data-site-section="about"
          className="scroll-mt-6 border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-4xl px-5 sm:px-6">
            <div className="text-center">
              <Rubric>{has(content.about.title) ? content.about.title : "The house"}</Rubric>
            </div>

            {/* Set in two columns above the fold-width of a tablet, with a drop cap
                on the opening paragraph. Both are conventions of print rather than
                of the web, which is exactly why they are here. */}
            <div className="mt-10 leading-relaxed text-neutral-700 lg:columns-2 lg:gap-12">
              {paragraphs(content.about.body).map((text, index) => (
                <p
                  key={index}
                  className={
                    index === 0
                      ? "mb-5 break-inside-avoid-column first-letter:float-left first-letter:mt-1 first-letter:mr-2.5 first-letter:text-6xl first-letter:leading-[0.8] first-letter:text-[var(--accent)]"
                      : "mb-5"
                  }
                >
                  {text}
                </p>
              ))}
            </div>

            {has(content.about.imageUrl) && (
              <SiteImageEl
                url={content.about.imageUrl}
                alt={content.about.title}
                className="mt-10 aspect-16/9 w-full border border-neutral-300 object-cover p-1.5 grayscale"
              />
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Menu */}
      {hasMenu && (
        <section
          id="menu"
          data-site-section="menuGroups"
          className="scroll-mt-6 border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-2xl px-5 sm:px-6">
            <div className="text-center">
              <Rubric>The bill of fare</Rubric>
            </div>

            <div className="mt-12 flex flex-col gap-14">
              {content.menuGroups.map((group, index) => (
                <section key={index} className="text-center">
                  {has(group.name) && (
                    <h3 className="border-t border-neutral-800 pt-4 text-2xs tracking-[0.32em] text-neutral-900 uppercase">
                      {group.name}
                    </h3>
                  )}

                  {has(group.description) && (
                    <p className="mt-3 text-sm text-neutral-500 italic">
                      {group.description}
                    </p>
                  )}

                  {/* Centred, name over price, the way a card is set. A leader line
                      would be a menu you scan; this is one you read. */}
                  <ul className="mt-9 flex flex-col gap-8">
                    {group.items.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        <h4 className="text-lg text-neutral-900">{item.name}</h4>
                        {has(item.description) && (
                          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-neutral-500 italic">
                            {item.description}
                          </p>
                        )}
                        {has(item.price) && (
                          <p className="mt-2 text-sm text-[var(--accent)] tabular-nums">
                            {item.price}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Accolades */}
      {hasAwards && (
        <section
          id="awards"
          data-site-section="awards"
          className="scroll-mt-6 border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-5 sm:px-6">
            <div className="text-center">
              <Rubric>Accolades</Rubric>
            </div>

            {/* A ruled list rather than a row of cards. This is a citation block:
                the year is the column you read down, and cards would break that. */}
            <ul className="mt-10 flex flex-col">
              {content.awards.map((award, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-1 border-t border-neutral-200 py-4 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  {has(award.year) && (
                    <span className="w-16 shrink-0 text-lg text-[var(--accent)] tabular-nums">
                      {award.year}
                    </span>
                  )}
                  <span className="flex-1 text-balance text-neutral-900">
                    {award.title}
                  </span>
                  {has(award.source) && (
                    <span className="text-2xs tracking-[0.16em] text-neutral-500 uppercase">
                      {award.source}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Gallery */}
      {sections.gallery(content) && (
        <section
          data-site-section="gallery"
          className="border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-5xl px-5 sm:px-6">
            <div className="text-center">
              <Rubric>Plates and rooms</Rubric>
            </div>

            {/* Drained of colour on purpose. A set of photographs taken on different
                days by different people will not agree about white balance, and grey
                is what makes them agree — as well as keeping them behind the type. */}
            <div className="mt-10">
              <CardSlider
                ariaLabel="photographs"
                itemClassName="basis-[76%] sm:basis-[46%] lg:basis-[31%]"
              >
                {content.gallery
                  .filter((image) => has(image.imageUrl))
                  .map((image, index) => (
                    <figure key={index}>
                      <SiteImageEl
                        url={image.imageUrl}
                        alt={image.caption}
                        className="aspect-4/5 w-full border border-neutral-300 object-cover p-1.5 grayscale transition-[filter] duration-500 hover:grayscale-0"
                      />
                      {has(image.caption) && (
                        <figcaption className="mt-3 text-center text-sm text-neutral-500 italic">
                          {image.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
              </CardSlider>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Testimonials */}
      {sections.testimonials(content) && (
        <section
          data-site-section="testimonials"
          className="border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-6">
            <Rubric>Notices</Rubric>

            <div className="mt-10">
              <CardSlider
                ariaLabel="reviews"
                itemClassName="basis-full"
                controlsClassName="justify-center"
              >
                {content.testimonials.map((quote, index) => (
                  <figure key={index} className="px-1">
                    <blockquote className="text-xl leading-relaxed text-balance text-neutral-800 italic sm:text-2xl">
                      &ldquo;{quote.quote}&rdquo;
                    </blockquote>
                    {has(quote.author) && (
                      <figcaption className="mt-6 text-2xs tracking-[0.24em] text-neutral-500 uppercase">
                        {quote.author}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </CardSlider>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Reservations */}
      {(sections.hours(content) || sections.contact(content)) && (
        <section
          id="visit"
          data-site-section="hours"
          className="scroll-mt-6 border-b border-neutral-300 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-5 sm:px-6">
            <div className="text-center">
              <Rubric>Reservations</Rubric>
            </div>

            <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-14">
              {sections.hours(content) && (
                <dl className="flex flex-col gap-3 text-sm">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 border-b border-neutral-200 pb-3"
                    >
                      <dt className="text-neutral-500">{row.label}</dt>
                      <dd className="text-neutral-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {sections.contact(content) && (
                <div data-site-section="contact">
                  <ContactBlock content={content} className="text-sm text-neutral-600" />

                  {bookingHref !== null && (
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-6 inline-block bg-[var(--accent)] px-7 py-2.5 text-2xs tracking-[0.18em] text-white uppercase transition-opacity hover:opacity-85"
                    >
                      Book a table
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------- CTA */}
      {sections.cta(content) && (
        <section data-site-section="cta" className="py-14 sm:py-20">
          <div className="mx-auto max-w-xl px-5 sm:px-6">
            {/* A ruled box. The page has spent itself on hairlines by now, so the
                closing invitation is the one thing given a border on all four sides. */}
            <div className="border border-neutral-800 px-6 py-10 text-center sm:px-10">
              {has(content.callToAction.title) && (
                <h2 className="text-2xl text-balance text-neutral-900 sm:text-3xl">
                  {content.callToAction.title}
                </h2>
              )}
              {has(content.callToAction.body) && (
                <p className="mt-4 leading-relaxed text-pretty text-neutral-600">
                  {content.callToAction.body}
                </p>
              )}
              {ctaHref !== null && has(content.callToAction.buttonLabel) && (
                <a
                  href={ctaHref}
                  className="mt-7 inline-block border border-[var(--accent)] px-7 py-2.5 text-2xs tracking-[0.18em] text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-white"
                >
                  {content.callToAction.buttonLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Footer */}
      <footer
        data-site-section="footer"
        className="border-t-[3px] border-double border-neutral-800 py-10"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 text-center sm:px-6">
          <p className="text-2xs tracking-[0.28em] text-neutral-900 uppercase">{name}</p>

          {content.footer.links.length > 0 && (
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {content.footer.links.map((link, index) => {
                const href = safeHref(link.url);

                return href === null ? null : (
                  <a
                    key={index}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-neutral-600 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          )}

          <p className="text-xs text-neutral-400">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * The one heading treatment this design uses.
 *
 * A rule with the words centred on it, which is how a printed page announces a
 * section without a size change. Every section uses it, so none of them can look
 * more important than another — that evenness is the design.
 */
function Rubric({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="inline-flex items-center gap-4 text-2xs tracking-[0.32em] text-neutral-900 uppercase">
      <span aria-hidden="true" className="h-px w-10 bg-neutral-300" />
      {children}
      <span aria-hidden="true" className="h-px w-10 bg-neutral-300" />
    </h2>
  );
}
