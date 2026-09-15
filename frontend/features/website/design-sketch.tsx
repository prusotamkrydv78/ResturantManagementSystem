import { photoUrl, type PhotoTone } from "@/features/website/photos";
import { cn } from "@/lib/utils/cn";
import type { Design, DesignPalette } from "./designs";

/**
 * A design, drawn small enough to fit on a card.
 *
 * Not a wireframe. The first version of this was grey boxes on a pale ground, which
 * answered "how many sections does it have" and nothing anybody actually asks. A
 * person choosing a design wants to know what it will look like, and the two things
 * that decide that are the colours and whether the page is carried by photographs or
 * by type — so those are the two things this shows.
 *
 * Every card uses the design's own palette, and the ones whose pages are built out of
 * photographs use the real photographs. The result is close enough to be recognised
 * when the full page opens, and small enough that nobody mistakes it for the page
 * itself.
 *
 * Not the real template rendered small, either. That needs an iframe to get the media
 * queries right — a template in a 300px box lays itself out as a phone — and four
 * iframes on a gallery is a lot of machinery for a thumbnail. This is a drawing that
 * happens to be accurate.
 *
 * Decorative: the heading and description beside it carry the same information in
 * words, so it is hidden from assistive technology rather than described.
 */
export function DesignSketchView({
  design,
  className,
}: {
  design: Design;
  className?: string;
}) {
  const { palette } = design;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative aspect-4/3 w-full overflow-hidden border-b border-border",
        className,
      )}
      style={{ backgroundColor: palette.page }}
    >
      <Sketch design={design} />

      {/* A hairline of the accent along the bottom. Small, and it means the card
          carries the design's one non-neutral colour even when the sketch above is
          all type and rules. */}
      <span
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ backgroundColor: palette.accent }}
      />
    </div>
  );
}

