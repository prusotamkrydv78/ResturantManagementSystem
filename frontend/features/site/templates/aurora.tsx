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
 * Aurora — the photographic page.
 *
 * The design for a restaurant whose case is made by its pictures: a neighbourhood
 * bistro, a brunch room, anywhere the food looks like the reason to come. Where
 * Slate argues in writing, this one shows and gets out of the way — which is why it
 * carries no menu in courses and no chef biography. A page that scrolls through
 * photographs is not a page anybody stops to read a thousand words on.
 *
 * Warm and light: a cream ground, generous air, soft corners, one burnt accent. The
 * composition is deliberately not a stack of equal bands — the hero runs under a
 * card that overlaps it, the spotlight sets a card into the corner of a photograph,
 * and the gallery is a mosaic rather than a grid. That asymmetry is what keeps a
 * page of pictures from reading as a contact sheet.
 *
 * Fixed, and not the manager's to change: the order of the sections, the overlaps,
 * the corner radii and spacing, the mosaic's shape, and every label the design
 * supplies itself. What they write is the words and the pictures.
 */
export function AuroraTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);
  const bookingHref = safeHref(content.contact.bookingUrl);

  const hasSpotlight = has(content.spotlight.name);
  const hasSpotlightImage = has(content.spotlight.imageUrl);

  // The strip that overlaps the hero. Only the cells with something in them, and no
  // strip at all if that leaves nothing — an empty card floating over a photograph
  // is worse than no card.
  const firstHours = content.hours.find((row) => has(row.value));
  const stripCells = [
    has(content.contact.addressLine) && {
      label: "Find us",
      value: content.contact.addressLine,
    },
    firstHours !== undefined && {
      label: has(firstHours.label) ? firstHours.label : "Open",
      value: firstHours.value,
    },
    has(content.contact.phone) && {
      label: "Reservations",
      value: content.contact.phone,
    },
  ].filter((cell): cell is { label: string; value: string } => cell !== false);

  const navLinks = [
    sections.dishes(content) && { href: "#menu", label: "Food" },
    sections.about(content) && { href: "#story", label: "Story" },
    sections.gallery(content) && { href: "#gallery", label: "Gallery" },
    { href: "#visit", label: "Visit" },
  ].filter((entry): entry is { href: string; label: string } => entry !== false);

  return (
    <div
      style={accentStyle(content.theme.accent, "#c2410c")}
      className="min-h-screen bg-stone-50 font-sans text-stone-800 antialiased"
    >
      {/* ------------------------------------------------------------- Top bar */}
      <nav className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:gap-6 sm:px-6 sm:py-4">
          <span className="min-w-0 truncate text-base font-semibold tracking-tight text-stone-900 sm:text-lg">
            {name}
          </span>

          <div className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-[var(--accent)]"
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
              className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:px-5 sm:text-sm"
            >
              Book a table
            </a>
          ) : (
            has(content.contact.phone) && (
              <a
                href={`tel:${content.contact.phone}`}
                className="shrink-0 text-xs font-medium whitespace-nowrap text-stone-600 transition-colors hover:text-[var(--accent)] sm:text-sm"
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
        className="relative isolate flex min-h-[28rem] items-center overflow-hidden sm:min-h-[34rem] lg:min-h-[42rem]"
      >
        {has(content.hero.imageUrl) ? (
          <>
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            {/* Darkened from the bottom rather than evenly: the text sits low, and a
                flat scrim over the whole picture dulls the half nobody is reading. */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-stone-950/85 via-stone-950/55 to-stone-950/25" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-stone-900 via-stone-800 to-[var(--accent)]" />
        )}

        <div className="mx-auto w-full max-w-5xl px-5 pt-20 pb-24 text-center sm:px-6 sm:pt-24 sm:pb-28 lg:pb-32">
          {has(content.hero.eyebrow) && (
            <p className="mb-5 text-xs font-semibold tracking-[0.28em] text-white/85 uppercase">
              {content.hero.eyebrow}
            </p>
          )}

          <h1 className="mx-auto max-w-3xl text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            {has(content.hero.headline) ? content.hero.headline : name}
          </h1>

          {has(content.hero.body) && (
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-white/85 sm:text-lg">
              {content.hero.body}
            </p>
          )}

          {(primary !== null || secondary !== null) && (
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-950/20 transition-transform hover:scale-105"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="rounded-full border border-white/45 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------- Details card */}
      {/* Lifted over the bottom of the hero, which is the one move that stops the
          page reading as a stack of full-width bands. The hairlines are the grid
          gap showing through, so the cells stay flush at every width. */}
      {stripCells.length > 0 && (
        <div className="relative z-10 mx-auto -mt-14 max-w-5xl px-5 sm:px-6 lg:-mt-16">
          <div className="grid gap-px overflow-hidden rounded-2xl bg-stone-200 shadow-xl shadow-stone-900/10 sm:grid-cols-3">
            {stripCells.map((cell, index) => (
              <div key={index} className="bg-white px-5 py-5 text-center sm:py-6">
                <p className="text-2xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
                  {cell.label}
                </p>
                <p className="mt-2 text-sm font-medium text-balance text-stone-800">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- Story */}
      {sections.about(content) && (
        <section
          id="story"
          data-site-section="about"
          className="scroll-mt-20 py-16 sm:py-20 lg:py-28"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
            {/* The picture sits on an accent panel offset behind it. One shadow and
                one offset, done once — enough to look composed, cheap enough that it
                cannot break when the image is missing and the panel goes with it. */}
            <div className="relative">
              {has(content.about.imageUrl) && (
                <span
                  aria-hidden="true"
                  className="absolute -top-4 -left-4 hidden size-full rounded-3xl bg-[var(--accent)]/15 lg:block"
                />
              )}
              <SiteImageEl
                url={content.about.imageUrl}
                alt={content.about.title}
                className="relative aspect-4/3 w-full rounded-3xl object-cover shadow-xl shadow-stone-900/10 sm:aspect-16/10"
              />
            </div>

            <div>
              <Eyebrow>{has(content.brand.tagline) ? content.brand.tagline : "About us"}</Eyebrow>

              {has(content.about.title) && (
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-stone-900 sm:text-4xl">
                  {content.about.title}
                </h2>
              )}

              <div className="mt-6 flex flex-col gap-4 leading-relaxed text-pretty text-stone-600">
                {paragraphs(content.about.body).map((text, index) => (
                  <p
                    key={index}
                    className={
                      index === 0 ? "text-lg leading-relaxed text-stone-700" : undefined
                    }
                  >
                    {text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Food */}
      {sections.dishes(content) && (
        <section
          id="menu"
          data-site-section="dishes"
          className="scroll-mt-20 bg-white py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="max-w-xl">
              <Eyebrow>On the menu</Eyebrow>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-stone-900 sm:text-4xl">
                What we are known for
              </h2>
            </div>

            {/* A rail rather than a grid. Three across becomes one down on a phone,
                and a section that read as a considered row turns into a column half
                a page long that has to be scrolled past to reach anything else. */}
            <div className="mt-10 sm:mt-12">
              <CardSlider ariaLabel="dishes">
                {content.dishes.map((dish, index) => (
                  <article
                    key={index}
                    className="flex h-full flex-col overflow-hidden rounded-2xl bg-stone-50 ring-1 ring-stone-200/80"
                  >
                    <SiteImageEl
                      url={dish.imageUrl}
                      alt={dish.name}
                      className="aspect-4/3 w-full object-cover"
                    />
                    <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold text-stone-900">{dish.name}</h3>
                        {has(dish.price) && (
                          <span className="shrink-0 text-sm font-semibold text-[var(--accent)] tabular-nums">
                            {dish.price}
                          </span>
                        )}
                      </div>
                      {has(dish.description) && (
                        <p className="text-sm leading-relaxed text-stone-600">
                          {dish.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </CardSlider>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Spotlight */}
      {hasSpotlight && (
        <section
          data-site-section="spotlight"
          className="bg-stone-100 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="relative">
              <SiteImageEl
                url={content.spotlight.imageUrl}
                alt={content.spotlight.name}
                className="aspect-4/3 w-full rounded-3xl object-cover sm:aspect-16/9 lg:aspect-2/1"
              />

              {/* Set into the corner of the photograph on a wide screen, and simply
                  under it on a narrow one, where an overlay would cover the dish it
                  is describing. */}
              <div
                className={
                  hasSpotlightImage
                    ? "relative mx-auto -mt-12 max-w-md rounded-2xl bg-white p-6 shadow-xl shadow-stone-900/15 sm:p-8 lg:absolute lg:right-8 lg:bottom-8 lg:mx-0 lg:mt-0 lg:max-w-sm"
                    : "mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl shadow-stone-900/10 sm:p-8"
                }
              >
                {has(content.spotlight.eyebrow) && (
                  <Eyebrow>{content.spotlight.eyebrow}</Eyebrow>
                )}
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-stone-900">
                  {content.spotlight.name}
                </h3>
                {has(content.spotlight.description) && (
                  <p className="mt-3 text-sm leading-relaxed text-pretty text-stone-600">
                    {content.spotlight.description}
                  </p>
                )}
                {has(content.spotlight.price) && (
                  <p className="mt-5 text-lg font-semibold text-[var(--accent)] tabular-nums">
                    {content.spotlight.price}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Why visit */}
      {sections.features(content) && (
        <section data-site-section="features" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
              {content.features.map((feature, index) => (
                <div key={index}>
                  {/* Numbered rather than given an icon. An icon has to mean
                      something, and the manager writes these — there is no way to
                      pick one that is not a guess at what they meant. */}
                  <p className="text-sm font-semibold text-[var(--accent)] tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-3 mb-4 h-px w-full bg-stone-200"
                  />
                  <h3 className="font-semibold text-balance text-stone-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {feature.description}
                  </p>
                </div>
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
          className="scroll-mt-20 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Eyebrow>The room</Eyebrow>

            {/* A mosaic, not a grid of equal squares. The first picture is given
                four times the area because a wall of identical thumbnails reads as
                a contact sheet, and the manager uploads their best one first. */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {content.gallery
                .filter((image) => has(image.imageUrl))
                .map((image, index) => (
                  <figure
                    key={index}
                    className={`group relative overflow-hidden rounded-2xl bg-stone-200 ${
                      index === 0
                        ? "col-span-2 aspect-square md:row-span-2 md:aspect-auto"
                        : "aspect-square"
                    }`}
                  >
                    <SiteImageEl
                      url={image.imageUrl}
                      alt={image.caption}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {has(image.caption) && (
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/80 to-transparent p-4 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Testimonials */}
      {sections.testimonials(content) && (
        <section
          data-site-section="testimonials"
          className="bg-[var(--accent)]/10 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
            <Eyebrow>What guests say</Eyebrow>

            {/* One at a time. Quotes are read one at a time whatever the layout, so
                stacking them only makes the section long; the centred arrows sit
                where the eye already is. */}
            <div className="mt-8">
              <CardSlider
                ariaLabel="reviews"
                itemClassName="basis-full"
                controlsClassName="justify-center"
              >
                {content.testimonials.map((quote, index) => (
                  <figure key={index} className="px-1">
                    <blockquote className="text-xl leading-relaxed font-medium text-balance text-stone-800 sm:text-2xl">
                      &ldquo;{quote.quote}&rdquo;
                    </blockquote>
                    {has(quote.author) && (
                      <figcaption className="mt-5 text-sm font-medium text-stone-500">
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

      {/* --------------------------------------------------------------- Visit */}
      {(sections.hours(content) || sections.contact(content)) && (
        <section
          id="visit"
          data-site-section="hours"
          className="scroll-mt-20 bg-stone-900 py-16 text-stone-200 sm:py-20 lg:py-24"
        >
          <div className="mx-auto grid max-w-5xl gap-10 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
            {sections.hours(content) && (
              <div>
                <h2 className="text-xl font-semibold text-white">Opening hours</h2>
                <dl className="mt-6 flex flex-col gap-3 text-sm">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 border-b border-white/10 pb-3"
                    >
                      <dt className="text-stone-400">{row.label}</dt>
                      <dd className="font-medium text-white">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {sections.contact(content) && (
              <div data-site-section="contact">
                <h2 className="text-xl font-semibold text-white">Find us</h2>
                <ContactBlock content={content} className="mt-6 text-sm text-stone-300" />

                {bookingHref !== null && (
                  <a
                    href={bookingHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-7 inline-block rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
          className="bg-[var(--accent)] py-16 text-white sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
            {has(content.callToAction.title) && (
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-4 text-pretty text-white/90">
                {content.callToAction.body}
              </p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-8 inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-stone-900 transition-transform hover:scale-105"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- Footer */}
      <footer
        data-site-section="footer"
        className="border-t border-stone-200 bg-white py-12"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-6 sm:grid-cols-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-stone-900">{name}</p>
            {has(content.brand.tagline) && (
              <p className="mt-2 text-sm text-stone-500">{content.brand.tagline}</p>
            )}
          </div>

          {sections.contact(content) && (
            <ContactBlock content={content} className="text-sm text-stone-500" />
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
                  className="text-stone-500 underline-offset-4 transition-colors hover:text-stone-900 hover:underline"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-stone-200 px-5 pt-6 sm:px-6">
          <p className="text-xs text-stone-400">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The small caps line above a heading. The one label treatment this design uses. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs font-semibold tracking-[0.24em] text-[var(--accent)] uppercase">
      {children}
    </p>
  );
}
