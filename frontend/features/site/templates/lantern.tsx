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
 * Lantern — bright and blocky.
 *
 * Strong colour fields, asymmetric layout and large numerals. Aimed younger than
 * the others, and the one design that does not need photographs at all: colour
 * blocks do the work a picture does elsewhere, so a cafe with nothing but a phone
 * camera still gets a page that looks finished.
 */
export function LanternTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);
  const ctaHref = safeHref(content.callToAction.buttonHref);

  return (
    <div
      style={accentStyle(content.theme.accent, "#e11d48")}
      className="min-h-screen bg-yellow-50 font-sans text-neutral-900 antialiased"
    >
      <nav className="border-b-4 border-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-xl font-black tracking-tight">{name}</span>
          {has(content.brand.tagline) && (
            <span className="hidden rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-white sm:block">
              {content.brand.tagline}
            </span>
          )}
        </div>
      </nav>

      <header className="border-b-4 border-neutral-900">
        <div className="mx-auto grid max-w-6xl gap-0 md:grid-cols-2">
          <div className="flex flex-col justify-center px-6 py-16 md:py-24">
            {has(content.hero.eyebrow) && (
              <p className="mb-4 text-xs font-black tracking-[0.2em] text-[var(--accent)] uppercase">
                {content.hero.eyebrow}
              </p>
            )}
            <h1 className="text-5xl leading-[0.95] font-black tracking-tighter text-balance sm:text-7xl">
              {has(content.hero.headline) ? content.hero.headline : name}
            </h1>
            {has(content.hero.body) && (
              <p className="mt-6 max-w-md text-lg text-pretty text-neutral-700">
                {content.hero.body}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="rounded-full bg-neutral-900 px-7 py-3.5 text-sm font-bold text-yellow-50 transition-transform hover:-translate-y-0.5"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="rounded-full border-2 border-neutral-900 px-7 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          </div>

          <div className="relative min-h-[18rem] bg-[var(--accent)]">
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </header>

      {sections.features(content) && (
        <section className="border-b-4 border-neutral-900 bg-[var(--accent)] text-white">
          <div className="mx-auto grid max-w-6xl divide-y-4 divide-neutral-900 sm:grid-cols-3 sm:divide-x-4 sm:divide-y-0">
            {content.features.map((feature, index) => (
              <div key={index} className="px-6 py-10">
                <span className="text-4xl font-black tabular-nums opacity-40">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-xl font-black">{feature.title}</h3>
                <p className="mt-2 text-sm opacity-90">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.about(content) && (
        <section className="border-b-4 border-neutral-900">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-[1fr_1.2fr]">
            <SiteImageEl
              url={content.about.imageUrl}
              alt={content.about.title}
              className="aspect-square w-full rounded-3xl border-4 border-neutral-900 object-cover"
            />
            <div>
              {has(content.about.title) && (
                <h2 className="text-4xl font-black tracking-tight">
                  {content.about.title}
                </h2>
              )}
              <div className="mt-5 flex flex-col gap-4 text-pretty text-neutral-700">
                {paragraphs(content.about.body).map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {sections.dishes(content) && (
        <section className="border-b-4 border-neutral-900 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-4xl font-black tracking-tight">The good stuff</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {content.dishes.map((dish, index) => (
                <article
                  key={index}
                  className="overflow-hidden rounded-3xl border-4 border-neutral-900 bg-white"
                >
                  <div className="aspect-4/3 w-full bg-[var(--accent)]">
                    <SiteImageEl
                      url={dish.imageUrl}
                      alt={dish.name}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="border-t-4 border-neutral-900 p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-lg font-black">{dish.name}</h3>
                      {has(dish.price) && (
                        <span className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-yellow-50">
                          {dish.price}
                        </span>
                      )}
                    </div>
                    {has(dish.description) && (
                      <p className="mt-2 text-sm text-neutral-600">{dish.description}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.gallery(content) && (
        <section className="border-b-4 border-neutral-900">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-16 md:grid-cols-4">
            {content.gallery.map((image, index) => (
              <SiteImageEl
                key={index}
                url={image.imageUrl}
                alt={image.caption}
                className="aspect-square w-full rounded-2xl border-4 border-neutral-900 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {sections.testimonials(content) && (
        <section className="border-b-4 border-neutral-900 bg-neutral-900 py-16 text-yellow-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-2">
            {content.testimonials.map((quote, index) => (
              <figure key={index}>
                <blockquote className="text-xl font-bold text-pretty">
                  “{quote.quote}”
                </blockquote>
                {has(quote.author) && (
                  <figcaption className="mt-3 text-sm text-[var(--accent)]">
                    {quote.author}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {(sections.hours(content) || sections.contact(content)) && (
        <section className="border-b-4 border-neutral-900">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
            {sections.hours(content) && (
              <div>
                <h2 className="text-2xl font-black">When we are open</h2>
                <dl className="mt-5 flex flex-col gap-2 text-sm">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 rounded-lg bg-white px-3 py-2"
                    >
                      <dt className="text-neutral-500">{row.label}</dt>
                      <dd className="font-bold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {sections.contact(content) && (
              <div>
                <h2 className="text-2xl font-black">Come find us</h2>
                <ContactBlock content={content} className="mt-5 text-sm text-neutral-700" />
              </div>
            )}
          </div>
        </section>
      )}

      {sections.cta(content) && (
        <section className="bg-[var(--accent)] py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            {has(content.callToAction.title) && (
              <h2 className="text-4xl font-black tracking-tight text-balance sm:text-5xl">
                {content.callToAction.title}
              </h2>
            )}
            {has(content.callToAction.body) && (
              <p className="mt-4 text-lg text-pretty opacity-90">
                {content.callToAction.body}
              </p>
            )}
            {ctaHref !== null && has(content.callToAction.buttonLabel) && (
              <a
                href={ctaHref}
                className="mt-8 inline-block rounded-full bg-neutral-900 px-9 py-4 font-bold text-yellow-50 transition-transform hover:-translate-y-0.5"
              >
                {content.callToAction.buttonLabel}
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="bg-neutral-900 py-10 text-yellow-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm">
          <p className="font-bold">
            {has(content.footer.note) ? content.footer.note : name}
          </p>
          <nav className="flex flex-wrap gap-5">
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
        </div>
      </footer>
    </div>
  );
}
