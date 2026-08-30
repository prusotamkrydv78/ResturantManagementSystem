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
 * Slate — dark and editorial.
 *
 * Type-led rather than picture-led: the headline is the largest thing on the page
 * and photographs are used as accents beside it. Dishes are a ruled list with prices
 * on the right, which is how a printed menu reads and how somebody scanning for a
 * price actually looks.
 */
export function SlateTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);

  return (
    <div
      style={accentStyle(content.theme.accent, "#d4a373")}
      className="min-h-screen bg-zinc-950 font-sans text-zinc-300 antialiased"
    >
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-6 py-5">
          <span className="text-sm font-semibold tracking-[0.2em] text-white uppercase">
            {name}
          </span>
          {has(content.brand.tagline) && (
            <span className="hidden text-xs text-zinc-500 sm:block">
              {content.brand.tagline}
            </span>
          )}
        </div>
      </nav>

      <header className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {has(content.hero.eyebrow) && (
            <p className="mb-6 text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
              {content.hero.eyebrow}
            </p>
          )}
          <h1 className="text-5xl leading-[1.05] font-light tracking-tight text-balance text-white sm:text-7xl">
            {has(content.hero.headline) ? content.hero.headline : name}
          </h1>
          {has(content.hero.body) && (
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-zinc-400">
              {content.hero.body}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-6 text-sm">
            {primary !== null && has(content.hero.primaryLabel) && (
              <a
                href={primary}
                className="border-b-2 border-[var(--accent)] pb-1 font-medium text-white transition-opacity hover:opacity-70"
              >
                {content.hero.primaryLabel}
              </a>
            )}
            {secondary !== null && has(content.hero.secondaryLabel) && (
              <a
                href={secondary}
                className="border-b-2 border-transparent pb-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
              >
                {content.hero.secondaryLabel}
              </a>
            )}
          </div>
        </div>

        <SiteImageEl
          url={content.hero.imageUrl}
          alt=""
          className="aspect-3/4 w-full object-cover grayscale-[35%]"
        />
      </header>

      {sections.about(content) && (
        <section className="border-y border-white/10 bg-zinc-900/40 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
            <h2 className="text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
              {has(content.about.title) ? content.about.title : "About"}
            </h2>
            <div className="flex flex-col gap-6 text-lg leading-relaxed text-pretty text-zinc-400">
              {paragraphs(content.about.body).map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.dishes(content) && (
        <section className="mx-auto max-w-4xl px-6 py-24">
          <h2 className="mb-12 text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
            The menu
          </h2>
          <ul className="flex flex-col">
            {content.dishes.map((dish, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-6 border-b border-white/10 py-6"
              >
                <div className="min-w-0">
                  <h3 className="text-xl font-light text-white">{dish.name}</h3>
                  {has(dish.description) && (
                    <p className="mt-1.5 text-sm text-zinc-500">{dish.description}</p>
                  )}
                </div>
                {has(dish.price) && (
                  <span className="shrink-0 font-light text-[var(--accent)] tabular-nums">
                    {dish.price}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.features(content) && (
        <section className="border-t border-white/10 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 sm:grid-cols-3">
            {content.features.map((feature, index) => (
              <div key={index}>
                <span className="text-xs text-zinc-600 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-medium text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.gallery(content) && (
        <section className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-white/10 md:grid-cols-3">
          {content.gallery.map((image, index) => (
            <SiteImageEl
              key={index}
              url={image.imageUrl}
              alt={image.caption}
              className="aspect-square w-full object-cover grayscale-[35%] transition-all duration-500 hover:grayscale-0"
            />
          ))}
        </section>
      )}

      {sections.testimonials(content) && (
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          {content.testimonials.map((quote, index) => (
            <figure key={index} className="mb-12 last:mb-0">
              <blockquote className="text-2xl leading-relaxed font-light text-balance text-zinc-200">
                “{quote.quote}”
              </blockquote>
              {has(quote.author) && (
                <figcaption className="mt-5 text-xs tracking-[0.2em] text-zinc-600 uppercase">
                  {quote.author}
                </figcaption>
              )}
            </figure>
          ))}
        </section>
      )}

      {(sections.hours(content) || sections.contact(content)) && (
        <section className="border-t border-white/10 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 sm:grid-cols-2">
            {sections.hours(content) && (
              <div>
                <h2 className="mb-6 text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
                  Hours
                </h2>
                <dl className="flex flex-col gap-3 text-sm">
                  {content.hours.map((row, index) => (
                    <div key={index} className="flex justify-between gap-4">
                      <dt className="text-zinc-500">{row.label}</dt>
                      <dd className="text-zinc-200">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {sections.contact(content) && (
              <div>
                <h2 className="mb-6 text-xs font-medium tracking-[0.3em] text-[var(--accent)] uppercase">
                  Find us
                </h2>
                <ContactBlock content={content} className="text-sm text-zinc-400" />
              </div>
            )}
          </div>
        </section>
      )}

      {sections.cta(content) && (
        <section className="border-t border-white/10 py-24 text-center">
          <div className="mx-auto max-w-2xl px-6">
            {has(content.callToAction.title) && (
              <h2 className="text-4xl font-light text-balance text-white">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-4 text-pretty text-zinc-400">{content.callToAction.body}</p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-8 inline-block border border-[var(--accent)] px-8 py-3 text-sm tracking-wide text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-zinc-950"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-zinc-600">
          <p>{has(content.footer.note) ? content.footer.note : name}</p>
          <nav className="flex flex-wrap gap-5">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-zinc-300"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
      </footer>
    </div>
  );
}
