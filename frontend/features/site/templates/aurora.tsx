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
 * Aurora — warm and photographic.
 *
 * A full-bleed hero with the name over the picture, generous spacing, rounded
 * corners. The design that most rewards good photographs and survives their
 * absence: without a hero image the same block becomes a deep warm gradient rather
 * than a grey rectangle, so an unfinished page still looks deliberate.
 */
export function AuroraTemplate({ content, restaurantName }: TemplateProps) {
  const name = brandName(content, restaurantName);
  const primary = safeHref(content.hero.primaryHref);
  const secondary = safeHref(content.hero.secondaryHref);

  return (
    <div
      style={accentStyle(content.theme.accent, "#c2410c")}
      className="min-h-screen bg-stone-50 font-sans text-stone-800 antialiased"
    >
      {/* Hero */}
      <header className="relative isolate flex min-h-[32rem] items-center overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-[var(--accent)]">
        {has(content.hero.imageUrl) && (
          <>
            <SiteImageEl
              url={content.hero.imageUrl}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-stone-950/55" />
          </>
        )}

        <div className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
          {has(content.hero.eyebrow) && (
            <p className="mb-4 text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">
              {content.hero.eyebrow}
            </p>
          )}

          <h1 className="text-4xl font-semibold tracking-tight text-balance text-white sm:text-6xl">
            {has(content.hero.headline) ? content.hero.headline : name}
          </h1>

          {has(content.hero.body) && (
            <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-white/85">
              {content.hero.body}
            </p>
          )}

          {(primary !== null || secondary !== null) && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {primary !== null && has(content.hero.primaryLabel) && (
                <a
                  href={primary}
                  className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                >
                  {content.hero.primaryLabel}
                </a>
              )}
              {secondary !== null && has(content.hero.secondaryLabel) && (
                <a
                  href={secondary}
                  className="rounded-full border border-white/40 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  {content.hero.secondaryLabel}
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Name band */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-6 py-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-stone-900">{name}</p>
          {has(content.brand.tagline) && (
            <p className="text-sm text-stone-500">{content.brand.tagline}</p>
          )}
        </div>
      </div>

      {sections.about(content) && (
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            {has(content.about.title) && (
              <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
                {content.about.title}
              </h2>
            )}
            <div className="mt-5 flex flex-col gap-4 text-pretty text-stone-600">
              {paragraphs(content.about.body).map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          </div>
          <SiteImageEl
            url={content.about.imageUrl}
            alt={content.about.title}
            className="aspect-4/3 w-full rounded-2xl object-cover shadow-xl"
          />
        </section>
      )}

      {sections.features(content) && (
        <section className="bg-white py-16">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-3">
            {content.features.map((feature, index) => (
              <div key={index} className="text-center">
                <div
                  aria-hidden="true"
                  className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--accent)]"
                />
                <h3 className="font-semibold text-stone-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-stone-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.dishes(content) && (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-stone-900">
            What we are known for
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {content.dishes.map((dish, index) => (
              <article
                key={index}
                className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-stone-200/70"
              >
                <SiteImageEl
                  url={dish.imageUrl}
                  alt={dish.name}
                  className="aspect-4/3 w-full object-cover"
                />
                <div className="flex flex-col gap-1.5 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-stone-900">{dish.name}</h3>
                    {has(dish.price) && (
                      <span className="shrink-0 font-semibold text-[var(--accent)]">
                        {dish.price}
                      </span>
                    )}
                  </div>
                  {has(dish.description) && (
                    <p className="text-sm text-stone-600">{dish.description}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {sections.gallery(content) && (
        <section className="bg-white py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-6 md:grid-cols-4">
            {content.gallery.map((image, index) => (
              <SiteImageEl
                key={index}
                url={image.imageUrl}
                alt={image.caption}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {sections.testimonials(content) && (
        <section className="mx-auto max-w-4xl px-6 py-20">
          <div className="grid gap-8 sm:grid-cols-2">
            {content.testimonials.map((quote, index) => (
              <figure
                key={index}
                className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70"
              >
                <blockquote className="text-pretty text-stone-700 italic">
                  “{quote.quote}”
                </blockquote>
                {has(quote.author) && (
                  <figcaption className="mt-4 text-sm font-medium text-stone-500">
                    — {quote.author}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {(sections.hours(content) || sections.contact(content)) && (
        <section className="bg-stone-900 py-20 text-stone-200">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-2">
            {sections.hours(content) && (
              <div>
                <h2 className="text-xl font-semibold text-white">Opening hours</h2>
                <dl className="mt-5 flex flex-col gap-2 text-sm">
                  {content.hours.map((row, index) => (
                    <div
                      key={index}
                      className="flex justify-between gap-4 border-b border-white/10 pb-2"
                    >
                      <dt className="text-stone-400">{row.label}</dt>
                      <dd className="font-medium text-white">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {sections.contact(content) && (
              <div>
                <h2 className="text-xl font-semibold text-white">Find us</h2>
                <ContactBlock content={content} className="mt-5 text-sm text-stone-300" />
              </div>
            )}
          </div>
        </section>
      )}

      {sections.cta(content) && <CallToActionBand content={content} />}

      <FooterBar content={content} name={name} />
    </div>
  );
}

/** The closing invitation above the footer. */
function CallToActionBand({
  content,
}: {
  content: import("@/types/site").SiteContent;
}) {
  const href = safeHref(content.callToAction.buttonHref);

  return (
    <section className="bg-[var(--accent)] py-16 text-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        {has(content.callToAction.title) && (
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {content.callToAction.title}
          </h2>
        )}
        {has(content.callToAction.body) && (
          <p className="mt-4 text-pretty text-white/90">{content.callToAction.body}</p>
        )}
        {href !== null && has(content.callToAction.buttonLabel) && (
          <a
            href={href}
            className="mt-8 inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-stone-900 transition-transform hover:scale-105"
          >
            {content.callToAction.buttonLabel}
          </a>
        )}
      </div>
    </section>
  );
}

/** The last line of the page. */
function FooterBar({
  content,
  name,
}: {
  content: import("@/types/site").SiteContent;
  name: string;
}) {
  return (
    <footer className="border-t border-stone-200 bg-white py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
        {content.footer.links.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-5 text-sm">
            {content.footer.links.map((link, index) => {
              const href = safeHref(link.url);

              return href === null ? null : (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        )}
        <p className="text-xs text-stone-500">
          {has(content.footer.note) ? content.footer.note : name}
        </p>
      </div>
    </footer>
  );
}
