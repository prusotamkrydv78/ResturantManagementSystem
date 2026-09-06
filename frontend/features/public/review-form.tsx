"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Quote, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitReview } from "@/features/public/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { CustomerReview } from "@/types/public-ordering";

/**
 * Asking a table how it went.
 *
 * Laid out as numbered sections rather than as a stack of controls, because this is now
 * the only thing on its own page and a page needs a shape. The numbers do real work: the
 * first section is the whole obligation, and seeing that it is one of three is what tells
 * somebody the rest is optional before they have read a word saying so.
 *
 * Only the overall score is required. Demanding food, service and a comment before the
 * button works would collect fewer and worse reviews from people who were already
 * willing - the ones who would have given five stars on the way out of the door.
 *
 * Nothing here asks who they are. There is no account behind a customer anywhere in this
 * product, and the price of two taps must not be handing over a name. What makes the
 * review trustworthy is that it came from the key to a settled order, which is evidence
 * of a meal in a way an email address is not.
 *
 * The motion is Motion rather than the stylesheet's keyframes, and only on this page.
 * What it buys is the two things CSS is bad at: replaying against a value that keeps
 * changing - the word under the stars is re-sprung on every tap - and animating
 * something on its way *out*, which a class removed from an unmounting element cannot
 * do. The reduced motion setting is honoured by the `MotionConfig` the page wraps this
 * in.
 */

/** A ready-made thing a guest might want to say. */
interface Suggestion {
  text: string;
  /** Carries the sentiment before the sentence is read. */
  emoji: string;
}

/**
 * Ready-made things a guest might want to say.
 *
 * Written to match the score, because the useful sentence after two stars is not a
 * softer version of the one after five - it names what went wrong. A single list would
 * either put "everything was perfect" in front of somebody who had a bad evening, or
 * bury the praise nobody minds tapping.
 *
 * They fill the box rather than submit anything. What lands in the review is whatever is
 * in the box when it is sent, so a guest can take a suggestion, change one word of it,
 * and send their own sentence - which is the point. A tap-to-send chip would collect the
 * restaurant's words back rather than the customer's.
 */
const SUGGESTIONS: Record<"good" | "mixed" | "poor", readonly Suggestion[]> = {
  good: [
    { emoji: "😍", text: "Lovely food and friendly service." },
    { emoji: "⚡", text: "Everything came out quickly and hot." },
    { emoji: "👌", text: "Great flavours — we will be back." },
    { emoji: "🙌", text: "Staff were attentive without hovering." },
    { emoji: "💸", text: "Good value for what we got." },
  ],
  mixed: [
    { emoji: "🐢", text: "Food was good, service was a little slow." },
    { emoji: "⏳", text: "Enjoyed the meal, but we waited a while." },
    { emoji: "🥶", text: "Nice flavours, though one dish arrived cold." },
    { emoji: "🔧", text: "Pleasant evening, a few small things to fix." },
  ],
  poor: [
    { emoji: "⏰", text: "We waited far too long for our food." },
    { emoji: "🤨", text: "The food was not what we expected." },
    { emoji: "🙋", text: "Hard to get anyone's attention." },
    { emoji: "🧊", text: "Something arrived cold." },
    { emoji: "❌", text: "The order was not right." },
  ],
};

/** Which set of suggestions a score calls for. */
function toneFor(rating: number): "good" | "mixed" | "poor" {
  if (rating >= 4) {
    return "good";
  }

  return rating === 3 ? "mixed" : "poor";
}

/**
 * The score, in a word.
 *
 * Shown back the instant a star is tapped, because five identical shapes are hard to
 * count at a glance on a phone - somebody meaning to give four can easily leave three
 * and never notice. The word is the confirmation the stars cannot give on their own.
 */
const RATING_WORDS: readonly string[] = [
  "",
  "Poor",
  "Not great",
  "Fine",
  "Good",
  "Excellent",
];

/** The longest comment the restaurant will store. */
const COMMENT_LIMIT = 1000;

/** A short, firm spring. Used for anything that responds to a tap. */
const POP = { type: "spring", stiffness: 460, damping: 18 } as const;

