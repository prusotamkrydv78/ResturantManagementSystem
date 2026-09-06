"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { ArrowLeft, Check, UtensilsCrossed } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { TapPulse } from "@/components/ui/tap-pulse";
import { Surface } from "@/components/ui/surface";
import { EmptyState, Spinner } from "@/components/ui/states";
import { getPublicRestaurant, lookupWebsiteOrder } from "@/features/public/api";
import { ORDER_KEY_PARAM, readHandle } from "@/features/public/order-handle";
import { clearReceipt } from "@/features/public/receipt-store";
import { ReviewForm, ReviewSummary } from "@/features/public/review-form";
import { ApiError } from "@/lib/api/client";
import type {
  CustomerReview,
  PublicOrder,
  PublicRestaurant,
} from "@/types/public-ordering";

/**
 * Telling the restaurant how it went.
 *
 * A page of its own rather than a panel at the foot of the receipt, which is where this
 * started. The receipt is a reference document - a guest scrolls back to it to check a
 * number or watch the timeline - and a form living under it inherits that: it reads as
 * one more row of a thing already finished with, below a fold, competing with a total
 * and a list of what was eaten. Asking for something is a different job from reporting
 * something, and it needs the screen to itself to look like a question rather than a
 * footnote.
 *
 * It is reached two ways, and both matter. The bill settling sends a guest here on its
 * own, once the full-screen moment announcing it has cleared - that is the one instant
 * they are certainly still holding the phone. Anybody who missed that, or came back
 * later, finds a button on the receipt; a review flow with only an automatic entrance
 * is one that can never be returned to.
 *
 * Authorised the same way everything else on a customer's phone is: by the key from
 * their order. It arrives in the address when the receipt sends them here, and is
 * recovered from storage or the address otherwise - see `order-handle`. There is no
 * account behind any of this, and a review that came from the key to a settled order is
 * better evidence of a meal than one behind a sign-in would be.
 *
 * Every way it can fail says which failure it was and offers the way out. A page that
 * answers "no" to a guest who has already stood up must at least be clear about it,
 * because the alternative is somebody going back to the table to find a member of staff
 * about a form.
 */
