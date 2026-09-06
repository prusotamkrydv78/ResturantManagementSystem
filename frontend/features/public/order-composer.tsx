"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowLeft,
  ChefHat,
  MessageSquarePlus,
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
import { Input } from "@/components/ui/input";
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

/**
 * How things move here, in two constants.
 *
 * Both are short, and that is the whole judgement. This component is the staff pad as
 * well as the customer's menu, and a waiter works it for a whole shift - anything that
 * reads as a flourish the first time is an obstruction by the fortieth. So nothing here
 * celebrates. What it does is stop things teleporting: a sheet that appears between two
 * frames, a bar that pops into existence under a thumb, and a row that vanishes out of a
 * list all read as glitches, and each one costs a beat of working out what happened.
 *
 * Reduced motion is honoured once, by the MotionConfig around the whole component.
 */
const SLIDE = { type: "spring", stiffness: 420, damping: 36 } as const;

/** For anything that responds to a finger. Faster and firmer than the slide. */
const PRESS = { type: "spring", stiffness: 520, damping: 26 } as const;

/**
 * Moving between the steps of the customer flow.
 *
 * Eased rather than sprung, and short. A spring overshoots, and a whole screen of menu
 * overshooting reads as the page having been knocked rather than as a step having been
 * taken.
 *
 * Which way each step slides is not tracked anywhere, because it does not need to be:
 * every step has a fixed place in the order, so the menu is always to the left of the
 * basket and the basket always to the right of the menu. A pane entering from its own
 * side and leaving towards it is correct going forwards and going back, with no notion
 * of direction held in state.
 */
const SWAP = { duration: 0.26, ease: [0.16, 1, 0.3, 1] } as const;

/** How far a pane travels. Enough to read as movement, not as a journey. */
const TRAVEL = 24;

export interface OrderDraftLine {
  menuItemId: string;
  quantity: number;
  note?: string | null;
}

