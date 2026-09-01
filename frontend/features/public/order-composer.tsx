"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChefHat,
  Minus,
  Plus,
  List,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { EmptyState, FormError } from "@/components/ui/states";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { cn } from "@/lib/utils/cn";
import type {
  PublicMenuItem,
  PublicMenuSection,
} from "@/types/public-ordering";

/**
 * Choosing what to eat.
 *
 * One component behind both ways of ordering — the pad a member of staff opens by
 * scanning a table, and the page a customer reaches from the restaurant's website.
 * They were two copies of the same list, which is two places for the same mistake and
 * two places to fix anything learned from watching somebody use it.
 *
 * What the copies got wrong, and what this exists to correct:
 *
 * A long menu was a single scroll. Twenty-five dishes across five courses meant
 * hunting, so there is now a strip of course links that follows the page and marks
 * where you are, and a search box for anybody who already knows what they want.
 *
 * The basket could not be looked at. The old bar showed a count and a total and
 * nothing else: you sent the order without ever seeing it written down, and the only
 * way to change your mind was to scroll back and find the dish again. It opens now.
 *
 * Dishes were rows in a list with a thumbnail bolted on the side. They are cards
 * now, two across even on a phone, led by the picture at a size somebody can actually
 * judge food by — which is the point of having uploaded it. Two columns also put
 * twice as much of the menu on a screen, which on a menu this long is the difference
 * between browsing and hunting. A dish with no photograph gets the same tile carrying
 * a mark, so a mixed menu still lines up.
 *
 * It is built for a thumb in a busy room either way: no account, no payment, and
 * every control big enough to hit without looking.
 */

export interface OrderDraftLine {
  menuItemId: string;
  quantity: number;
  note?: string | null;
}