export default function ReviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [orderKey, setOrderKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  // Held for the moment between sending and whatever the guest does next. What survives
  // a reload is the order's own `canReview`, which the restaurant decides.
  const [review, setReview] = useState<CustomerReview | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const handle = readHandle(slug);

      try {
        // Both at once. The order alone would leave the page unable to name the
        // restaurant it is asking on behalf of, which is most of why anybody answers.
        const [loadedRestaurant, loadedOrder] = await Promise.all([
          getPublicRestaurant(slug),
          handle.orderKey === null
            ? Promise.resolve(null)
            : lookupWebsiteOrder(slug, handle.orderKey),
        ]);

        if (!cancelled) {
          setRestaurant(loadedRestaurant);
          setOrder(loadedOrder);
          setOrderKey(handle.orderKey);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }

        // A 404 means the key names nothing here any more, which will not change. The
        // receipt is forgotten so the rest of the site stops offering an order that is
        // gone; anything else is left alone, because a dropped connection is not proof
        // of anything and throwing the key away over one would be unrecoverable.
        if (caught instanceof ApiError && caught.status === 404) {
          clearReceipt(slug);
          setFailed(null);
        } else {
          setFailed(
            caught instanceof ApiError
              ? caught.message
              : "We could not reach the restaurant. Check your connection and try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /** Closes the visit off and goes back to the restaurant. */
  const finish = useCallback(() => {
    // The meal is over and the review is in. Keeping the key would mean the next visit
    // opens on a settled receipt from last time.
    clearReceipt(slug);
    router.push(`/r/${slug}`);
  }, [router, slug]);

  /** Back to the receipt, with the key, so the timeline and the bill are still there. */
  const receiptHref =
    orderKey === null
      ? `/r/${slug}/order`
      : `/r/${slug}/order?${ORDER_KEY_PARAM}=${encodeURIComponent(orderKey)}`;

  if (loading) {
    return (
      <Shell>
        <Surface className="p-8">
          <Spinner label="Finding your visit…" />
        </Surface>
      </Shell>
    );
  }

  if (failed !== null) {
    return (
      <Shell>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="We could not load this"
            description={failed}
            action={
              <LinkButton variant="secondary" href={receiptHref}>
                Back to your order
              </LinkButton>
            }
          />
        </Surface>
      </Shell>
    );
  }

  // Nothing to review against. Either this phone never had a key, or the one it had
  // named an order the restaurant no longer has.
  if (order === null || orderKey === null) {
    return (
      <Shell>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="We could not find your visit"
            description="A review is tied to an order, and this browser is not holding one. If you still have the page from your meal open, you can leave a review from there."
            action={
              <LinkButton variant="secondary" href={`/r/${slug}`}>
                Go to {restaurant?.restaurantName ?? "the restaurant"}
              </LinkButton>
            }
          />
        </Surface>
      </Shell>
    );
  }

  // Asked too early. Reviews are gated on a settled bill by the restaurant, so a form
  // here would be filled in and then refused - which is worse than not offering it.
  if (!order.isSettled) {
    return (
      <Shell>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="Your visit is still going"
            description="We will ask how it went once the bill has been settled. Until then your order is on the receipt, with everything that has happened to it."
            action={
              <LinkButton variant="secondary" href={receiptHref}>
                Back to your order
              </LinkButton>
            }
          />
        </Surface>
      </Shell>
    );
  }

  if (review !== null) {
    return (
      <Shell>
        <Surface className="relative flex flex-col items-center gap-5 p-6 text-center">
          <div className="relative flex size-16 items-center justify-center">
            {/* A ring thrown off as the tick lands. Enough of an ending for a screen
                somebody reaches once, and quiet enough not to be a party. */}
            <motion.span
              aria-hidden="true"
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="absolute size-16 rounded-full bg-success"
            />

            <motion.span
              aria-hidden="true"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className="relative flex size-16 items-center justify-center rounded-full bg-success text-inverse"
            >
              <Check className="size-8" strokeWidth={2.5} />
            </motion.span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="flex flex-col gap-1"
          >
            <h1 className="text-2xl font-semibold text-text">Thank you</h1>
            <p className="text-sm text-muted">
              Your review is with {restaurant?.restaurantName ?? "the restaurant"}.
            </p>
          </motion.div>

          <ReviewSummary review={review} />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="w-full"
          >
            <Button variant="secondary" onClick={finish} className="w-full">
              Done
            </Button>
          </motion.div>
        </Surface>
      </Shell>
    );
  }

  // Settled, but the restaurant says no - almost always because a review is already in
  // against this order. Said as a thank-you rather than as a refusal, because from the
  // guest's side those are the same fact.
  if (!order.canReview) {
    return (
      <Shell>
        <Surface>
          <EmptyState
            icon={<Check />}
            title="You have already told us"
            description={`Thank you for visiting ${restaurant?.restaurantName ?? "us"}. There is nothing left to do here.`}
            action={
              <Button variant="secondary" onClick={finish}>
                Done
              </Button>
            }
          />
        </Surface>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3"
      >
        <LinkButton
          variant="ghost"
          size="sm"
          href={receiptHref}
          icon={<ArrowLeft />}
          className="-ml-2.5 self-start"
        >
          Your order
        </LinkButton>

        <div className="flex flex-col gap-1">
          <p className="text-2xs font-medium tracking-wide text-muted uppercase">
            {restaurant?.restaurantName}
          </p>

          <h1 className="text-2xl font-semibold text-text">How was your visit?</h1>

          <p className="text-sm text-muted">
            It takes one tap. Anything more is up to you, and none of it asks who you
            are.
          </p>
        </div>

        {/* What is being reviewed, in one line. A guest who ate here twice this week
            should be able to see which meal they are talking about before they score
            it, and it is also the quiet proof that this was a real visit. */}
        <motion.dl
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-2xs"
        >
          <div className="flex items-baseline gap-1.5">
            <dt className="text-subtle">Order</dt>
            <dd className="font-medium text-text tabular">#{order.orderNumber}</dd>
          </div>

          <div className="flex items-baseline gap-1.5">
            <dt className="text-subtle">Paid</dt>
            <dd className="font-medium text-text tabular">
              {restaurant?.currency} {order.total.toFixed(2)}
            </dd>
          </div>

          <div className="flex items-baseline gap-1.5">
            <dt className="text-subtle">Items</dt>
            <dd className="font-medium text-text tabular">{order.itemCount}</dd>
          </div>
        </motion.dl>
      </motion.header>

      <Surface className="p-4 sm:p-5">
        <ReviewForm slug={slug} orderKey={orderKey} onSubmitted={setReview} />
      </Surface>

      {/* A way out that is not the back button. Somebody who does not want to review
          should be able to leave without feeling they have abandoned something. */}
      <button
        type="button"
        onClick={finish}
        className="self-center rounded-md px-3 py-1.5 text-2xs text-muted transition-colors hover:bg-surface-3 hover:text-text"
      >
        No thanks, I am done
      </button>
    </Shell>
  );
}

/**
 * The page frame.
 *
 * Wider than the receipt on purpose. That page is a column of figures and reads best
 * narrow; this one has rows of stars and a strip of cards that scrolls sideways, and
 * squeezing those into the same measure is what made the panel version feel cramped in
 * the first place.
 *
 * `reducedMotion="user"` is set once here rather than checked at each animation. It
 * makes Motion drop every transform and keep the opacity fades, so somebody who has
 * asked their phone for less movement gets the same page without anything sliding,
 * springing or being flung across it.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TapPulse />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-10">
        {children}
      </main>
    </MotionConfig>
  );
}