export function ReviewForm({
  slug,
  orderKey,
  onSubmitted,
}: {
  slug: string;
  orderKey: string;
  /** Called with what the restaurant recorded, so the page can show it back. */
  onSubmitted: (review: CustomerReview) => void;
}) {
  const [rating, setRating] = useState(0);
  const [food, setFood] = useState(0);
  const [service, setService] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function send() {
    if (rating === 0) {
      return;
    }

    setFailed(null);
    setSending(true);

    try {
      onSubmitted(
        await submitReview(slug, {
          orderKey,
          rating,
          // Zero means they did not answer, which is different from a score of zero -
          // there is no such score. Left out entirely rather than sent as a nil.
          ...(food === 0 ? {} : { foodRating: food }),
          ...(service === 0 ? {} : { serviceRating: service }),
          ...(comment.trim() === "" ? {} : { comment: comment.trim() }),
        }),
      );
    } catch (caught) {
      setFailed(
        caught instanceof ApiError
          ? caught.message
          : "We could not send your review. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="flex flex-col gap-6"
    >
      <Section
        step={1}
        title="How was it overall?"
        hint="This is the only part we need."
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <Stars label="Overall" value={rating} onChange={setRating} size="large" />

          {/* Reserved whether or not there is a word in it, so choosing a score does
              not shunt the rest of the page down by a line. */}
          <div className="flex h-5 items-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={rating}
                aria-live="polite"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "text-sm font-medium",
                  rating === 0 ? "text-subtle" : "text-text",
                )}
              >
                {rating === 0 ? "Tap a star" : RATING_WORDS[rating]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </Section>

      {/* Held back until the one that matters is answered. Three sections in front of
          somebody standing up to leave reads as a form; one reads as a question. */}
      <AnimatePresence initial={false}>
        {rating > 0 && (
          <motion.div
            key="rest"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6"
          >
            <Section
              step={2}
              title="Anything more specific?"
              hint="Optional. Skip either of these."
            >
              <div className="flex flex-col gap-3">
                <Stars label="Food" value={food} onChange={setFood} />
                <Stars label="Service" value={service} onChange={setService} />
              </div>
            </Section>

            <Section
              step={3}
              title="In your own words"
              hint="Tap one to start, then change whatever you like."
            >
              <div className="flex flex-col gap-3">
                {/* Cards in a row that scrolls, rather than sentences wrapped into a
                    block. Five of them stacked would push the send button off a phone
                    screen, and a row of separate things reads as "take one or ignore
                    these" in a way a paragraph of options never does.

                    It runs off the right-hand edge of the panel on purpose - a strip
                    that stops short looks like it holds nothing more - but stays flush
                    on the left, so the cards line up with the heading above them. The
                    fade at the end does the job the scrollbar was doing badly. */}
                <div
                  // A finger that overshoots the last card scrolls this row, not the
                  // page behind it, and never the browser's back gesture.
                  className="no-scrollbar fade-edge-r -mr-4 snap-x snap-mandatory scroll-pr-6 overflow-x-auto overscroll-x-contain scroll-smooth pr-6 sm:-mr-5"
                >
                  {/* items-stretch by default, so every card is as tall as the longest
                      sentence in the set - a ragged row of five different heights is
                      what made this look like leftovers rather than a choice. */}
                  <div className="flex w-max gap-2.5 py-1">
                    {SUGGESTIONS[toneFor(rating)].map((suggestion, index) => (
                      <SuggestionCard
                        // Keyed on the tone as well, so changing the score swaps the
                        // whole set out with an animation instead of rewriting the
                        // words inside cards that stayed put.
                        key={`${toneFor(rating)}-${suggestion.text}`}
                        suggestion={suggestion}
                        index={index}
                        taken={comment === suggestion.text}
                        onTake={() => setComment(suggestion.text)}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="sr-only">Your review</span>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    maxLength={COMMENT_LIMIT}
                    placeholder="Tap a card above to start, or write your own"
                    className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />

                  {/* Only once it is worth knowing about. A counter sitting at 0 / 1000
                      under an empty box reads as a length somebody is expected to
                      reach. */}
                  <AnimatePresence>
                    {comment.length > COMMENT_LIMIT - 200 && (
                      <motion.span
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="self-end text-2xs text-subtle tabular"
                      >
                        {COMMENT_LIMIT - comment.length} left
                      </motion.span>
                    )}
                  </AnimatePresence>
                </label>
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {failed !== null && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-warning"
          >
            {failed}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div whileTap={rating === 0 ? undefined : { scale: 0.98 }}>
        <Button
          type="submit"
          disabled={rating === 0 || sending}
          className="w-full"
        >
          {sending ? "Sending…" : rating === 0 ? "Choose a rating" : "Send my review"}
        </Button>
      </motion.div>
    </form>
  );
}

/**
 * One of the ready-made sentences, as a card.
 *
 * Its own component because it has three states worth animating - arriving, being
 * hovered, being chosen - and inlining that made the section unreadable.
 */
function SuggestionCard({
  suggestion,
  index,
  taken,
  onTake,
}: {
  suggestion: Suggestion;
  index: number;
  taken: boolean;
  onTake: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onTake}
      aria-pressed={taken}
      // Dealt out left to right. The stagger is what tells somebody the row continues
      // past the edge of the screen; a set that appears at once looks like the whole
      // of it.
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: index * 0.055, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group flex w-52 shrink-0 snap-start flex-col justify-between gap-2.5 rounded-xl border p-3 text-left transition-colors duration-200",
        taken
          ? "border-primary bg-primary-soft"
          : "border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3",
      )}
    >
      <span className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5">
          {/* Given a kick when the card is chosen, so the tap lands somewhere visible
              even though what it actually changed is a box further down the page. */}
          <motion.span
            aria-hidden="true"
            animate={taken ? { scale: [1, 1.45, 1], rotate: [0, -14, 0] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-base leading-none select-none"
          >
            {suggestion.emoji}
          </motion.span>

          <Quote
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 transition-colors",
              taken ? "text-primary" : "text-subtle",
            )}
          />
        </span>

        <span
          className={cn(
            "text-sm leading-snug transition-colors",
            taken ? "text-primary" : "text-text",
          )}
        >
          {suggestion.text}
        </span>
      </span>

      {/* Says what tapping does, and then what tapping did. Without it a card that
          fills a box somewhere below is a control with no stated effect. */}
      <span
        className={cn(
          "flex items-center gap-1 text-2xs font-medium transition-colors",
          taken ? "text-primary" : "text-subtle",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {taken && (
            <motion.span
              key="tick"
              initial={{ scale: 0, width: 0 }}
              animate={{ scale: 1, width: "auto" }}
              exit={{ scale: 0, width: 0 }}
              transition={POP}
              className="flex"
            >
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
        {taken ? "In your review" : "Use this"}
      </span>
    </motion.button>
  );
}

/**
 * One numbered part of the form.
 *
 * The number is the structure. Without it this is three groups of controls in a column
 * and somebody has to read all of it to find out how much is being asked; with it the
 * shape of the request is legible before a single label is.
 */
function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Each section arrives just after the one above it, so the page assembles in
      // reading order rather than appearing all at once.
      transition={{ delay: (step - 1) * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xs font-semibold text-primary tabular"
        >
          {step}
        </span>

        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <p className="text-2xs text-muted">{hint}</p>
        </div>
      </div>

      <div className="pl-9">{children}</div>
    </motion.section>
  );
}

/**
 * A row of five stars.
 *
 * Real radio inputs rather than buttons, so the group is one stop for a keyboard, arrow
 * keys move between the scores, and a screen reader announces it as the single choice it
 * is. The stars are the label; the input itself is visually hidden rather than removed,
 * because removing it would take the behaviour with it.
 */
function Stars({
  label,
  value,
  onChange,
  size = "normal",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  size?: "normal" | "large";
}) {
  const name = `rating-${label.toLowerCase()}`;

  return (
    <fieldset
      className={cn(
        "flex items-center gap-3",
        size === "large" ? "justify-center" : "justify-between",
      )}
    >
      <legend className="sr-only">{label}</legend>

      {size === "normal" && (
        <span className="text-sm font-medium text-text">{label}</span>
      )}

      <span className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((score) => {
          const isLit = score <= value;

          return (
            <motion.label
              key={score}
              whileTap={{ scale: 0.82 }}
              className="cursor-pointer rounded-md p-0.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
            >
              <input
                type="radio"
                name={name}
                value={score}
                checked={value === score}
                onChange={() => onChange(score)}
                className="sr-only"
              />
              <span className="sr-only">
                {score} out of 5 for {label}
              </span>

              {/* Keyed on the score together with the choice, so picking a rating
                  replays this from its initial state - animating to a value it is
                  already at would do nothing at all. The input keeps its own identity
                  above, so focus and keyboard position survive. */}
              <motion.span
                key={`${score}-${value}`}
                aria-hidden="true"
                initial={isLit ? { scale: 0.5 } : false}
                animate={{ scale: 1 }}
                // Lit left to right, so four stars read as four rather than as a row
                // that changed colour.
                transition={{ ...POP, delay: (score - 1) * 0.045 }}
                className="block"
              >
                <Star
                  className={cn(
                    size === "large" ? "size-10" : "size-6",
                    "transition-colors",
                    isLit ? "fill-warning text-warning" : "text-subtle",
                  )}
                />
              </motion.span>
            </motion.label>
          );
        })}
      </span>
    </fieldset>
  );
}

/** What the restaurant recorded, read back once it is in. */
export function ReviewSummary({ review }: { review: CustomerReview }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <motion.span
            key={score}
            aria-hidden="true"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            // Counted out one at a time as the score is read back, which is a nicer
            // last thing to see than a row that was simply already there.
            transition={{ ...POP, delay: 0.24 + (score - 1) * 0.07 }}
            className="block"
          >
            <Star
              className={cn(
                "size-7",
                score <= review.rating
                  ? "fill-warning text-warning"
                  : "text-subtle",
              )}
            />
          </motion.span>
        ))}
      </span>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-1.5 text-sm font-medium text-text"
      >
        {RATING_WORDS[review.rating]}
        <span className="font-normal text-muted tabular">
          {review.rating} out of 5
        </span>
      </motion.p>

      {review.comment !== null && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="max-w-sm text-center text-sm text-muted italic"
        >
          “{review.comment}”
        </motion.p>
      )}
    </div>
  );
}
