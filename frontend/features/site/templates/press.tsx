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
 * Press — classical and centred.
 *
 * Ruled hairlines, small caps and a narrow measure, so the page reads like a
 * printed menu rather than a website. Everything is centred and the column is kept
 * deliberately narrow: this design is for restaurants with little to say and a wish
 * to say it well, and a wide measure would undo that.
 */
export function PressTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);

  return (
    <div
      style={accentStyle(content.theme.accent, "#1e3a5f")}
      className="min-h-screen bg-white font-serif text-neutral-800 antialiased"
    >
      <div className="mx-auto max-w-3xl px-6">
        <header data-site-section="hero" className="border-b border-neutral-300 py-14 text-center">
          <p className="text-[0.7rem] tracking-[0.4em] text-neutral-500 uppercase">
            {has(content.hero.eyebrow) ? content.hero.eyebrow : "Established"}
          </p>
          <h1 className="mt-5 text-4xl tracking-tight text-balance text-neutral-900 sm:text-5xl">
            {name}
          </h1>
          {has(content.brand.tagline) && (
            <p className="mt-3 text-sm tracking-widest text-neutral-500 uppercase">
              {content.brand.tagline}
            </p>
          )}
          <Rule />
          {has(content.hero.headline) && (
            <p className="text-2xl leading-snug text-balance text-neutral-700 italic">
              {content.hero.headline}
            </p>
          )}
          {has(content.hero.body) && (
            <p className="mx-auto mt-5 max-w-xl text-pretty text-neutral-600">
              {content.hero.body}
            </p>
          )}
          {(primary !== null || secondary !== null) && (
            <div className="mt-8 flex flex-wrap justify-center gap-6 font-sans text-xs tracking-[0.2em] uppercase">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="border-b border-[var(--accent)] pb-1 text-[var(--accent)]"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="border-b border-neutral-300 pb-1 text-neutral-500 hover:border-neutral-500"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          )}
        </header>

        <SiteImageEl
          url={content.hero.imageUrl}
          alt=""
          className="mt-10 aspect-16/9 w-full object-cover"
        />

        {sections.about(content) && (
          <section data-site-section="about" className="py-16 text-center">
            <SectionHeading>
              {has(content.about.title) ? content.about.title : "Our story"}
            </SectionHeading>
            <div className="mx-auto flex max-w-xl flex-col gap-4 text-pretty text-neutral-600">
              {paragraphs(content.about.body).map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          </section>
        )}

        {sections.dishes(content) && (
          <section data-site-section="dishes" className="border-t border-neutral-300 py-16">
            <SectionHeading>The menu</SectionHeading>
            <ul className="flex flex-col gap-7">
              {content.dishes.map((dish, index) => (
                <li key={index} className="text-center">
                  <h3 className="text-xl text-neutral-900">{dish.name}</h3>
                  {has(dish.description) && (
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-pretty text-neutral-500 italic">
                      {dish.description}
                    </p>
                  )}
                  {has(dish.price) && (
                    <p className="mt-2 font-sans text-xs tracking-[0.2em] text-[var(--accent)]">
                      {dish.price}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sections.features(content) && (
          <section data-site-section="features" className="border-t border-neutral-300 py-14">
            <div className="grid gap-8 text-center sm:grid-cols-3">
              {content.features.map((feature, index) => (
                <div key={index}>
                  <h3 className="font-sans text-xs tracking-[0.2em] text-neutral-900 uppercase">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.testimonials(content) && (
          <section data-site-section="testimonials" className="border-t border-neutral-300 py-16 text-center">
            {content.testimonials.map((quote, index) => (
              <figure key={index} className="mb-10 last:mb-0">
                <blockquote className="mx-auto max-w-xl text-xl leading-relaxed text-balance text-neutral-700 italic">
                  “{quote.quote}”
                </blockquote>
                {has(quote.author) && (
                  <figcaption className="mt-4 font-sans text-[0.7rem] tracking-[0.3em] text-neutral-500 uppercase">
                    {quote.author}
                  </figcaption>
                )}
              </figure>
            ))}
          </section>
        )}
      </div>

      {sections.gallery(content) && (
        <section data-site-section="gallery" className="mx-auto grid max-w-5xl grid-cols-2 gap-1 px-6 py-10 md:grid-cols-3">
          {content.gallery.map((image, index) => (
            <SiteImageEl
              key={index}
              url={image.imageUrl}
              alt={image.caption}
              className="aspect-square w-full object-cover"
            />
          ))}
        </section>
      )}

      <div className="mx-auto max-w-3xl px-6">
        {(sections.hours(content) || sections.contact(content)) && (
          <section data-site-section="hours" className="grid gap-12 border-t border-neutral-300 py-16 text-center sm:grid-cols-2">
            {sections.hours(content) && (
              <div data-site-section="hours">
                <SectionHeading>Hours</SectionHeading>
                <dl className="flex flex-col gap-2 text-sm">
                  {content.hours.map((row, index) => (
                    <div key={index}>
                      <dt className="font-sans text-[0.7rem] tracking-[0.2em] text-neutral-500 uppercase">
                        {row.label}
                      </dt>
                      <dd className="text-neutral-800">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {sections.contact(content) && (
              <div data-site-section="contact">
                <SectionHeading>Find us</SectionHeading>
                <ContactBlock
                  content={content}
                  className="items-center text-sm text-neutral-600"
                />
              </div>
            )}
          </section>
        )}

        {sections.cta(content) && (
          <section data-site-section="cta" className="border-t border-neutral-300 py-16 text-center">
            {has(content.callToAction.title) && (
              <h2 className="text-3xl text-balance text-neutral-900">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mx-auto mt-4 max-w-lg text-pretty text-neutral-600">
                {content.callToAction.body}
              </p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-7 inline-block border border-[var(--accent)] px-8 py-3 font-sans text-xs tracking-[0.2em] text-[var(--accent)] uppercase transition-colors hover:bg-[var(--accent)] hover:text-white"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </section>
        )}

        <footer data-site-section="footer" className="border-t border-neutral-300 py-10 text-center">
          <nav className="flex flex-wrap justify-center gap-6 font-sans text-[0.7rem] tracking-[0.2em] uppercase">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
          <p className="mt-5 text-xs text-neutral-400">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
        </footer>
      </div>
    </div>
  );
}

/** A centred heading with the rule this design uses everywhere. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-center font-sans text-[0.7rem] tracking-[0.35em] text-neutral-500 uppercase">
        {children}
      </h2>
      <Rule />
    </>
  );
}

/** The short centred rule that separates every block in this design. */
function Rule() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto my-6 h-px w-16 bg-[var(--accent)] opacity-60"
    />
  );
}