export function OrderComposer({
  menu,
  onPlace,
  placing,
  error,
  disabledReason,
}: {
  menu: PublicMenuSection[];
  onPlace: (items: OrderDraftLine[], note: string) => Promise<void> | void;
  placing: boolean;
  error: string | null;
  /** Set to explain why nothing can be ordered yet. Blocks the whole composer. */
  disabledReason?: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sectionRefs = useRef(new Map<string, HTMLElement>());

  const byId = useMemo(() => {
    const map = new Map<string, PublicMenuItem>();

    for (const section of menu) {
      for (const item of section.items) {
        map.set(item.id, item);
      }
    }

    return map;
  }, [menu]);

  const term = search.trim().toLowerCase();

  // Sections with nothing left after a search are dropped rather than shown empty: a
  // heading over nothing reads as something having failed to load.
  const shown = useMemo(() => {
    if (term === "") {
      return menu;
    }

    return menu
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            (item.description ?? "").toLowerCase().includes(term),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [menu, term]);

  // Which course is on screen, so the strip can say where you are.
  //
  // This was an IntersectionObserver over a band near the top, and it was wrong twice.
  // It took the topmost intersecting section, which is the one that *started* highest -
  // so reading Desserts highlighted Beverages, because Beverages began further up and
  // its tail was still in the band. And a short last course could never win at all: the
  // page runs out of scroll before its heading ever reaches the band.
  //
  // Asking directly is both simpler and correct. A course becomes current when its
  // heading passes a line under the sticky bar, and stays current until the next one
  // does - which is what somebody reading the page would say is happening. Throttled
  // to one measurement a frame, so a flick costs a handful of rect reads rather than
  // one per scroll event.
  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;

      // Sorted by position rather than trusted to insertion order, because a search
      // adds and removes sections and the map keeps whatever order that left behind.
      const ordered = [...sectionRefs.current.entries()].sort(
        (a, b) => a[1].offsetTop - b[1].offsetTop,
      );

      if (ordered.length === 0) {
        return;
      }

      // At the bottom the last course wins, however short it is. Without this a final
      // course of three dishes is unreachable by the highlight: there is no scroll
      // left to bring its heading up to the line.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;

      if (atBottom) {
        setActiveSection(ordered[ordered.length - 1]![0]);
        return;
      }

      // Just below the sticky bar, so a heading counts as reached when it arrives
      // where the eye already is.
      const line = 140;
      let current = ordered[0]![0];

      for (const [name, element] of ordered) {
        if (element.getBoundingClientRect().top <= line) {
          current = name;
        }
      }

      setActiveSection(current);
    }

    function onScroll() {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [shown]);

  const chosen = Object.entries(quantities).filter(
    ([, quantity]) => quantity > 0,
  );
  const count = chosen.reduce((total, [, quantity]) => total + quantity, 0);
  const total = chosen.reduce(
    (sum, [id, quantity]) => sum + (byId.get(id)?.price ?? 0) * quantity,
    0,
  );

  function adjust(id: string, by: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(99, (current[id] ?? 0) + by)),
    }));
  }

  function jumpTo(name: string) {
    sectionRefs.current
      .get(name)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function place() {
    try {
      await onPlace(
        chosen.map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
          // One note for the whole order, copied onto each line. Nobody on a phone
          // fills in six separate boxes, and the kitchen reads it per line anyway.
          note: note.trim() === "" ? null : note.trim(),
        })),
        note.trim(),
      );

      setQuantities({});
      setNote("");
      setIsBasketOpen(false);
    } catch {
      // Swallowed on purpose. The page above has already turned this into a message
      // and handed it back through the error prop; what matters here is that the
      // basket stays open and keeps everything, because losing an assembled order to
      // a blink of network is the worst thing this screen could do to somebody.
    }
  }

  if (disabledReason !== undefined) {
    return (
      <Surface className="p-4">
        <p className="text-sm text-text">{disabledReason}</p>
      </Surface>
    );
  }

  if (menu.length === 0) {
    return (
      <Surface>
        <EmptyState
          icon={<ChefHat />}
          title="Nothing on the menu yet"
          description="Please ask a member of staff."
        />
      </Surface>
    );
  }

  return (
    <>
      {/* Sticky, because on a menu this long the way back to another course is the
          control you reach for most. Search sits with it rather than at the top of
          the page, where it would scroll away exactly when it became useful. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-canvas/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search the menu"
            className="h-10 pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search the menu"
          />
        </div>

        {term === "" && menu.length > 1 && (
          <CourseNav menu={menu} active={activeSection} onJump={jumpTo} />
        )}
      </div>

      {shown.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<Search />}
            title="Nothing matches"
            description={`No dish answers to “${search.trim()}”.`}
            action={
              <Button variant="secondary" onClick={() => setSearch("")}>
                Clear
              </Button>
            }
          />
        </Surface>
      ) : (
        shown.map((section) => (
          <MenuSection
            key={section.name}
            section={section}
            quantities={quantities}
            onAdjust={adjust}
            register={(element) => {
              if (element === null) {
                sectionRefs.current.delete(section.name);
              } else {
                sectionRefs.current.set(section.name, element);
              }
            }}
          />
        ))
      )}

      {/* The bar is a way in to the basket, not a substitute for it. It says how much
          and how many; pressing it shows what. */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <Button
              size="md"
              className="h-12 w-full justify-between text-base"
              onClick={() => setIsBasketOpen(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-4" aria-hidden="true" />
                {count} {count === 1 ? "item" : "items"}
              </span>
              <span className="tabular">{total.toFixed(2)}</span>
            </Button>
          </div>
        </div>
      )}

      {isBasketOpen && (
        <Basket
          lines={chosen.map(([id, quantity]) => ({
            item: byId.get(id),
            quantity,
          }))}
          total={total}
          note={note}
          onNote={setNote}
          onAdjust={adjust}
          onRemove={(id) =>
            setQuantities((current) => ({ ...current, [id]: 0 }))
          }
          onClose={() => setIsBasketOpen(false)}
          onPlace={() => void place()}
          placing={placing}
          error={error}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Getting between courses                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The way around a menu with more than one course on it.
 *
 * A plain scrolling strip of names was fine for four courses and useless for fifteen:
 * the ones past the right edge were invisible, there was nothing to say they existed,
 * and the course you were actually in could be scrolled out of sight while you read
 * it. Three things fix that, and none of them is a redesign.
 *
 * The strip follows you. As the page scrolls into a new course its name is brought
 * back into view, so the highlight is always somewhere you can see.
 *
 * The right edge fades while there is more to reach, and the left edge does the same
 * once you have moved. A hard cut says "the list ends here"; a fade says "keep going",
 * and it only appears when it is true.
 *
 * And there is a way out of scrolling altogether. The button at the end opens every
 * course at once as a list, with how many dishes are in each - which is the answer
 * for a menu long enough that hunting sideways stops being reasonable.
 */
function CourseNav({
  menu,
  active,
  onJump,
}: {
  menu: PublicMenuSection[];
  active: string | null;
  onJump: (name: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const strip = stripRef.current;

    if (strip === null) {
      return;
    }

    // A pixel of slack, because sub-pixel layout means scrollLeft rarely lands
    // exactly on the maximum and the fade would never switch off.
    setEdges({
      left: strip.scrollLeft > 1,
      right: strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1,
    });
  }, []);

  useEffect(() => {
    const strip = stripRef.current;

    if (strip === null) {
      return;
    }

    measure();
    strip.addEventListener("scroll", measure, { passive: true });

    // Also on resize: how many names fit changes with the window, and on a phone it
    // changes when the keyboard opens under the search box above.
    const observer = new ResizeObserver(measure);
    observer.observe(strip);

    return () => {
      strip.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, menu.length]);

  // Keeps the course you are in visible. Centred rather than merely scrolled into
  // view, so the names either side stay reachable instead of the highlight sitting
  // against an edge.
  useEffect(() => {
    if (active === null) {
      return;
    }

    stripRef.current
      ?.querySelector(`[data-course="${CSS.escape(active)}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [active]);

  return (
    <div className="mt-2 flex items-center gap-1">
      <div className="relative min-w-0 flex-1">
        <div
          ref={stripRef}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {menu.map((section) => (
            <button
              key={section.name}
              type="button"
              data-course={section.name}
              onClick={() => onJump(section.name)}
              aria-current={active === section.name ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                active === section.name
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-muted hover:bg-surface-3 hover:text-text",
              )}
            >
              {section.name}
            </button>
          ))}
        </div>

        {/* Painted over the strip rather than inside it, so they never take a name's
            place. Pointer events off, or they would swallow a tap on the pill under
            the fade. */}
        {edges.left && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-canvas to-transparent"
          />
        )}
        {edges.right && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Show every course"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-text"
      >
        <List className="size-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <Sheet title="Jump to a course" onClose={() => setIsOpen(false)}>
          <ul className="flex flex-col divide-y divide-border">
            {menu.map((section) => (
              <li key={section.name}>
                <button
                  type="button"
                  onClick={() => {
                    onJump(section.name);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-3",
                    active === section.name && "bg-primary-soft/50",
                  )}
                >
                  <span className="min-w-0 font-medium text-text">
                    {section.name}
                  </span>
                  <span className="shrink-0 text-xs tabular text-muted">
                    {section.items.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One course                                                                 */
/* -------------------------------------------------------------------------- */

function MenuSection({
  section,
  quantities,
  onAdjust,
  register,
}: {
  section: PublicMenuSection;
  quantities: Record<string, number>;
  onAdjust: (id: string, by: number) => void;
  register: (element: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={register}
      data-section={section.name}
      className="scroll-mt-28"
    >
      <Surface className="overflow-hidden">
        {section.imageUrl === null ? (
          // Not sticky. The course strip at the top of the page already answers
          // "where am I", and a second sticky bar under a sticky bar is two things
          // competing for the same few pixels - especially inside a panel that clips
          // its overflow, where sticky behaves differently than it reads.
          <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text">
            {section.name}
          </h2>
        ) : (
          <div className="relative isolate flex h-24 items-end border-b border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={apiAssetSrc(section.imageUrl)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 to-black/10"
            />
            <h2 className="px-4 py-2.5 text-base font-semibold text-white">
              {section.name}
            </h2>
          </div>
        )}

        {/* Two across on a phone, which is what a menu of photographs wants to be.
            A single column of wide rows makes a picture either tiny or enormous;
            two columns give each dish a square worth looking at and put twice as
            much of the menu on a screen. */}
        <ul className="grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-3">
          {section.items.map((item) => {
            const quantity = quantities[item.id] ?? 0;

            return (
              <li key={item.id}>
                <article
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border transition-colors",
                    // A chosen dish is tinted and outlined, so scrolling back through a
                    // long menu shows what is already in the basket without opening it.
                    quantity > 0
                      ? "border-primary-border bg-primary-soft/50"
                      : "border-border bg-surface",
                  )}
                >
                  <div className="relative aspect-4/3 w-full bg-surface-3">
                    {item.imageUrl === null ? (
                      <span className="flex size-full items-center justify-center">
                        <UtensilsCrossed
                          className="size-6 text-subtle"
                          aria-hidden="true"
                        />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={apiAssetSrc(item.imageUrl)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    )}

                    {/* Sat on the picture rather than under the text. It is the only
                        control on the card, it is the same place on every card, and
                        keeping it here leaves the whole width below for the name -
                        which at two columns on a phone is about as much room as a
                        dish name needs. */}
                    <div className="absolute right-1.5 bottom-1.5">
                      <Stepper
                        quantity={quantity}
                        label={item.name}
                        onAdjust={(by) => onAdjust(item.id, by)}
                        compact
                      />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                    <p className="text-sm leading-snug font-medium text-text">
                      {item.name}
                    </p>

                    {item.description !== null && (
                      <p className="line-clamp-2 text-2xs leading-snug text-muted">
                        {item.description}
                      </p>
                    )}

                    <p className="mt-auto pt-1.5 tabular font-semibold text-text">
                      {item.price.toFixed(2)}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </Surface>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The basket                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What is being ordered, written down, before it is sent.
 *
 * A sheet rather than a page, so the menu is still behind it and closing costs one
 * press. This is the step the old bar was missing entirely: an order went in without
 * anybody ever seeing it listed, and changing your mind meant scrolling back through
 * the menu to find the dish again.
 */
function Basket({
  lines,
  total,
  note,
  onNote,
  onAdjust,
  onRemove,
  onClose,
  onPlace,
  placing,
  error,
}: {
  lines: { item: PublicMenuItem | undefined; quantity: number }[];
  total: number;
  note: string;
  onNote: (value: string) => void;
  onAdjust: (id: string, by: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  onPlace: () => void;
  placing: boolean;
  error: string | null;
}) {
  return (
    <Sheet title="Your order" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col divide-y divide-border">
          {lines.map(({ item, quantity }) =>
            item === undefined ? null : (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="font-medium text-text">{item.name}</p>
                  <p className="text-xs tabular text-muted">
                    {quantity} × {item.price.toFixed(2)}
                  </p>
                </div>

                <span className="shrink-0 tabular font-medium text-text">
                  {(item.price * quantity).toFixed(2)}
                </span>

                <Stepper
                  quantity={quantity}
                  label={item.name}
                  onAdjust={(by) => onAdjust(item.id, by)}
                />

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ),
          )}
        </ul>

        <div className="px-4 py-3">
          <Textarea
            rows={2}
            maxLength={200}
            aria-label="Anything we should know"
            placeholder="Anything we should know? No ice, no nuts, extra spicy…"
            value={note}
            onChange={(event) => onNote(event.target.value)}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-3">
        {error !== null && <FormError message={error} />}

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ChefHat className="size-3.5 shrink-0" aria-hidden="true" />
          Staff send this to the kitchen. Pay with them at the end.
        </p>

        <Button
          size="md"
          className="h-12 w-full justify-between text-base"
          disabled={placing || lines.length === 0}
          onClick={onPlace}
        >
          <span>{placing ? "Sending…" : "Send the order"}</span>
          <span className="tabular">{total.toFixed(2)}</span>
        </Button>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* The shell both sheets share                                                */
/* -------------------------------------------------------------------------- */

/**
 * A panel that rises from the bottom of the screen.
 *
 * From the bottom rather than the middle, because both of the things that use it are
 * reached by a thumb at the bottom of a phone, and a centred dialog puts its close
 * button as far from that thumb as the screen allows.
 *
 * The menu stays visible behind it. Neither of these is a departure from the page -
 * one is a list of where to go on it, the other is what you have picked off it - so
 * covering it completely would lose the thread.
 *
 * Escape closes it, the backdrop closes it, and the header carries a real button,
 * because those are three different people's instincts and none of them is wrong.
 */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portalled to the body, and this is load-bearing rather than tidiness. The course
  // list opens from inside the sticky bar, and that bar carries backdrop-blur - which
  // makes it a containing block for fixed-positioned descendants, exactly the way a
  // transform does. Rendered in place, this panel pinned itself to the bar instead of
  // the viewport and came out across the top of the page with no backdrop at all.
  // Going through the body means no ancestor can ever do that to it again.
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-xl border-t border-border bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Quantity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Plus and minus with a count between them.
 *
 * Bigger than the buttons anywhere else in the product, because this one is pressed
 * with a thumb by somebody holding a phone in a busy room. The minus disappears at
 * zero rather than sitting there disabled, so there is only ever one obvious thing to
 * press on a dish nobody has chosen.
 */
function Stepper({
  quantity,
  label,
  onAdjust,
  compact = false,
}: {
  quantity: number;
  label: string;
  onAdjust: (by: number) => void;
  /**
   * The form that sits on a photograph.
   *
   * Round, on its own opaque ground, and grouped into one pill so it reads as a
   * control rather than as buttons floating on a picture. Still 32 pixels a side,
   * which is the floor for something pressed with a thumb; smaller would look neater
   * and be missed.
   */
  compact?: boolean;
}) {
  const button = compact ? "size-8 rounded-full" : "size-9 rounded-md border";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center",
        compact
          ? "gap-0.5 rounded-full bg-surface/95 p-0.5 shadow-sm backdrop-blur"
          : "gap-1",
      )}
    >
      {quantity > 0 && (
        <>
          <button
            type="button"
            aria-label={`One fewer ${label}`}
            className={cn(
              "flex items-center justify-center text-text transition-colors hover:bg-surface-3",
              button,
              !compact && "border-border-strong bg-surface",
            )}
            onClick={() => onAdjust(-1)}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>

          <span
            aria-live="polite"
            className={cn(
              "text-center font-semibold text-text tabular",
              compact ? "w-5 text-sm" : "w-6 text-base",
            )}
          >
            {quantity}
          </span>
        </>
      )}

      <button
        type="button"
        aria-label={`One more ${label}`}
        className={cn(
          "flex items-center justify-center bg-primary-solid text-primary-fg transition-colors hover:bg-primary-hover",
          button,
          !compact && "border-primary-solid",
        )}
        onClick={() => onAdjust(1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
