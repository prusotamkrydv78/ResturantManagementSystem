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
 * Terrace — rustic and split.
 *
 * Alternating text-and-image bands on a paper ground, with serif headings. The
 * layout is built to carry a story rather than a picture: the about section gets
 * the same weight as the menu, and the bands alternate side so a long page keeps a
 * rhythm instead of becoming a column of cards.
 */
export function TerraceTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);

  return (
    <div
      style={accentStyle(content.theme.accent, "#7f5539")}
      className="min-h-screen bg-amber-50/60 font-serif text-stone-700 antialiased"
    >
      <header className="border-b-2 border-stone-800/10">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          {has(content.hero.eyebrow) && (
            <p className="mb-3 font-sans text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
              {content.hero.eyebrow}
            </p>
          )}
          <h1 className="text-5xl leading-tight text-balance text-stone-900 sm:text-6xl">
            {has(content.hero.headline) ? content.hero.headline : name}
          </h1>
          {has(content.brand.tagline) && (
            <p className="mt-3 font-sans text-sm tracking-wide text-stone-500">
              {content.brand.tagline}
            </p>
          )}
          {has(content.hero.body) && (
            <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-stone-600">
              {content.hero.body}
            </p>
          )}
          {(primary !== null || secondary !== null) && (
            <div className="mt-8 flex flex-wrap justify-center gap-3 font-sans text-sm">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="bg-[var(--accent)] px-6 py-3 font-medium text-amber-50 transition-opacity hover:opacity-90"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="border border-stone-400 px-6 py-3 font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          )}
        </div>

        <SiteImageEl
          url={content.hero.imageUrl}
          alt=""
          className="h-[26rem] w-full object-cover"
        />
      </header>

      {sections.about(content) && (
        <Band
          image={content.about.imageUrl}
          alt={content.about.title}
          reversed={false}
        >
          {has(content.about.title) && (
            <h2 className="text-4xl text-stone-900">{content.about.title}</h2>
          )}
          <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-pretty text-stone-600">
            {paragraphs(content.about.body).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        </Band>
      )}

      {sections.features(content) && (
        <section className="border-y-2 border-stone-800/10 bg-white/60 py-16">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-3">
            {content.features.map((feature, index) => (
              <div key={index} className="text-center">
                <h3 className="text-2xl text-stone-900">{feature.title}</h3>
                <p className="mt-2 font-sans text-sm text-stone-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.dishes(content) && (
        <section className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-4xl text-stone-900">From our kitchen</h2>
          <div
            aria-hidden="true"
            className="mx-auto mt-4 mb-12 h-px w-24 bg-[var(--accent)]"
          />
          <ul className="flex flex-col gap-8">
            {content.dishes.map((dish, index) => (
              <li key={index} className="flex items-start gap-5">
                <SiteImageEl
                  url={dish.imageUrl}
                  alt={dish.name}
                  className="size-24 shrink-0 rounded-sm object-cover"
                />
                <div className="min-w-0 flex-1">
                  {/* Dotted leader between the dish and the price, the way a printed
                      menu joins them across the gap. */}
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-xl text-stone-900">{dish.name}</h3>
                    <span
                      aria-hidden="true"
                      className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-stone-400"
                    />
                    {has(dish.price) && (
                      <span className="font-sans text-sm font-semibold text-[var(--accent)]">
                        {dish.price}
                      </span>
                    )}
                  </div>
                  {has(dish.description) && (
                    <p className="mt-1 font-sans text-sm text-stone-600">
                      {dish.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.gallery(content) && (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-6 pb-20 md:grid-cols-4">
          {content.gallery.map((image, index) => (
            <SiteImageEl
              key={index}
              url={image.imageUrl}
              alt={image.caption}
              className="aspect-square w-full rounded-sm object-cover sepia-[15%]"
            />
          ))}
        </section>
      )}

      {sections.testimonials(content) && (
        <section className="border-y-2 border-stone-800/10 bg-white/60 py-16">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-2">
            {content.testimonials.map((quote, index) => (
              <figure key={index} className="text-center">
                <blockquote className="text-xl text-pretty text-stone-700 italic">
                  “{quote.quote}”
                </blockquote>
                {has(quote.author) && (
                  <figcaption className="mt-3 font-sans text-xs tracking-widest text-stone-500 uppercase">
                    {quote.author}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {(sections.hours(content) || sections.contact(content)) && (
        <section className="mx-auto grid max-w-5xl gap-12 px-6 py-20 sm:grid-cols-2">
          {sections.hours(content) && (
            <div>
              <h2 className="text-3xl text-stone-900">Opening hours</h2>
              <dl className="mt-5 flex flex-col gap-2 font-sans text-sm">
                {content.hours.map((row, index) => (
                  <div
                    key={index}
                    className="flex justify-between gap-4 border-b border-dotted border-stone-300 pb-2"
                  >
                    <dt className="text-stone-500">{row.label}</dt>
                    <dd className="font-medium text-stone-800">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {sections.contact(content) && (
            <div>
              <h2 className="text-3xl text-stone-900">Find us</h2>
              <ContactBlock
                content={content}
                className="mt-5 font-sans text-sm text-stone-600"
              />
            </div>
          )}
        </section>
      )}

      {sections.cta(content) && (
        <section className="bg-[var(--accent)] py-16 text-amber-50">
          <div className="mx-auto max-w-2xl px-6 text-center">
            {has(content.callToAction.title) && (
              <h2 className="text-4xl text-balance">{content.callToAction.title}</h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-4 text-pretty opacity-90">{content.callToAction.body}</p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-8 inline-block bg-amber-50 px-8 py-3 font-sans text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="border-t-2 border-stone-800/10 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center font-sans text-xs text-stone-500">
          <nav className="flex flex-wrap justify-center gap-5">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
          <p>{has(content.footer.note) ? content.footer.note : name}</p>
        </div>
      </footer>
    </div>
  );
}

/** One text-and-image band. The side the picture sits on alternates down the page. */
function Band({
  image,
  alt,
  reversed,
  children,
}: {
  image: string;
  alt: string;
  reversed: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 md:grid-cols-2">
      <div className={reversed ? "md:order-2" : undefined}>{children}</div>
      <SiteImageEl
        url={image}
        alt={alt}
        className={`aspect-4/3 w-full rounded-sm object-cover shadow-lg ${
          reversed ? "md:order-1" : ""
        }`}
      />
    </section>
  );
}