export function OrderComposer({
  menu,
  currency,
  onPlace,
  placing,
  error,
  disabledReason,
  flow = "sheet",
  onStageChange,
  paused = false,
}: {
  menu: PublicMenuSection[];
  /**
   * The ISO code every amount here is in.
   *
   * Threaded all the way down to the dish tile rather than shown once at the top. Every
   * price on this component was a bare number - a menu of "450" and a bar reading
   * "1,118.70" - and a single note somewhere saying which currency scrolls away, which
   * makes it a note about the part of the menu you are not looking at.
   */
  currency: string;
  onPlace: (items: OrderDraftLine[]) => Promise<void> | void;
  placing: boolean;
  error: string | null;
  /** Set to explain why nothing can be ordered yet. Blocks the whole composer. */
  disabledReason?: string;
  /**
   * How the basket and the course list are presented.
   *
   * `sheet` slides them up over the menu, which is what a member of staff wants: they
   * know this flow, they run it forty times a shift, and they want the basket and the
   * menu at once rather than a wizard telling them where they are.
   *
   * `steps` gives each one the screen in turn, as a step of a numbered flow. A guest
   * does this once, has no idea how long it is, and had the most important part of it -
   * what they are about to pay for - living in a panel a stray tap could dismiss.
   *
   * Only the presentation differs. What is on the menu, what is in the basket and what
   * gets sent are the same code either way, which is the whole reason this is a prop
   * rather than a second component.
   */
  flow?: "sheet" | "steps";
  /**
   * Says which of the two the guest is looking at, so the page around it can act on
   * it. Only meaningful under `steps`.
   */
  onStageChange?: (stage: "menu" | "check") => void;
  /**
   * Renders nothing at all, while staying mounted.
   *
   * Which is the whole point: the basket lives in this component's state, so a page
   * showing an earlier step cannot afford to take it off the tree - going back to
   * correct a table would throw away everything chosen. Returning null keeps every
   * quantity and the note exactly where they were, and takes the floating basket bar
   * off the screen with it, which `display: none` on a wrapper could not do now that
   * the bar is portalled.
   */
  paused?: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  /**
   * What was asked for, dish by dish.
   *
   * There was one box for the whole order, and its contents were copied onto every
   * line - so a table ordering a biryani and a curry and typing "extra spicy" sent
   * "extra spicy" to the kitchen against *both*, and had no way of saying which they
   * meant. The wrong dish arriving altered is worse than the right one arriving plain,
   * and there was no way for a guest to tell it was going to happen.
   *
   * Keyed by menu item, which is how a line is identified everywhere else here. Two of
   * the same dish are one line and share one note, which the data model has always
   * said: an order item carries a quantity and a single instruction.
   */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sectionRefs = useRef(new Map<string, HTMLElement>());
  // Measured rather than assumed. What counts as "reached" is the line just under this
  // strip, and the strip is a different height on each page that uses it - the website
  // has a sticky bar above it and the scanned pad does not.
  const stickyRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => {
    const map = new Map<string, PublicMenuItem>();

    for (const section of menu) {
      for (const item of section.items) {
        map.set(item.id, item);
      }
    }

    return map;
  }, [menu]);

  const stepped = flow === "steps";

  // Told rather than asked, because the basket lives in here - the quantities are held
  // in this component and lifting them out to answer one question about presentation
  // would be the tail wagging the dog.
  useEffect(() => {
    onStageChange?.(isBasketOpen ? "check" : "menu");
  }, [isBasketOpen, onStageChange]);

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
      //
      // Read off the bar itself. It was a hardcoded 140, which had to be re-guessed
      // every time anything above it changed height - and silently drifted the moment
      // the website page grew a sticky header of its own.
      const line = (stickyRef.current?.getBoundingClientRect().bottom ?? 96) + 8;
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
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, (current[id] ?? 0) + by));

      // A dish taken back off the order takes its note with it. Left behind, it would
      // come back the moment somebody re-added the dish - a stale instruction nobody
      // typed this time, quietly attached to a line they thought was fresh.
      if (next === 0) {
        setNotes((kept) => {
          const { [id]: gone, ...rest } = kept;

          return gone === undefined ? kept : rest;
        });
      }

      return { ...current, [id]: next };
    });
  }

  /** Takes a line off entirely, note and all. */
  function remove(id: string) {
    setQuantities((current) => ({ ...current, [id]: 0 }));
    setNotes((current) => {
      const { [id]: gone, ...rest } = current;

      return gone === undefined ? current : rest;
    });
  }

  function noteFor(id: string, value: string) {
    setNotes((current) => ({ ...current, [id]: value }));
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
          // Whatever was asked for against this dish, and nothing from any other.
          note: (notes[menuItemId] ?? "").trim() || null,
        })),
      );

      setQuantities({});
      setNotes({});
      setIsBasketOpen(false);
    } catch {
      // Swallowed on purpose. The page above has already turned this into a message
      // and handed it back through the error prop; what matters here is that the
      // basket stays open and keeps everything, because losing an assembled order to
      // a blink of network is the worst thing this screen could do to somebody.
    }
  }

  // After every hook, deliberately. Bailing out earlier would change how many hooks
  // run between renders, which React forbids and which would take the basket with it.
  if (paused) {
    return null;
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

  // The check step, with the menu out of the way entirely rather than behind it. This
  // is the difference the `steps` flow is for: a guest reading their order back should
  // not be reading it through a hole in the thing they were just doing.
  //
  // Held as a value rather than returned early, so it and the menu can be the two sides
  // of one transition instead of two unrelated renders.
  const checkPane = (
    <Basket
      presentation="step"
          currency={currency}
          lines={chosen.map(([id, quantity]) => ({
            item: byId.get(id),
            quantity,
          }))}
          total={total}
          notes={notes}
          onNote={noteFor}
          onAdjust={adjust}
          onRemove={remove}
      onClose={() => setIsBasketOpen(false)}
      onPlace={() => void place()}
      placing={placing}
      error={error}
    />
  );

  const menuPane = (
    <>
      {/* Sticky, because on a menu this long the way back to another course is the
          control you reach for most. Search sits with it rather than at the top of
          the page, where it would scroll away exactly when it became useful. */}
      {/* Held below whatever the page puts above it. `--bar-h` is set by any page with
          a sticky bar of its own; without one it resolves to nothing and this sits at
          the top, which is what the scanned pad wants. */}
      <div
        ref={stickyRef}
        className="sticky top-[var(--bar-h,0px)] z-20 -mx-4 border-b border-border bg-canvas/95 px-4 py-2 backdrop-blur"
      >
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
          <CourseNav
            menu={menu}
            active={activeSection}
            onJump={jumpTo}
            inline={stepped}
          />
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
            currency={currency}
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

      {/* Wrapped so that closing is animated too. Without this the sheet is torn out
          of the tree the moment the flag flips and the slide down never happens - the
          one thing a class on an unmounting element cannot do. */}
      <AnimatePresence>
        {isBasketOpen && !stepped && (
        <Basket
          presentation="sheet"
          currency={currency}
          lines={chosen.map(([id, quantity]) => ({
            item: byId.get(id),
            quantity,
          }))}
          total={total}
          notes={notes}
          onNote={noteFor}
          onAdjust={adjust}
          onRemove={remove}
          onClose={() => setIsBasketOpen(false)}
          onPlace={() => void place()}
          placing={placing}
          error={error}
        />
        )}
      </AnimatePresence>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      {stepped ? (
        // One at a time, and the outgoing pane leaves before the incoming one arrives.
        // `wait` rather than an overlap on purpose: these two are whole screens of
        // different heights, and crossfading them makes the page grow and shrink under
        // a thumb mid-transition.
        <AnimatePresence mode="wait" initial={false}>
          {isBasketOpen ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, x: TRAVEL }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: TRAVEL }}
              transition={SWAP}
            >
              {checkPane}
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: -TRAVEL }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -TRAVEL }}
              transition={SWAP}
              // The gaps the page used to provide, now that these children sit inside
              // a wrapper rather than directly in its column.
              className="flex flex-col gap-4"
            >
              {menuPane}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        menuPane
      )}

      {/* Outside both panes, and portalled.

          It is `position: fixed`, and a transform on any ancestor makes that ancestor
          its containing block instead of the screen - so left inside the sliding pane
          it would travel with the menu and then sit at the bottom of the menu's box
          rather than the bottom of the phone. The same hazard the sheet documents.

          Not shown on the check step: the order is on screen there, in full, with its
          own send button. A bar inviting somebody to review what they are already
          reviewing is a second door into the same room. */}
      <BasketBar
        show={count > 0 && !(stepped && isBasketOpen)}
        count={count}
        total={total}
        currency={currency}
        stepped={stepped}
        onOpen={() => setIsBasketOpen(true)}
      />
    </MotionConfig>
  );
}

