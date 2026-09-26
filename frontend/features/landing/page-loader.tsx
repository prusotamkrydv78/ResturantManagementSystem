/**
 * The curtain the landing page opens with.
 *
 * Markup only, rendered on the server so it is the very first thing painted - no
 * flash of the page before it. LandingScroll plays it:
 *
 * 1. The jobs the product runs hit the screen one after another, each stamped
 *    down at its own spot around the edges - never the middle, which is kept for
 *    the name - while a lime line fills along the bottom with the count.
 * 2. Landed words keep floating, drifting on their own, while the name lands in
 *    the centre in lime, letter by letter.
 * 3. The words scatter outward, the name lifts out, and the sheet - five columns
 *    of ink - rises column by column to uncover the hero.
 *
 * Without script, or under reduced motion, it is never seen.
 */

/**
 * Where each word lands, as a percentage of the screen, all clear of the centre
 * band the name occupies. Sizes and tones vary so the scatter has depth.
 */
const WORDS = [
  { text: "Orders", x: 14, y: 20, size: "text-4xl sm:text-6xl", tone: "text-contrast-fg" },
  { text: "Kitchen", x: 76, y: 17, size: "text-5xl sm:text-7xl", tone: "text-accent" },
  { text: "Tables", x: 22, y: 78, size: "text-3xl sm:text-5xl", tone: "text-contrast-muted" },
  { text: "Bills", x: 80, y: 76, size: "text-4xl sm:text-6xl", tone: "text-contrast-fg" },
  { text: "Stock", x: 47, y: 12, size: "text-2xl sm:text-4xl", tone: "text-contrast-muted" },
  { text: "Bookings", x: 52, y: 88, size: "text-3xl sm:text-5xl", tone: "text-contrast-fg" },
  { text: "QR menu", x: 9, y: 50, size: "text-2xl sm:text-4xl", tone: "text-accent" },
  { text: "Reports", x: 90, y: 47, size: "text-2xl sm:text-4xl", tone: "text-contrast-muted" },
];
const NAME = "Restaurant OS";
const COLUMNS = 5;

export function PageLoader() {
  return (
    <div data-loader aria-hidden="true" className="fixed inset-0 z-[100] overflow-hidden text-contrast-fg">
      {/* The sheet, as columns so it can lift away in a stagger. */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: COLUMNS }, (_, index) => (
          <span key={index} data-loader-column className="-mr-px h-full flex-1 bg-contrast" />
        ))}
      </div>

      <div data-loader-content className="absolute inset-0">
        {WORDS.map(({ text, x, y, size, tone }) => (
          <span
            key={text}
            data-loader-word
            className={`invisible absolute leading-none font-semibold tracking-tighter whitespace-nowrap ${size} ${tone}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {text}
          </span>
        ))}

        {/* The name, centre stage. */}
        <div className="absolute inset-0 grid place-items-center">
          <p data-loader-name className="invisible pb-[0.12em] text-6xl leading-none font-semibold tracking-tighter whitespace-nowrap text-accent sm:text-8xl lg:text-[8.5rem]">
            {NAME.split("").map((char, index) => (
              <span key={index} data-loader-char className="inline-block whitespace-pre">
                {char}
              </span>
            ))}
          </p>
        </div>

        <div className="absolute inset-x-6 top-6 flex items-center justify-between font-mono text-2xs tracking-[0.2em] text-contrast-muted uppercase sm:inset-x-10 sm:top-8">
          <span data-loader-fade>Restaurant OS</span>
          <span data-loader-fade>From table to till</span>
        </div>

        <div className="absolute inset-x-6 bottom-6 flex items-end gap-4 sm:inset-x-10 sm:bottom-8">
          <div className="relative h-px flex-1 bg-contrast-raised">
            <span data-loader-bar className="absolute inset-0 origin-left scale-x-0 bg-accent" />
          </div>
          <span data-loader-count className="tabular font-mono text-sm font-semibold text-accent">
            0%
          </span>
        </div>
      </div>
    </div>
  );
}
