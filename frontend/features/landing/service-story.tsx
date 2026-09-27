/**
 * One evening's service, told by the scrollbar.
 *
 * Markup only. LandingScroll pins the section and scrubs through five moments of a
 * night - doors open, first tables, the rush, bills settling, close - while the
 * floor plan fills and empties, tickets pile onto the rail and drain away, and the
 * takings climb. Scrolling is the clock: the visitor moves time forward themselves,
 * which is what keeps them scrolling.
 *
 * Every figure is a script, and the section says it is an illustration.
 */

/** Table states per moment: 0 empty, 1 seated, 2 paying. */
export const STORY = [
  {
    time: "18:00",
    title: "Doors open.",
    line: "Floor set. Nothing on the rail yet.",
    tables: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    tickets: 0,
    takings: 0,
  },
  {
    time: "19:00",
    title: "First tables sit.",
    line: "Orders go straight to the kitchen.",
    tables: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    tickets: 3,
    takings: 3200,
  },
  {
    time: "20:00",
    title: "The rush.",
    line: "Every table full. Every ticket still in order.",
    tables: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    tickets: 11,
    takings: 18600,
  },
  {
    time: "21:30",
    title: "Bills settle themselves.",
    line: "Tables pay and free up on their own.",
    tables: [2, 1, 0, 2, 1, 1, 0, 2, 1, 0, 1, 0],
    tickets: 4,
    takings: 36900,
  },
  {
    time: "23:00",
    title: "Close.",
    line: "The day adds up. Nothing to reconcile.",
    tables: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    tickets: 0,
    takings: 48200,
  },
];

export function ServiceStory() {
  return (
    <section
      id="story"
      data-story
      aria-label="One evening's service, as an illustration"
      className="relative flex h-[calc(100svh_-_3.5rem)] min-h-[38rem] flex-col overflow-hidden rounded-[2rem] bg-contrast text-contrast-fg"
    >
      {/* The clock of the evening, down the left edge. */}
      <ol className="absolute top-1/2 left-6 hidden -translate-y-1/2 flex-col gap-5 font-mono text-xs sm:left-10 lg:flex">
        {STORY.map((moment, index) => (
          <li key={moment.time} data-story-mark={index} className="flex items-center gap-3 text-contrast-muted">
            <span data-story-tick className="h-px w-4 bg-current" />
            {moment.time}
          </li>
        ))}
      </ol>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:pl-32">
        {/* Words: every moment stacked in one cell, one showing at a time. */}
        <div className="grid">
          {STORY.map((moment, index) => (
            <div
              key={moment.time}
              data-story-frame={index}
              className="col-start-1 row-start-1 flex flex-col gap-4"
              style={index === 0 ? undefined : { visibility: "hidden" }}
            >
              <span className="tabular font-mono text-6xl font-semibold tracking-tight text-accent sm:text-8xl">
                {moment.time}
              </span>
              <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">{moment.title}</h2>
              <p className="text-lg text-contrast-muted">{moment.line}</p>
            </div>
          ))}
        </div>

        {/* The floor, the rail and the till. */}
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="grid grid-cols-4 gap-2.5 rounded-3xl bg-contrast-raised p-4 sm:gap-3 sm:p-5">
            {STORY[0]!.tables.map((_, table) => (
              <span
                key={table}
                data-story-table={table}
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-contrast text-xs font-semibold"
              >
                <span data-story-seated className="absolute inset-0 bg-accent opacity-0" />
                <span data-story-paying className="absolute inset-0 bg-panel opacity-0" />
                <span className="relative mix-blend-difference">T{table + 1}</span>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Meter label="Tables in use" hook="seated" suffix=" / 12" />
            <Meter label="On the rail" hook="tickets" suffix=" tickets" />
            <Meter label="Taken" hook="takings" prefix="NPR " accent />
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 sm:px-10">
        <div className="relative h-px bg-contrast-raised">
          <span data-story-bar className="absolute inset-0 origin-left scale-x-0 bg-accent" />
        </div>
      </div>
    </section>
  );
}

function Meter({
  label,
  hook,
  prefix = "",
  suffix = "",
  accent = false,
}: {
  label: string;
  hook: string;
  prefix?: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-3 sm:p-4 ${accent ? "bg-accent text-accent-fg" : "bg-contrast-raised"}`}>
      <span className="text-2xs font-medium opacity-75">{label}</span>
      <span className="tabular text-lg font-semibold tracking-tight sm:text-2xl">
        {prefix}
        <span data-story-meter={hook}>0</span>
        <span className="text-xs font-medium opacity-75">{suffix}</span>
      </span>
    </div>
  );
}