/**
 * The strip across the bottom that says what is in the basket.
 *
 * Its own component only so that it can be portalled without the rest of the composer
 * caring. See where it is used for why that matters.
 */
function BasketBar({
  show,
  count,
  total,
  currency,
  stepped,
  onOpen,
}: {
  show: boolean;
  count: number;
  total: number;
  currency: string;
  stepped: boolean;
  onOpen: () => void;
}) {
  return (
    <AnimatePresence>
      {show && <BasketBarBody
        count={count}
        total={total}
        currency={currency}
        stepped={stepped}
        onOpen={onOpen}
      />}
    </AnimatePresence>
  );
}

/**
 * The bar itself.
 *
 * Split from the presence wrapper above because `createPortal` needs `document`, and
 * this half only ever renders once something has been added - which cannot happen on a
 * server. The wrapper stays outside so it can hold this on screen long enough to slide
 * away.
 */
function BasketBarBody({
  count,
  total,
  currency,
  stepped,
  onOpen,
}: {
  count: number;
  total: number;
  currency: string;
  stepped: boolean;
  onOpen: () => void;
}) {
  return createPortal(
    // It slides in from under the screen on the first dish and back out on the last.
    // It used to appear and disappear between two frames, directly under the thumb that
    // had just pressed something forty pixels above - which reads as the page having
    // jumped rather than as a bar having arrived.
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={SLIDE}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface"
    >
      <div className="mx-auto max-w-2xl px-4 py-3">
        <Button
          size="md"
          className="h-12 w-full justify-between text-base"
          onClick={onOpen}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="size-4" aria-hidden="true" />
            {stepped
              ? `Review ${count} ${count === 1 ? "item" : "items"}`
              : `${count} ${count === 1 ? "item" : "items"}`}
          </span>
          <span className="tabular">
            {currency} {total.toFixed(2)}
          </span>
        </Button>
      </div>
    </motion.div>,
    document.body,
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
  inline = false,
  menu,
  active,
  onJump,
}: {
  /**
   * Whether the full course list opens in place instead of as a drawer.
   *
   * The customer flow has no drawers in it - see `flow` on OrderComposer - so there
   * the strip swaps itself for the whole list and swaps back, which is a state rather
   * than a panel over the top of one.
   */
  inline?: boolean;
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

  // Every course at once, in place of the strip rather than over the top of it.
  //
  // Same information as the drawer it replaces on the customer side, and one fewer
  // thing floating: the strip is what you were reading, so the list of everything in
  // it belongs where the strip was.
  if (inline && isOpen) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs font-medium tracking-wide text-muted uppercase">
            Every course
          </p>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="pressable rounded-md px-2 py-1 text-2xs font-medium text-primary"
          >
            Done
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {menu.map((section) => (
            <button
              key={section.name}
              type="button"
              onClick={() => {
                onJump(section.name);
                setIsOpen(false);
              }}
              className={cn(
                "pressable flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active === section.name
                  ? "border-primary bg-primary-soft font-medium text-primary"
                  : "border-border-strong text-text hover:bg-surface-3",
              )}
            >
              {section.name}
              <span className="text-2xs tabular text-muted">
                {section.items.length}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <div className="relative min-w-0 flex-1">
        {/* layoutScroll tells Motion this thing scrolls, so the pill below measures
            against the strip's current scroll position rather than where it was when
            the page loaded. Without it the highlight lands somewhere else entirely
            once the strip has been scrolled. */}
        <motion.div
          ref={stripRef}
          layoutScroll
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
                "pressable relative shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                active === section.name
                  ? "font-medium text-primary"
                  : "text-muted hover:bg-surface-3 hover:text-text",
              )}
            >
              {/* One element that moves between the courses rather than a background
                  that switches off here and on there. Scrolling a long menu now shows
                  the highlight travelling with you, which is the thing the strip is
                  for - saying where you are - and a highlight that teleports says it
                  a good deal less well. */}
              {active === section.name && (
                <motion.span
                  layoutId="course-pill"
                  aria-hidden="true"
                  transition={SLIDE}
                  className="absolute inset-0 rounded-full bg-primary-soft"
                />
              )}

              <span className="relative">{section.name}</span>
            </button>
          ))}
        </motion.div>

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
        className="pressable flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-text"
      >
        <List className="size-4" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen && !inline && (
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
                    "pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-3",
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
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One course                                                                 */
/* -------------------------------------------------------------------------- */

function MenuSection({
  section,
  currency,
  quantities,
  onAdjust,
  register,
}: {
  section: PublicMenuSection;
  /** The ISO code, so a tile can print it next to the price. */
  currency: string;
  quantities: Record<string, number>;
  onAdjust: (id: string, by: number) => void;
  register: (element: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={register}
      data-section={section.name}
      // Cleared of both bars, so jumping to a course does not park its heading
      // underneath them.
      className="scroll-mt-[calc(var(--bar-h,0px)+7rem)]"
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

                    {/* The code sits small and grey in front of the number, so the
                        price stays one thing to read rather than two.

                        Sized down to text-sm as well. It carried no size class at all,
                        so it fell back to the 16px body default and printed a pound
                        heavier than the dish name above it - the money shouting over
                        the food on every tile of the menu. */}
                    <p className="mt-auto flex items-baseline gap-1 pt-1.5">
                      <span className="text-2xs text-muted">{currency}</span>
                      <span className="text-sm tabular font-semibold text-text">
                        {item.price.toFixed(2)}
                      </span>
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
  presentation,
  currency,
  lines,
  total,
  notes,
  onNote,
  onAdjust,
  onRemove,
  onClose,
  onPlace,
  placing,
  error,
}: {
  /**
   * A drawer over the menu, or a step with the menu out of the way.
   *
   * The content is identical either way, which is the point of doing it here rather
   * than writing a second basket. See `flow` on OrderComposer for which gets which.
   */
  presentation: "sheet" | "step";
  currency: string;
  lines: { item: PublicMenuItem | undefined; quantity: number }[];
  total: number;
  /** What has been asked for against each dish, by menu item id. */
  notes: Record<string, string>;
  onNote: (id: string, value: string) => void;
  onAdjust: (id: string, by: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  onPlace: () => void;
  placing: boolean;
  error: string | null;
}) {
  // Written once and shelled twice. Everything below is the same list, the same note
  // box and the same send button whichever way it is presented; only what it sits in
  // changes, and that is the whole reason this is one component.
  const written = (
    <>
      <ul className="flex flex-col divide-y divide-border">
          {/* Rows fold shut instead of blinking out. Removing the middle of three
              things used to snap the two below it upwards, and the eye reads that as
              the list having changed by some unknown amount rather than as one line
              having gone - which on a bill is the wrong doubt to plant. */}
          <AnimatePresence initial={false}>
          {lines.map(({ item, quantity }) =>
            item === undefined ? null : (
              <BasketLine
                key={item.id}
                item={item}
                quantity={quantity}
                currency={currency}
                note={notes[item.id] ?? ""}
                onNote={(value) => onNote(item.id, value)}
                onAdjust={(by) => onAdjust(item.id, by)}
                onRemove={() => onRemove(item.id)}
              />
            ),
          )}
          </AnimatePresence>
        </ul>

    </>
  );

  const send = (
    <>
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
        <span className="tabular">
          {currency} {total.toFixed(2)}
        </span>
      </Button>
    </>
  );

  // The step. Nothing floats, nothing is dismissible by a tap in the wrong place, and
  // the page scrolls normally - so the send button is at the end of the thing being
  // read rather than pinned over the middle of it.
  if (presentation === "step") {
    return (
      <div className="flex flex-col gap-3">
        <Surface className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <h2 className="text-base font-semibold text-text">Your order</h2>
              {/* Said once at the top, because a control nobody has met yet cannot
                  explain itself. Between this and the box on each row, somebody who
                  wants their curry a particular way has two chances to notice. */}
              <p className="text-2xs text-muted">
                Want something changed? Add a note on any dish.
              </p>
            </div>

            {/* A labelled way back rather than a cross. A cross on a step reads as
                "cancel this", and going back to the menu abandons nothing. */}
            <button
              type="button"
              onClick={onClose}
              className="pressable flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-2xs font-medium text-text transition-colors hover:bg-surface-3"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Add more
            </button>
          </div>

          {written}
        </Surface>

        <Surface className="flex flex-col gap-3 p-4">{send}</Surface>
      </div>
    );
  }

  return (
    <Sheet title="Your order" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto">{written}</div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-3">
        {send}
      </div>
    </Sheet>
  );
}

/**
 * One line of the basket, and what was asked for against it.
 *
 * Its own component for the note, which needs a piece of state - whether the box is
 * open - that belongs to this row and nothing else. Held here rather than in the
 * basket so that opening one does not re-render the rest.
 *
 * The box starts open when there is already something in it, so a note survives being
 * scrolled past and comes back visible rather than hidden behind a button that gives no
 * sign of holding anything.
 */
function BasketLine({
  item,
  quantity,
  currency,
  note,
  onNote,
  onAdjust,
  onRemove,
}: {
  item: PublicMenuItem;
  quantity: number;
  currency: string;
  note: string;
  onNote: (value: string) => void;
  onAdjust: (by: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(note !== "");

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 1, 1] }}
      className="flex flex-col gap-2 overflow-hidden px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-medium text-text">{item.name}</p>
          <p className="text-xs tabular text-muted">
            {quantity} × {item.price.toFixed(2)}
          </p>
        </div>

        <span className="flex shrink-0 items-baseline gap-1">
          <span className="text-2xs text-muted">{currency}</span>
          <span className="tabular font-medium text-text">
            {(item.price * quantity).toFixed(2)}
          </span>
        </span>

        <Stepper
          quantity={quantity}
          label={item.name}
          onAdjust={onAdjust}
        />

        <motion.button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          whileTap={{ scale: 0.86 }}
          className="pressable shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </motion.button>
      </div>

      {/* Against the dish it belongs to, which is the whole fix. A note typed here
          reaches the kitchen on this line and no other.

          The two states are deliberately the same height, and that is what makes the
          swap look like anything. It used to grow the box from nothing while the
          button faded out on top of it and the row's own `layout` animated the height
          it was changing - three animations describing one event, arriving at slightly
          different times, so the row lurched taller and settled back. Matching the
          heights leaves nothing to animate but the crossfade, and `wait` keeps the two
          from occupying the same space while they do it. */}
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Input
              autoFocus={note === ""}
              maxLength={200}
              value={note}
              onChange={(event) => onNote(event.target.value)}
              onBlur={() => {
                // Folds away again only if nothing was typed, so an empty box does
                // not sit open on every line for the rest of the order.
                if (note.trim() === "") {
                  setOpen(false);
                }
              }}
              aria-label={`Anything to say about the ${item.name}`}
              placeholder="Extra spicy, no onions, well done…"
              className="w-full text-sm"
            />
          </motion.div>
        ) : (
          // Shaped like the empty field it becomes, rather than written as a link.
          //
          // It was a line of small green text under the price, and on a card carrying
          // a dish name, a price, a stepper and a bin it was the smallest thing on the
          // screen - so nobody found it, and the one thing this fix existed to offer
          // went unoffered. A dashed box the width of the row reads as somewhere to
          // type before a word of it is read, which is the only way an optional field
          // gets noticed on a screen somebody is trying to leave.
          <motion.button
            key="add"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            // h-9 to the pixel, because that is what Input renders at. Any difference
            // here and the row resizes mid-crossfade, which is the whole fault.
            className="pressable flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-border-strong px-2.5 text-left text-xs text-subtle transition-colors hover:border-primary-border hover:bg-primary-soft hover:text-primary"
          >
            <MessageSquarePlus className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">
              Add a note — extra spicy, no onions…
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
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
      {/* The dark ground fades rather than snapping on. Half the reason a sheet feels
          like it belongs to the page underneath is that the page is seen dimming. */}
      <motion.button
        type="button"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50"
      />

      {/* Up from the edge it is anchored to, and back down the same way.

          The way out matters more than the way in. A panel that is simply removed
          leaves a thumb hovering over whatever was behind it with no sense of having
          dismissed anything - and closing this is something a guest does repeatedly,
          checking the basket between courses. */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SLIDE}
        className="relative mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-xl border-t border-border bg-surface"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {children}
      </motion.div>
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
    <motion.div
      // The pill grows as the minus and the count arrive, rather than the plus jumping
      // sideways to make room for them.
      layout
      transition={PRESS}
      className={cn(
        "flex shrink-0 items-center",
        compact
          ? "gap-0.5 rounded-full bg-surface/95 p-0.5 shadow-sm backdrop-blur"
          : "gap-1",
      )}
    >
      {/* Said out loud separately from the number that is drawn.

          The count used to carry the live region itself, which meant animating it would
          have replaced the announcing element on every tap - and a live region that is
          removed and recreated is not reliably read out at all. Split, the spoken half
          holds still and can afford to say something useful: the dish, not just a
          digit, which on a screen of twenty tiles is the difference between "three" and
          knowing three of what. */}
      <span aria-live="polite" className="sr-only">
        {quantity === 0 ? `No ${label}` : `${quantity} × ${label}`}
      </span>

      <AnimatePresence initial={false}>
        {quantity > 0 && (
          <motion.div
            key="less"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={PRESS}
            className="flex shrink-0 items-center overflow-hidden"
          >
            <motion.button
              type="button"
              aria-label={`One fewer ${label}`}
              whileTap={{ scale: 0.86 }}
              className={cn(
                "flex items-center justify-center text-text transition-colors hover:bg-surface-3",
                button,
                !compact && "border-border-strong bg-surface",
              )}
              onClick={() => onAdjust(-1)}
            >
              <Minus className="size-4" aria-hidden="true" />
            </motion.button>

            {/* Re-keyed on the value so each tap replays the bump. Purely drawn - the
                live region above is what gets spoken - so remounting it costs nothing
                anybody can hear. */}
            <span
              className={cn(
                "text-center font-semibold text-text tabular",
                compact ? "w-5 text-sm" : "w-6 text-base",
              )}
            >
              <motion.span
                key={quantity}
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={PRESS}
                className="block"
              >
                {quantity}
              </motion.span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label={`One more ${label}`}
        whileTap={{ scale: 0.86 }}
        className={cn(
          "flex items-center justify-center bg-primary-solid text-primary-fg transition-colors hover:bg-primary-hover",
          button,
          !compact && "border-primary-solid",
        )}
        onClick={() => onAdjust(1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </motion.button>
    </motion.div>
  );
}