/** What sits inside, which is the whole difference between the four. */
function Sketch({ design }: { design: Design }) {
  const { palette, sketch } = design;

  if (sketch === "gallery") {
    // Photographs first: a hero with the name over it, then a hand of pictures.
    return (
      <div className="flex h-full flex-col">
        <div className="relative flex-[1.6]">
          <Shot tone="room" className="absolute inset-0" />
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgb(10 7 6 / 0.45) 0%, transparent 45%, rgb(10 7 6 / 0.8) 100%)",
            }}
          />
          <span className="absolute inset-x-0 bottom-0 p-3">
            <span className="block font-serif text-lg leading-none text-white">
              The Copper Table
            </span>
            <span className="mt-1.5 block h-1 w-14 rounded-full bg-white/50" />
          </span>
        </div>

        <div className="flex flex-[1] gap-1 p-1">
          <Shot tone="fire" className="flex-1" />
          <Shot tone="plated" className="flex-1" />
          <Shot tone="greens" className="flex-1" />
        </div>
      </div>
    );
  }

  if (sketch === "editorial") {
    // The spine down the left and a hero so dark the photograph is texture. Both are
    // what somebody opening this design will actually see first, and neither was in
    // the wireframe this replaced.
    return (
      <div className="flex h-full">
        <div
          className="flex w-[27%] shrink-0 flex-col justify-between border-r px-3 py-3.5"
          style={{ borderColor: `${palette.ink}22` }}
        >
          <div>
            <span
              className="block font-serif text-[0.6rem] leading-[1.15]"
              style={{ color: palette.ink }}
            >
              The Copper Table
            </span>
            <span
              className="mt-1.5 block h-px w-4"
              style={{ backgroundColor: palette.accent }}
            />
            <div className="mt-4 flex flex-col gap-2">
              {["w-4/5", "w-3/5", "w-4/5"].map((width) => (
                <Line key={width} palette={palette} width={width} />
              ))}
            </div>
          </div>

          <span
            className="block h-3.5 w-full border"
            style={{ borderColor: `${palette.accent}88` }}
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <Shot tone="hall" className="absolute inset-0 brightness-[0.34] saturate-50" />
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgb(20 19 18 / 0.94) 0%, rgb(20 19 18 / 0.6) 100%)",
            }}
          />
          <span className="absolute inset-x-0 bottom-0 p-3.5">
            <span
              className="block font-serif text-base leading-none"
              style={{ color: palette.ink }}
            >
              The Copper Table
            </span>
            <span
              className="mt-2 block h-px w-8"
              style={{ backgroundColor: palette.accent }}
            />
          </span>
        </div>
      </div>
    );
  }

  if (sketch === "poster") {
    // Type over the picture rather than beside it, a solid colour strip, and an
    // offset pair below. The three things that make this design loud.
    return (
      <div className="flex h-full flex-col">
        <div className="relative flex-[2] px-3.5 pt-4">
          <Shot
            tone="greens"
            className="absolute inset-y-4 right-0 w-[52%] rounded-l-xl"
          />
          <span
            className="relative block font-serif text-[1.4rem] leading-[0.95]"
            style={{ color: palette.ink }}
          >
            Eat
            <br />
            loudly
          </span>
          <span
            className="relative mt-2 block h-1 w-8 rounded-full"
            style={{ backgroundColor: palette.accent }}
          />
        </div>

        <div
          className="flex shrink-0 items-center gap-3 px-3.5 py-2"
          style={{ backgroundColor: palette.accent }}
        >
          {["w-10", "w-7", "w-9", "w-6"].map((width) => (
            <span
              key={width}
              className={cn("block h-[3px] shrink-0 rounded-full", width)}
              style={{ backgroundColor: palette.page, opacity: 0.55 }}
            />
          ))}
        </div>

        <div className="flex flex-[1.1] gap-2 p-3">
          <Shot tone="plated" className="w-[38%] rounded-lg" />
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <Line palette={palette} width="w-2/5" strong />
            <Line palette={palette} width="w-full" />
            <Line palette={palette} width="w-5/6" />
            <Line palette={palette} width="w-3/4" />
          </span>
        </div>
      </div>
    );
  }

  // Split: a photograph on one half and a solid block on the other, meeting in the
  // middle. It is the whole design in one shape, and the card can show it exactly.
  return (
    <div className="flex h-full">
      <Shot tone="hall" className="w-1/2 shrink-0" />

      <div
        className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4"
        style={{ backgroundColor: palette.band }}
      >
        <span
          className="text-[0.4rem] tracking-[0.28em] uppercase"
          style={{ color: palette.accent }}
        >
          Dinner nightly
        </span>
        <span
          className="font-serif text-[1.05rem] leading-[0.98]"
          style={{ color: palette.page }}
        >
          Cooked
          <br />
          over fire
        </span>
        <span className="mt-1 flex flex-col gap-1.5">
          <span
            className="block h-[3px] w-full rounded-full"
            style={{ backgroundColor: palette.page, opacity: 0.25 }}
          />
          <span
            className="block h-[3px] w-4/5 rounded-full"
            style={{ backgroundColor: palette.page, opacity: 0.25 }}
          />
        </span>
        <span
          className="mt-1.5 block h-2.5 w-14 rounded-full"
          style={{ backgroundColor: palette.accent }}
        />
      </div>
    </div>
  );
}

/**
 * A real photograph, small.
 *
 * Asked for at thumbnail size rather than cropped from a large one: four cards each
 * pulling a two-thousand-pixel hero would make the gallery slower than the page it is
 * advertising, for pictures painted at a couple of hundred pixels across.
 */
function Shot({ tone, className }: { tone: PhotoTone; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(tone, 480, 360)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

/** A line of body copy. */
function Line({
  palette,
  width,
  strong = false,
}: {
  palette: DesignPalette;
  width: string;
  strong?: boolean;
}) {
  return (
    <span
      className={cn("block h-[3px] rounded-full", width)}
      style={{ backgroundColor: palette.ink, opacity: strong ? 0.45 : 0.18 }}
    />
  );
}
