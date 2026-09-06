"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitReview } from "@/features/public/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { CustomerReview } from "@/types/public-ordering";

/**
 * Ready-made things a guest might want to say.
 *
 * Written to match the score, because the useful sentence after two stars is not a
 * softer version of the one after five - it names what went wrong. A single list would
 * either put "everything was perfect" in front of somebody who had a bad evening, or
 * bury the praise nobody minds tapping.
 *
 * They fill the box rather than submit anything. What lands in the review is whatever
 * is in the box when it is sent, so a guest can take a suggestion, change one word of
 * it, and send their own sentence - which is the point. A tap-to-send chip would
 * collect the restaurant's words back rather than the customer's.
 */
const SUGGESTIONS: Record<"good" | "mixed" | "poor", readonly string[]> = {
  good: [
    "Lovely food and friendly service.",
    "Everything came out quickly and hot.",
    "Great flavours — we will be back.",
    "Staff were attentive without hovering.",
    "Good value for what we got.",
  ],
  mixed: [
    "Food was good, service was a little slow.",
    "Enjoyed the meal, but we waited a while.",
    "Nice flavours, though one dish arrived cold.",
    "Pleasant evening, a few small things to fix.",
  ],
  poor: [
    "We waited far too long for our food.",
    "The food was not what we expected.",
    "Hard to get anyone's attention.",
    "Something arrived cold.",
    "The order was not right.",
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
 * Asking a table how it went, once they have paid.
 *
 * Shown at the end of the receipt rather than as a separate page, because a guest who
 * has just settled up is standing to leave - sending them somewhere else is how a review
 * form gets abandoned. The whole thing is one tap for somebody in a hurry and four for
 * somebody who wants to be specific.
 *
 * Only the overall score is required. Demanding food, service and a comment before the
 * button works would collect fewer, worse reviews from people who were already going.
 *
 * Nothing here asks who they are. There is no account behind a customer anywhere in this
 * product, and the price of two taps must not be handing over a name - what makes the
 * review trustworthy is that it came from the key to a settled order, not an identity.
 */
export function ReviewPanel({
  slug,
  orderKey,
  onSubmitted,
}: {
  slug: string;
  orderKey: string;
  /** Called with what the restaurant recorded, so the receipt can show it back. */
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
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div>
        <h2 className="text-base font-semibold text-text">How was it?</h2>
        <p className="text-sm text-muted">
          One tap is plenty. The rest is optional.
        </p>
      </div>

      <Stars
        label="Overall"
        value={rating}
        onChange={setRating}
        size="large"
      />

      {/* Held back until they have answered the one that matters. Three rows of stars
          in front of somebody about to leave reads as a form; one reads as a question. */}
      {rating > 0 && (
        <div className="flex flex-col gap-3">
          <Stars label="Food" value={food} onChange={setFood} />
          <Stars label="Service" value={service} onChange={setService} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">
              Anything you want to add?
            </span>

            {/* Scrolls sideways rather than wrapping. Five sentences stacked would push
                the send button off a phone screen, and the row reads as "pick one or
                ignore these" in a way a block of text does not.

                Negative margins and matching padding so the first chip lines up with
                the text above it while the row itself still runs to both edges - a
                strip that stops short looks like it has nothing more in it. */}
            <div className="-mx-5 overflow-x-auto px-5">
              <div className="flex w-max gap-2">
                {SUGGESTIONS[toneFor(rating)].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setComment(suggestion)}
                    aria-pressed={comment === suggestion}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-2xs transition-colors",
                      comment === suggestion
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong text-muted hover:bg-surface-3 hover:text-text",
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="sr-only">Your review</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Tap one above to start, or write your own"
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </label>
          </div>
        </div>
      )}

      {failed !== null && (
        <p role="alert" className="text-sm text-warning">
          {failed}
        </p>
      )}

      <Button onClick={() => void send()} disabled={rating === 0 || sending}>
        {sending
          ? "Sending…"
          : rating === 0
            ? "Choose a rating"
            : "Send my review"}
      </Button>
    </div>
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
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm font-medium text-text">{label}</span>

      <span className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((score) => {
          const isLit = score <= value;

          return (
            <label
              key={score}
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
              <Star
                aria-hidden="true"
                className={cn(
                  size === "large" ? "size-8" : "size-6",
                  isLit ? "fill-warning text-warning" : "text-subtle",
                )}
              />
            </label>
          );
        })}
      </span>
    </fieldset>
  );
}

/** What the restaurant recorded, shown back once it is in. */
export function ReviewThanks({ review }: { review: CustomerReview }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <p
        role="status"
        className="flex items-start gap-2 text-sm font-medium text-success"
      >
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Thank you — your review is with the restaurant.
      </p>

      <span className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <Star
            key={score}
            aria-hidden="true"
            className={cn(
              "size-5",
              score <= review.rating
                ? "fill-warning text-warning"
                : "text-subtle",
            )}
          />
        ))}
        <span className="ml-1 text-sm text-muted">{review.rating} out of 5</span>
      </span>

      {review.comment !== null && (
        <p className="text-sm text-muted italic">“{review.comment}”</p>
      )}
    </div>
  );
}
