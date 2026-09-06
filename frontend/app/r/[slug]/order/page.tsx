"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  HandCoins,
  Info,
  Plus,
  ReceiptText,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, Spinner } from "@/components/ui/states";
import { ToastProvider } from "@/components/ui/toast";
import {
  getPublicRestaurant,
  lookupWebsiteOrder,
  placeWebsiteOrder,
  requestBill,
} from "@/features/public/api";
import { OrderComposer, type OrderDraftLine } from "@/features/public/order-composer";
import { isAtLeast, STAGE_COPY } from "@/features/public/order-progress";
import { OrderSentOverlay } from "@/features/public/order-sent";
import { StageMoment, useStageMoments } from "@/features/public/stage-moment";
import { StayConnected } from "@/features/public/stay-connected";
import { OrderTimeline } from "@/features/public/order-timeline";
import {
  forgetInUrl,
  ORDER_KEY_PARAM,
  readHandle,
  rememberInUrl,
} from "@/features/public/order-handle";
import { clearReceipt, writeReceipt } from "@/features/public/receipt-store";
import { useOrderUpdates } from "@/features/public/use-order-updates";
import { ApiError } from "@/lib/api/client";
import { buzz } from "@/lib/notify/buzz";
import { pushIfHidden } from "@/lib/notify/push";
import { useTabAlert } from "@/lib/notify/use-tab-alert";
import { cn } from "@/lib/utils/cn";
import type { PublicOrder, PublicRestaurant } from "@/types/public-ordering";

/**
 * Ordering from the restaurant's own website.
 *
 * The way in for somebody who found the restaurant rather than sat down in it. The one
 * difference from the code printed on a table is a single question: a scanned code
 * already says where the guest is, and this page has to ask. That question is asked
 * first and holds back the menu, because choosing a table after building a basket would
 * mean discovering at the last step that the one you are sitting at is taken. Somebody
 * who arrived by scanning has already answered it, and it is preselected.
 *
 * After the order is sent the page becomes a receipt, and stays useful: it says where
 * the food has got to, and while nothing has reached the kitchen it can take a second
 * round. Adding is the only change a customer can make alone - it withdraws nothing and
 * affects nothing being cooked. Removing a line or calling the order off is a
 * conversation with a waiter, who can see the table and what the kitchen has started.
 *
 * Losing your place is the failure this page works hardest to prevent, because a guest
 * who has lost it is sitting in front of food with no idea whether the restaurant heard
 * them. The key that says "this order is mine" is therefore kept in three places that
 * fail differently - the address bar, local storage, and the printed code on the table -
 * and the page recovers from whichever of them survived. See `order-handle`.
 *
 * What it recovers is then read back from the server rather than from the phone, so a
 * page reopened an hour later shows the bill as it now stands rather than as it was.
 *
 * Choosing the food is `OrderComposer`, shared with the scanned pad, so improving one
 * improves both.
 */
export default function WebsiteOrderPage() {
  // The staff shell supplies this for every signed-in screen; a customer's phone is
  // outside it, so the page brings its own. Same toasts, same chime, same mute.
  return (
    <ToastProvider>
      <WebsiteOrder />
    </ToastProvider>
  );
}

