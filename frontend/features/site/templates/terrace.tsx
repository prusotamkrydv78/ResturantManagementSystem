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
 * Terrace — the page that tells a story.
 *
 * For the family restaurant, the village inn, the place that has been there long
 * enough to have a story worth telling. It carries the chef because the story is
 * usually theirs, a menu in courses because the food is cooked rather than styled,
 * and the celebrations block because this is where people book a christening lunch.
 * It carries no awards and no reasons-to-visit list: a page that has to argue in
 * bullet points is not the page for a restaurant like this.
 *
 * Set on paper, in a serif, with the small caps in sans — a printed-programme
 * pairing rather than a website one. The whole design is one rhythm: bands of text
 * and picture that alternate side down the page. That alternation is the structure,
 * which is why a manager cannot reorder it; a long page that always puts the
 * picture on the right stops being read halfway down.
 *
 * Fixed here: the band order and which side each one takes, the rules and ornaments
 * between sections, the centred course headings, and every label the design supplies
 * itself. What a manager writes is the words and the pictures.
 */
export function TerraceTemplate({
  content,
  restaurantName,
  orderHref,
}: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);
  const eventsHref = safeHref(content.events.buttonHref);
  const bookingHref = safeHref(content.contact.bookingUrl);

  const hasChef = has(content.chef.name) || has(content.chef.bio);
  const hasMenu = content.menuGroups.some(
    (group) => has(group.name) || group.items.length > 0,
  );
  const hasEvents = has(content.events.title) || has(content.events.body);

  const navLinks = [
    sections.about(content) && { href: "#story", label: "Our story" },
    hasMenu && { href: "#menu", label: "Menu" },
    sections.gallery(content) && { href: "#gallery", label: "Gallery" },
    hasEvents && { href: "#celebrations", label: "Celebrations" },
    { href: "#visit", label: "Visit" },
  ].filter((entry): entry is { href: string; label: string } => entry !== false);

  return (
    <div
      style={accentStyle(content.theme.accent, "#7f5539")}
      className="min-h-screen bg-[#faf6ee] font-serif text-stone-700 antialiased"
    >
      {/* ------------------------------------------------------------- Top bar */}
      {/* The wordmark centred with the links either side, the way a printed
          programme sets a masthead. On a narrow screen the links fall away and the
          empty column keeps the name in the middle rather than letting it jump. */}
      <nav className="sticky top-0 z-40 border-b border-stone-800/15 bg-[#faf6ee]/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 sm:px-6 sm:py-4">
          <div className="hidden items-center gap-6 font-sans text-xs tracking-[0.12em] text-stone-600 uppercase lg:flex">
            {navLinks.slice(0, 2).map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-[var(--accent)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <span className="col-start-2 min-w-0 truncate text-center text-lg tracking-wide text-stone-900 sm:text-xl">
            {name}
          </span>

          <div className="col-start-3 flex items-center justify-end gap-6">
            <div className="hidden items-center gap-6 font-sans text-xs tracking-[0.12em] text-stone-600 uppercase lg:flex">
              {navLinks.slice(2).map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {orderHref !== undefined && (
              <a
                href={orderHref}
                className="shrink-0 bg-[var(--accent)] px-3 py-1.5 font-sans text-2xs tracking-[0.12em] whitespace-nowrap text-[#faf6ee] uppercase transition-opacity hover:opacity-90 sm:px-4 sm:py-2 sm:text-xs"
              >
                Order
              </a>
            )}

            {bookingHref !== null && (
              <a
                href={bookingHref}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 border border-[var(--accent)] px-3 py-1.5 font-sans text-2xs tracking-[0.12em] whitespace-nowrap text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-[#faf6ee] sm:px-4 sm:py-2 sm:text-xs"
              >
                Reserve
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ---------------------------------------------------------------- Hero */}
      <header
        data-site-section="hero"
        className="border-b border-stone-800/15 bg-[#f4ede0]"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
          {/* The picture comes first on a phone — it is the hook — but it is capped
              in height there so the headline is still on the first screen. */}
          <div className="order-first h-56 w-full bg-stone-200 sm:h-72 lg:order-last lg:h-[34rem]">
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          </div>

          <div className="px-5 pb-12 sm:px-6 sm:pb-16 lg:py-20 lg:pl-10">
            {has(content.hero.eyebrow) && (
              <p className="font-sans text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
                {content.hero.eyebrow}
              </p>
            )}

            <h1 className="mt-5 text-[2.25rem] leading-[1.1] text-balance text-stone-900 sm:text-5xl lg:text-[3.4rem]">
              {has(content.hero.headline) ? content.hero.headline : name}
            </h1>

            {has(content.brand.tagline) && (
              <p className="mt-4 font-sans text-xs tracking-[0.2em] text-stone-500 uppercase">
                {content.brand.tagline}
              </p>
            )}

            {has(content.hero.body) && (
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-stone-600">
                {content.hero.body}
              </p>
            )}

            {(primary !== null || secondary !== null) && (
              <div className="mt-9 flex flex-wrap items-center gap-5 font-sans">
                {primary !== null && has(content.hero.primaryLabel) && (
                  <a
                    href={primary}
                    className="bg-[var(--accent)] px-7 py-3 text-xs tracking-[0.14em] text-[#faf6ee] uppercase transition-opacity hover:opacity-90"
                  >
                    {content.hero.primaryLabel}
                  </a>
                )}
                {secondary !== null && has(content.hero.secondaryLabel) && (
                  <a
                    href={secondary}
                    className="border-b border-stone-400 pb-1 text-xs tracking-[0.14em] text-stone-600 uppercase transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {content.hero.secondaryLabel}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- Story */}
      {sections.about(content) && (
        <Band
          id="story"
          section="about"
          image={content.about.imageUrl}
          imageAlt={content.about.title}
        >
          <Label>{has(content.about.title) ? content.about.title : "Our story"}</Label>

          <div className="mt-6 flex flex-col gap-5 text-lg leading-relaxed text-pretty text-stone-600">
            {paragraphs(content.about.body).map((text, index) => (
              <p
                key={index}
                // The opening paragraph is set larger, so the page starts as a story
                // rather than as a document that happens to have a heading.
                className={index === 0 ? "text-xl text-stone-800" : undefined}
              >
                {text}
              </p>
            ))}
          </div>
        </Band>
      )}

      {/* --------------------------------------------------------------- Chef */}
      {hasChef && (
        <Band
          section="chef"
          image={content.chef.imageUrl}
          imageAlt={content.chef.name}
          flip
          className="bg-[#f4ede0]"
        >
          <Label>In the kitchen</Label>

          {has(content.chef.quote) && (
            <blockquote className="mt-6 text-2xl leading-snug text-balance text-stone-800 italic sm:text-3xl">
              &ldquo;{content.chef.quote}&rdquo;
            </blockquote>
          )}

          <div className="mt-6 flex flex-col gap-4 leading-relaxed text-pretty text-stone-600">
            {paragraphs(content.chef.bio).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>

          {has(content.chef.name) && (
            <div className="mt-7 border-t border-stone-800/15 pt-5">
              <p className="text-lg text-stone-900">{content.chef.name}</p>
              {has(content.chef.role) && (
                <p className="mt-1 font-sans text-2xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  {content.chef.role}
                </p>
              )}
            </div>
          )}
        </Band>
      )}

      {/* ---------------------------------------------------------------- Menu */}
      {hasMenu && (
        <section
          id="menu"
          data-site-section="menuGroups"
          className="scroll-mt-20 border-t border-stone-800/15 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-4xl px-5 sm:px-6">
            <div className="text-center">
              <Label>The menu</Label>
              <Ornament />
            </div>

            <div className="flex flex-col gap-14 sm:gap-16">
              {content.menuGroups.map((group, index) => (
                <section key={index}>
                  {/* The course name centred between two rules. A printed card names
                      its courses in the middle of the page, and it is the one piece
                      of structure a menu really has. */}
                  {has(group.name) && (
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-stone-800/15"
                      />
                      <h3 className="font-sans text-xs tracking-[0.28em] whitespace-nowrap text-[var(--accent)] uppercase">
                        {group.name}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-stone-800/15"
                      />
                    </div>
                  )}

                  {has(group.description) && (
                    <p className="mt-4 text-center text-sm text-stone-500 italic">
                      {group.description}
                    </p>
                  )}

                  {/* Two columns of dishes only where two fit. The names run with
                      the price alongside rather than across a leader — this is a
                      handwritten card, not a printed one. */}
                  <ul className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
                    {group.items.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        <div className="flex items-baseline justify-between gap-4">
                          <h4 className="text-lg text-stone-900">{item.name}</h4>
                          {has(item.price) && (
                            <span className="shrink-0 text-sm text-[var(--accent)] tabular-nums">
                              {item.price}
                            </span>
                          )}
                        </div>
                        {has(item.description) && (
                          <p className="mt-1.5 text-sm leading-relaxed text-stone-500 italic">
                            {item.description}
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

      {/* -------------------------------------------------------------- Gallery */}
      {sections.gallery(content) && (
        <section
          id="gallery"
          data-site-section="gallery"
          className="scroll-mt-20 border-t border-stone-800/15 bg-[#f4ede0] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="text-center">
              <Label>In the room</Label>
              <Ornament />
            </div>

            {/* Framed and captioned rather than tiled edge to edge — photographs on
                a paper page are prints on a wall, and a rail keeps the section one
                picture tall at every width. */}
            <CardSlider
              ariaLabel="photographs"
              itemClassName="basis-[78%] sm:basis-[47%] lg:basis-[32%]"
            >
              {content.gallery
                .filter((image) => has(image.imageUrl))
                .map((image, index) => (
                  <figure key={index} className="bg-white p-3 shadow-md shadow-stone-900/10">
                    <SiteImageEl
                      url={image.imageUrl}
                      alt={image.caption}
                      className="aspect-4/3 w-full object-cover"
                    />
                    {has(image.caption) && (
                      <figcaption className="px-1 pt-3 pb-1 text-center text-sm text-stone-500 italic">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
            </CardSlider>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Testimonials */}
      {sections.testimonials(content) && (
        <section
          data-site-section="testimonials"
          className="border-t border-stone-800/15 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
            <Label>What our guests say</Label>
            <Ornament />

            <CardSlider
              ariaLabel="reviews"
              itemClassName="basis-full"
              controlsClassName="justify-center"
            >
              {content.testimonials.map((quote, index) => (
                <figure key={index} className="px-1">
                  <blockquote className="text-xl leading-relaxed text-balance text-stone-700 italic sm:text-2xl">
                    &ldquo;{quote.quote}&rdquo;
                  </blockquote>
                  {has(quote.author) && (
                    <figcaption className="mt-5 font-sans text-2xs tracking-[0.22em] text-stone-500 uppercase">
                      {quote.author}
                    </figcaption>
                  )}
                </figure>
              ))}
            </CardSlider>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Celebrations */}
      {hasEvents && (
        <Band
          id="celebrations"
          section="events"
          image={content.events.imageUrl}
          imageAlt={content.events.title}
          className="bg-[#f4ede0]"
        >
          <Label>
            {has(content.events.title) ? content.events.title : "Celebrations"}
          </Label>

          <div className="mt-6 flex flex-col gap-4 leading-relaxed text-pretty text-stone-600">
            {paragraphs(content.events.body).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>

          {eventsHref !== null && has(content.events.buttonLabel) && (
            <a
              href={eventsHref}
              className="mt-8 inline-block border border-[var(--accent)] px-7 py-3 font-sans text-xs tracking-[0.14em] text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-[#faf6ee]"
            >
              {content.events.buttonLabel}
            </a>
          )}
        </Band>
      )}

      {/* --------------------------------------------------------------- Visit */}
      {(sections.hours(content) || sections.contact(content)) && (
        <section
          id="visit"
          data-site-section="hours"
          className="scroll-mt-20 border-t border-stone-800/15 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto grid max-w-5xl gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:gap-0">
            {sections.hours(content) && (
              <div className="lg:pr-14">
                <Label>Opening hours</Label>
                <dl className="mt-7 flex flex-col gap-3">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 border-b border-stone-800/10 pb-3"
                    >
                      <dt className="text-stone-500">{row.label}</dt>
                      <dd className="text-stone-800">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {sections.contact(content) && (
              // The rule between the two only appears where they sit side by side.
              <div
                data-site-section="contact"
                className="lg:border-l lg:border-stone-800/15 lg:pl-14"
              >
                <Label>Find us</Label>
                <ContactBlock content={content} className="mt-7 text-stone-600" />

                {bookingHref !== null && (
                  <a
                    href={bookingHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-8 inline-block bg-[var(--accent)] px-7 py-3 font-sans text-xs tracking-[0.14em] text-[#faf6ee] uppercase transition-opacity hover:opacity-90"
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
        <section
          data-site-section="cta"
          className="border-t border-stone-800/15 bg-[#f4ede0] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-6">
            {has(content.callToAction.title) && (
              <h2 className="text-3xl text-balance text-stone-900 sm:text-4xl">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-5 text-lg leading-relaxed text-pretty text-stone-600">
                {content.callToAction.body}
              </p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-8 inline-block bg-[var(--accent)] px-8 py-3.5 font-sans text-xs tracking-[0.14em] text-[#faf6ee] uppercase transition-opacity hover:opacity-90"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Footer */}
      <footer data-site-section="footer" className="bg-stone-800 py-12 text-stone-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-lg tracking-wide text-white">{name}</p>
            {has(content.brand.tagline) && (
              <p className="mt-2 font-sans text-2xs tracking-[0.18em] text-stone-400 uppercase">
                {content.brand.tagline}
              </p>
            )}
          </div>

          {sections.contact(content) && (
            <ContactBlock content={content} className="text-sm text-stone-400" />
          )}

          <nav className="flex flex-col gap-2 text-sm sm:items-end">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-stone-400 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-5 pt-6 sm:px-6">
          <p className="font-sans text-xs text-stone-500">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * One band of the page: words on one side, a picture on the other.
 *
 * The whole design is this component repeated with `flip` alternating, which is why
 * it takes the side as a prop rather than each section deciding for itself. On a
 * narrow screen the picture always goes on top, because there is no such thing as a
 * side when there is only one column.
 */
function Band({
  id,
  section,
  image,
  imageAlt,
  flip = false,
  className,
  children,
}: {
  id?: string;
  section: string;
  image: string;
  imageAlt: string;
  flip?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-site-section={section}
      className={`scroll-mt-20 border-t border-stone-800/15 ${className ?? ""}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div
          className={`order-first h-60 w-full bg-stone-200 sm:h-80 lg:h-[30rem] ${
            flip ? "lg:order-first" : "lg:order-last"
          }`}
        >
          <SiteImageEl url={image} alt={imageAlt} className="size-full object-cover" />
        </div>

        <div
          className={`px-5 pb-14 sm:px-6 sm:pb-16 lg:py-20 ${
            flip ? "lg:pr-10 lg:pl-6" : "lg:pr-6 lg:pl-10"
          }`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/** The one heading treatment this design uses, in sans against the serif page. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-xs tracking-[0.28em] text-[var(--accent)] uppercase">
      {children}
    </h2>
  );
}

/** The ruled diamond under a centred heading. Decoration the manager does not control. */
function Ornament() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-5 mb-10 flex items-center justify-center gap-3"
    >
      <span className="h-px w-12 bg-stone-800/20" />
      <span className="text-xs text-[var(--accent)]">&#9670;</span>
      <span className="h-px w-12 bg-stone-800/20" />
    </div>
  );
}