function WebsiteOrder() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tableId, setTableId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PublicOrder | null>(null);
  /**
   * The key that says this order is theirs, held apart from the order itself.
   *
   * It has to be, because the server hands it back exactly once - on placing an order
   * or adding to one - and never on a read. Every lookup therefore returns an order
   * whose `orderKey` is null, and while this page kept the key inside `placed`, each
   * refresh silently overwrote the real one with that null and then wrote the emptied
   * receipt to storage. The URL copy was all that survived, so anything that navigated
   * without carrying it - such as opening the review page - arrived unable to prove
   * whose order it was.
   *
   * Written from whichever source actually had one and never cleared by a read.
   */
  const [orderKey, setOrderKey] = useState<string | null>(null);
  // Whether the menu is open on top of an existing order, for a second round. Distinct
  // from having no order at all: the table is already settled and must not be asked
  // again, and the basket adds to what is there rather than starting something new.
  const [adding, setAdding] = useState(false);
  // Separate from the order itself, because the receipt should be built and
  // sitting there ready by the time the overlay clears, not assembling afterwards.
  const [celebrating, setCelebrating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // True while the page is asking the restaurant about a key it found lying around, so
  // the menu does not flash up underneath a receipt that is about to replace it.
  const [recovering, setRecovering] = useState(true);
  // Asking for the bill, and how it went. The answer replaces the whole order, so the
  // "we have told them" state survives a reload without being tracked separately.
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  // Held only for the moment between sending a review and the page being reloaded.
  // What survives a reload is the order's own canReview, which the restaurant decides.
  // Set by the bill settling, and acted on once the full-screen moment announcing it
  // has cleared. Sending somebody to another page mid-animation would throw away the
  // one thing telling them why they are being sent.
  const [headingToReview, setHeadingToReview] = useState(false);
  // Bumped when the restaurant says something changed that this page cannot derive -
  // today only the bill being settled. Kept apart from the reload that refetches the
  // menu, because that one also resets the table picker.
  const [reloadOrderKey, setReloadOrderKey] = useState(0);
  // The stage a guest has not seen yet, for the tab title. Cleared the moment they
  // look at the page again, because a tab still shouting about food they are eating
  // is the kind of small wrongness that makes a site feel broken.
  const [unseen, setUnseen] = useState<string | null>(null);
  // Every stage takes the screen for a beat, queued so two landing together play in
  // turn rather than cutting each other off.
  const { moment, show: showMoment, done: momentDone } = useStageMoments();

  useTabAlert(unseen);

  // Cleared on the way back rather than on a timer. The guest looking at the screen
  // is the only reliable signal that they have seen it.
  useEffect(() => {
    function seen() {
      if (!document.hidden) {
        setUnseen(null);
      }
    }

    document.addEventListener("visibilitychange", seen);

    return () => document.removeEventListener("visibilitychange", seen);
  }, []);

  /**
   * Finds out whether this visitor already has an order here, and picks it up.
   *
   * On mount and only on mount, which is load bearing. This used to re-run whenever the
   * page refetched, and because of that anything which cleared the receipt was undone a
   * moment later by a restore reading the copy that had not been cleared yet - so
   * "order something else" appeared to do nothing at all.
   *
   * The key can come from the address bar, from storage, or from the code they scanned
   * on their table; the order itself always comes from the restaurant. A phone's own
   * copy is a snapshot from whenever it was written, and after a battery dies and an
   * hour passes it is the least trustworthy thing on the screen.
   */
  useEffect(() => {
    let cancelled = false;

    async function recover() {
      const handle = readHandle(slug);

      if (handle.tableId !== null && !cancelled) {
        setTableId(handle.tableId);
      }

      if (handle.orderKey === null) {
        if (!cancelled) {
          setRecovering(false);
        }

        return;
      }

      try {
        const found = await lookupWebsiteOrder(slug, handle.orderKey);

        if (!cancelled) {
          setPlaced(found);
          // From the handle rather than from the response, which never carries one.
          setOrderKey(handle.orderKey);
        }
      } catch (caught) {
        // Only a definite answer from the restaurant is allowed to throw the key away.
        //
        // A 404 means this key names nothing here any more, which will not change and
        // is worth forgetting. Anything else - a dropped connection, a phone waking up
        // on a bad signal, a rate limit - means we do not know, and discarding somebody’s
        // order because their wifi hiccuped is the difference between a slow page
        // and a lost meal. The key is kept and the next load tries again.
        if (caught instanceof ApiError && caught.status === 404) {
          clearReceipt(slug);
          forgetInUrl();

          if (!cancelled) {
            setOrderKey(null);
          }
        }
      } finally {
        if (!cancelled) {
          setRecovering(false);
        }
      }
    }

    void recover();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // The table a scanned code arrived with. Taken from the address rather than
      // useSearchParams because it cannot change for the life of this page, and
      // reading it here keeps it out of render.
      const asked = new URLSearchParams(window.location.search).get("table");

      try {
        const loaded = await getPublicRestaurant(slug);

        if (!cancelled) {
          setRestaurant(loaded);
          setFailed(null);

          // Honoured only when that table is actually free. Preselecting a taken one
          // would show the whole menu and then refuse the order at the last step,
          // which is precisely the moment this flow is built to avoid. Left unset, the
          // picker below shows their table as "in use", which is the useful answer.
          const scanned = loaded.tables.find(
            (candidate) => candidate.id === asked && candidate.isAvailable,
          );

          if (scanned !== undefined) {
            setTableId(scanned.id);
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setRestaurant(null);
          setFailed(
            caught instanceof ApiError
              ? caught.message
              : "We could not reach the restaurant. Check your connection and try again.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  // Followed for as long as the page is open, on the strength of the key they were
  // handed when they placed it.
  const { stage, live, closed } = useOrderUpdates({
    slug,
    orderKey,
    onUpdate: useCallback(
      (update: { stage: keyof typeof STAGE_COPY }) => {
        const copy = STAGE_COPY[update.stage];

        const ending = update.stage === "Served" || update.stage === "Settled";
        // The one stage a guest is actually waiting for, and the only one that earns
        // an interruption on every channel at once.
        const awaited = update.stage === "Ready";

        // The screen, for a beat. This is the announcement now, rather than a card in
        // the corner: a guest picks the phone up *because* it buzzed, and the question
        // they are holding on the way up is what happened - which is a poor thing to
        // answer in a footnote while the receipt they have already read keeps the rest
        // of the screen. The toast shape belongs to the staff side, where somebody is
        // working a screen all shift and needs telling without being stopped.
        showMoment(update.stage);

        // The channel that works when the phone is face down on the table and on
        // silent, which is most of the wait.
        buzz(awaited ? "alert" : ending ? "done" : "gentle");

        // And the one that works when the page is not even open. Fires only while
        // hidden - see the module - so nobody watching the timeline is told twice.
        pushIfHidden({
          title: copy.title,
          body: copy.detail,
          tag: "rms-order",
        });

        // The cheapest one, needing nobody's permission: a glance at the tab.
        setUnseen(`${awaited ? "🍽" : "•"} ${copy.title}`);

        // The bill just closed at the counter. Re-read the order rather than guessing
        // at the new state: whether they may leave a review is the restaurant's answer,
        // not something this page can work out, and it is what turns the receipt into
        // the review card without anybody reloading.
        if (update.stage === "Settled") {
          setReloadOrderKey((key) => key + 1);
          setHeadingToReview(true);
        }
      },
      [showMoment],
    ),
  });

  /**
   * Sends them to the review page once the bill has closed.
   *
   * Held until the moment announcing it has left the screen. That panel is the reason
   * the page is about to change under them, and navigating out from underneath it would
   * land somebody on a form with no idea what just happened.
   *
   * The key travels in the address rather than being looked up again at the other end.
   * Storage is the copy most likely to have been cleared by a browser reclaiming space,
   * and this is the one navigation where the key is certainly in hand.
   */
  useEffect(() => {
    if (!headingToReview || moment !== null || orderKey === null) {
      return;
    }

    router.push(
      `/r/${slug}/review?${ORDER_KEY_PARAM}=${encodeURIComponent(orderKey)}`,
    );
  }, [headingToReview, moment, orderKey, router, slug]);

  // Written whenever the receipt changes, rather than at each of the places that change
  // it. One rule in one place: what is on screen is what the phone remembers.
  useEffect(() => {
    // Nothing at all until the recovery has finished, and this is the whole bug it was
    // written to fix. `placed` starts null, so on every single load this effect used to
    // run first and wipe both copies of the key - the stored one and the one in the
    // address - while the lookup that needed them was still in flight. It survived only
    // because the lookup usually came back and wrote them again; a reload in that window,
    // or one failed request, lost the order permanently.
    //
    // The customer had done nothing wrong and had no way back, which is exactly the
    // failure the three copies exist to prevent.
    if (recovering) {
      return;
    }

    if (placed === null) {
      clearReceipt(slug);
      forgetInUrl();

      return;
    }

    // The key is put back in on the way to storage. `placed` is whatever the last
    // response said, and a response to a read says null - saving that verbatim is what
    // used to empty the stored copy on every refresh.
    writeReceipt(slug, { ...placed, orderKey }, tableId);

    // Mirrored into the address, which is the copy that survives the tab being closed
    // and the only one that can be sent to somebody else at the same table.
    if (orderKey !== null && tableId !== "") {
      rememberInUrl(orderKey, tableId);
    }
  }, [slug, placed, orderKey, tableId, recovering]);

  const place = useCallback(
    async (items: OrderDraftLine[]) => {
      setPlaceError(null);
      setPlacing(true);

      try {
        const sent = await placeWebsiteOrder(slug, {
          tableId,
          items,
          // Present only when adding to what they already have. It is what tells the
          // restaurant that the order running on this table is theirs.
          ...(orderKey === null ? {} : { orderKey }),
        });

        setPlaced(sent);
        // Only ever replaced by a real one. Adding to an order returns the same key,
        // but a response that omitted it must not take away the one already held.
        setOrderKey((current) => sent.orderKey ?? current);
        setAdding(false);
        setCelebrating(true);
      } catch (caught) {
        setPlaceError(
          caught instanceof ApiError
            ? caught.message
            : "We could not send your order. Please try again, or ask a member of staff.",
        );

        // A refused table is the likely failure, and which tables are free has moved
        // on since the page loaded. Refetching is what makes the message actionable.
        setReloadKey((key) => key + 1);

        // Rethrown so the basket stays open and nothing they assembled is lost.
        throw caught;
      } finally {
        setPlacing(false);
      }
    },
    [slug, tableId, orderKey],
  );

  /** Asks a waiter to bring the bill over. */
  const askForBill = useCallback(async () => {
    if (orderKey === null) {
      return;
    }

    setAskError(null);
    setAsking(true);

    try {
      // The response is the order as it now stands, which carries the time the request
      // was recorded - so the confirmed state comes from the restaurant rather than from
      // a flag this page sets and then loses on the next reload.
      setPlaced(await requestBill(slug, orderKey));
    } catch (caught) {
      setAskError(
        caught instanceof ApiError
          ? caught.message
          : "We could not reach the restaurant. Please catch a member of staff.",
      );
    } finally {
      setAsking(false);
    }
  }, [slug, orderKey]);

  /**
   * Re-reads the order after the restaurant has changed it under us.
   *
   * Skipped on the first render, where the recovery effect above has already done it.
   * Failures are swallowed: what is on screen is still true, and the next event or
   * reload will catch up.
   */
  useEffect(() => {
    if (reloadOrderKey === 0 || orderKey === null) {
      return;
    }

    let cancelled = false;
    const key = orderKey;

    async function refresh() {
      try {
        const fresh = await lookupWebsiteOrder(slug, key);

        if (!cancelled) {
          setPlaced(fresh);
        }
      } catch {
        // Nothing to tell them. The receipt on screen is still the one they had.
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `placed`: this reads it, and depending on it would
    // re-run the moment its own result arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reloadOrderKey, orderKey]);

  /** Forgets this order and goes back to an empty page. */
  const startOver = useCallback(() => {
    setPlaced(null);
    setOrderKey(null);
    setAdding(false);
    setPlaceError(null);
    setReloadKey((key) => key + 1);
  }, []);

  if (failed !== null) {
    return (
      <Centre>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="Ordering is not available"
            description={failed}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setFailed(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                Try again
              </Button>
            }
          />
        </Surface>
      </Centre>
    );
  }

  if (restaurant === null || recovering) {
    return (
      <Centre>
        <div className="flex justify-center py-12">
          <Spinner
            label={recovering ? "Finding your order…" : "Loading the menu…"}
          />
        </div>
      </Centre>
    );
  }

  // Sent, and not currently adding to it. The page stops being a menu and becomes a
  // receipt, because what matters now is where the food is and the number they quote.
  // One restaurant trades in one currency, so it is read once here rather than carried
  // on every amount.
  const money = restaurant.currency;

  if (placed !== null && !adding) {
    // Both conditions, and they answer different questions. `canAddMore` is what the
    // restaurant said when the order was last touched; the stage is what has happened
    // since. Without the second a guest would keep seeing the button after the kitchen
    // had the order, and only find out by pressing it.
    const canAdd =
      !closed &&
      placed.canAddMore &&
      orderKey !== null &&
      !isAtLeast(stage, "WithKitchen");

    return (
      <Centre>
        {/* Keyed on the stage so a new one restarts the animations rather than
            swapping the words inside a panel that has already finished arriving.

            Held back while the order-sent moment is still on screen: both are
            full-screen, and two of them at once is one too many. The queue keeps
            whatever arrived, so nothing is lost by waiting. */}
        {moment !== null && !celebrating && (
          <StageMoment
            key={moment}
            stage={moment}
            orderNumber={placed.orderNumber}
            onDone={momentDone}
          />
        )}

        {celebrating && (
          <OrderSentOverlay
            orderNumber={placed.orderNumber}
            onDone={() => setCelebrating(false)}
          />
        )}

        <Surface className="flex flex-col gap-4 p-5">
          <p
            role="status"
            className="flex items-start gap-2 text-sm font-medium text-success"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Your order is with {restaurant.restaurantName}.
          </p>

          <p className="text-3xl font-semibold text-text">
            Order #{placed.orderNumber}
          </p>

          <ul className="flex flex-col divide-y divide-border">
            {placed.lines.map((line, index) => (
              <li
                key={`${line.itemName}-${index}`}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span>
                  <span className="tabular text-muted">{line.quantity}×</span>{" "}
                  <span className="text-text">{line.itemName}</span>
                </span>
                <span className="shrink-0 tabular text-text">
                  {line.lineTotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          {/* The whole bill, itemised. This used to show the subtotal under the word
              "Total", which understated it by the tax and the service charge - a guest
              reading one figure and being asked for another at the counter. The parts
              are shown so the arithmetic can be followed rather than trusted. */}
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <Money label="Food" amount={placed.subtotal} currency={money} />

            {placed.serviceChargeAmount > 0 && (
              <Money
                label="Service charge"
                amount={placed.serviceChargeAmount}
                currency={money}
              />
            )}

            {placed.vatAmount > 0 && (
              <Money label="VAT" amount={placed.vatAmount} currency={money} />
            )}

            <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-sm font-medium text-text">Total</span>
              <span className="text-lg font-semibold text-text tabular">
                {money} {placed.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Asking is not paying. The money still changes hands with a person, so the
              button says what it does - it calls somebody over. */}
          {placed.billRequestedAtUtc !== null ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success"
            >
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              A member of staff is on their way with your bill.
            </p>
          ) : placed.canRequestBill ? (
            <div className="flex flex-col gap-2">
              {askError !== null && (
                <p role="alert" className="flex items-start gap-2 text-sm text-warning">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {askError}
                </p>
              )}

              <Button
                variant="secondary"
                onClick={() => void askForBill()}
                disabled={asking}
                icon={<HandCoins />}
              >
                {asking ? "Letting them know…" : "Ask for the bill"}
              </Button>

              <p className="text-2xs text-subtle">
                A waiter will come over to take payment. You can keep sitting where you
                are.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              This order has been settled. Thank you.
            </p>
          )}

          {/* Offered here because this is the moment it makes sense to the person
              being asked: they have ordered, and they are about to stop watching. */}
          {!closed && <StayConnected orderNumber={placed.orderNumber} />}

          {/* Only while the order is still running. A settled or cancelled one has
              nowhere left to go, and a timeline frozen mid-way would suggest it does. */}
          {!closed && (
            <OrderTimeline
              stage={stage}
              live={live}
              placedAtUtc={placed.placedAtUtc}
            />
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {placed.isSettled ? (
              <>
                <p
                  role="status"
                  className="flex items-start gap-2 text-sm font-medium text-success"
                >
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Your bill has been settled. Thank you for visiting{" "}
                  {restaurant.restaurantName}.
                </p>

                {/* The settling itself sends them to the review page. This is for
                    everybody that did not happen to: a phone that was locked at the
                    moment, or somebody coming back to the receipt afterwards. A flow
                    with only an automatic entrance is one nobody can return to. */}
                {placed.canReview && orderKey !== null ? (
                  <>
                    <LinkButton
                      href={`/r/${slug}/review?${ORDER_KEY_PARAM}=${encodeURIComponent(orderKey)}`}
                      icon={<Star />}
                    >
                      Tell us how it went
                    </LinkButton>

                    <Button variant="secondary" onClick={startOver}>
                      No thanks, I am done
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={startOver}>
                    Done
                  </Button>
                )}
              </>
            ) : closed ? (
              <>
                <p className="flex items-start gap-2 text-sm text-muted">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  This order has been closed by the restaurant. If that is not right,
                  ask a member of staff.
                </p>

                <Button variant="secondary" onClick={startOver}>
                  Start a new order
                </Button>
              </>
            ) : canAdd ? (
              <>
                <Button onClick={() => setAdding(true)} icon={<Plus />}>
                  Order something else
                </Button>

                <p className="text-2xs text-subtle">
                  Anything you add goes onto this same order and the same bill. You can
                  keep adding until the kitchen starts on it.
                </p>
              </>
            ) : (
              // Not an error and not a disabled button. There is nothing for a guest to
              // do here except talk to somebody, so that is what it says.
              <p className="flex items-start gap-2 text-sm text-muted">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Your order is with the kitchen now. Ask a member of staff if you would
                like anything else, or if something needs changing.
              </p>
            )}
          </div>
        </Surface>
      </Centre>
    );
  }

  if (!restaurant.isAcceptingOrders) {
    return (
      <Centre>
        <Surface>
          <EmptyState
            icon={<UtensilsCrossed />}
            title="Not taking orders online"
            description={`${restaurant.restaurantName} is not accepting website orders at the moment. Please order with a member of staff.`}
            action={
              <Link
                href={`/r/${slug}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to the website
              </Link>
            }
          />
        </Surface>
      </Centre>
    );
  }

  const table = restaurant.tables.find((candidate) => candidate.id === tableId);
  // Adding to an existing order keeps its table, which is by definition not free any
  // more - it has their own order running on it. Asking again, or refusing it as taken,
  // would both be wrong.
  const hasTable = adding ? tableId !== "" : table !== undefined && table.isAvailable;

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {adding ? (
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-3"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Your order
            </button>
          ) : (
            <Link
              href={`/r/${slug}`}
              aria-label="Back to the website"
              className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {adding
                ? `Adding to order #${placed?.orderNumber}`
                : hasTable
                  ? table?.name
                  : "Order online"}
            </p>
            <h1 className="truncate text-2xl font-semibold text-text">
              {restaurant.restaurantName}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 pb-28">
        {/* Asked first, and the menu waits behind it. Discovering at the checkout that
            your table is taken, with a basket already built, is the one bad moment
            this flow can have.

            Skipped entirely when adding: the table was decided when the order was
            opened and cannot move. */}
        {!adding && (
          <Surface className="flex flex-col gap-3 p-4">
            <div>
              <h2 className="text-base font-semibold text-text">
                Which table are you at?
              </h2>
              <p className="text-sm text-muted">
                So your food reaches you. Ask a member of staff if you are not sure.
              </p>
            </div>

            {/* The one dead end this flow can produce: a guest whose table shows as
                taken because they already ordered on it and their phone forgot. Left
                without this they would sit there assuming the restaurant lost their
                order, so the way back is written next to the thing that blocked them. */}
            {restaurant.tables.some((candidate) => !candidate.isAvailable) && (
              <p className="flex items-start gap-2 rounded-md bg-surface-3 px-3 py-2 text-2xs text-muted">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  A table already in use cannot be picked. If you have{" "}
                  <strong className="font-semibold text-text">already ordered</strong>{" "}
                  there, scan the code on your table to pick your order back up — or ask
                  a member of staff and they will find it for you.
                </span>
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {restaurant.tables.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={!candidate.isAvailable}
                  aria-pressed={candidate.id === tableId}
                  onClick={() => setTableId(candidate.id)}
                  className={cn(
                    "flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
                    candidate.id === tableId
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border-strong text-text hover:bg-surface-3",
                    !candidate.isAvailable &&
                      "cursor-not-allowed border-border text-subtle hover:bg-transparent",
                  )}
                >
                  <span className="text-sm font-medium">{candidate.name}</span>
                  <span className="text-2xs">
                    {candidate.isAvailable ? `seats ${candidate.capacity}` : "in use"}
                  </span>
                </button>
              ))}
            </div>
          </Surface>
        )}

        {adding && (
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="flex w-full items-center gap-3 rounded-lg border border-primary-border bg-primary-soft px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
          >
            <ReceiptText className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-text">
                Back to order #{placed?.orderNumber}
              </span>
              <span className="text-2xs text-muted">
                Anything you choose here is added to the same bill. Go back to follow it
                or ask for the bill.
              </span>
            </span>
            <span className="ml-auto shrink-0 text-sm font-semibold text-text tabular">
              {money} {placed?.total.toFixed(2)}
            </span>
          </button>
        )}

        {hasTable ? (
          <OrderComposer
            menu={restaurant.menu}
            onPlace={place}
            placing={placing}
            error={placeError}
          />
        ) : (
          <p className="px-1 text-sm text-muted">
            Pick your table above to see the menu.
          </p>
        )}
      </main>
    </>
  );
}

/** One line of the bill: what it is, and what it comes to. */
function Money({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="tabular text-sm text-text">
        {currency} {amount.toFixed(2)}
      </span>
    </div>
  );
}

/** Centres a single panel, for the states with nothing else on the page. */
function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12">
      {children}
    </main>
  );
}
