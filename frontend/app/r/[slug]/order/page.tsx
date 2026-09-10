"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChefHat,
  HandCoins,
  Info,
  Plus,
  QrCode,
  ReceiptText,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, Spinner } from "@/components/ui/states";
import { TapPulse } from "@/components/ui/tap-pulse";
import { ToastProvider } from "@/components/ui/toast";
import {
  getPublicRestaurant,
  lookupWebsiteOrder,
  placeWebsiteOrder,
  requestBill,
  resolveScannedRestaurant,
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
      {/* Mounted once for the page, so every control on it answers a finger without
          having to be wired up individually. */}
      <TapPulse />
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
  /**
   * The code printed on the table they scanned, held for the whole visit.
   *
   * The difference between this and the order key is what fixes the two-phones
   * problem. A key names one order: whoever holds it is in, and anybody else at the
   * same table is out, including the same person on a second device or after a flat
   * battery. This names the *table*, and resolving it returns whatever order is open
   * there right now - so it keeps answering after the order it first fetched has been
   * settled, and it answers for an order somebody else at the table started.
   *
   * Deliberately not the table's identifier, which would be the easy version of the
   * same idea and an open door: those are listed in the public menu response so the
   * picker can draw them, so anyone loading the site could pick an occupied table and
   * walk into a stranger's bill. The printed code is the part that means "I am sitting
   * here".
   */
  const [tableToken, setTableToken] = useState<string | null>(null);
  // Whether the menu is open on top of an existing order, for a second round. Distinct
  // from having no order at all: the table is already settled and must not be asked
  // again, and the basket adds to what is there rather than starting something new.
  const [adding, setAdding] = useState(false);
  // Separate from the order itself, because the receipt should be built and
  // sitting there ready by the time the overlay clears, not assembling afterwards.
  const [celebrating, setCelebrating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * Which step of placing an order they are on.
   *
   * Only ever "table" or "menu" here. The third - checking the order over - belongs to
   * the composer, because the basket it is a view of lives in there; it reports which
   * of the two it is showing and `step` below stitches the three together.
   *
   * Held rather than derived from whether a table is chosen. Picking one and moving on
   * are two different acts, and collapsing them meant the menu appeared under a guest
   * the instant they touched a tile - which is the drawer problem in another costume.
   */
  const [flowStage, setFlowStage] = useState<"table" | "menu">("table");
  const [checking, setChecking] = useState(false);
  // Whether the "which one am I at?" help is open.
  //
  // Opened by asking, and also by tapping a table that is already in use - because
  // somebody doing that is either at a table they think is free, or is at their own
  // table having forgotten they ordered, and the help answers both.
  const [tableHelp, setTableHelp] = useState(false);
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

      if (handle.tableToken !== null && !cancelled) {
        setTableToken(handle.tableToken);
      }

      // No key of their own, but they scanned the table - so ask the table. This is
      // the case that used to be a dead end: a second phone, or a first one that
      // scanned before anybody had ordered, or a guest whose waiter opened the order
      // after they arrived. All three end up here holding a printed code and nothing
      // else, and all three are entitled to the order running on that table.
      const key =
        handle.orderKey ?? (await keyFromTable(slug, handle.tableToken));

      if (key === null) {
        if (!cancelled) {
          setRecovering(false);
        }

        return;
      }

      try {
        const found = await lookupWebsiteOrder(slug, key);

        if (!cancelled) {
          setPlaced(found);
          // From the handle rather than from the response, which never carries one.
          setOrderKey(key);
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
            // Scanning the code on a table has answered step one already. Making them
            // confirm what the code just told us would be asking a question we have
            // the answer to.
            setFlowStage("menu");
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

        // The bill just closed at the counter. Whether they may leave a review is the
        // restaurant's answer rather than something this page can work out, and the
        // re-read that `onChanged` does is what turns the receipt into the review card
        // without anybody reloading.
        if (update.stage === "Settled") {
          setHeadingToReview(true);
        }
      },
      [showMoment],
    ),
    // Every message, including the ones that leave the order at the same stage.
    //
    // The stage arrives on the socket; the per-dish progress on the receipt lives on
    // the lines, and only a lookup brings those back. Without this a guest would watch
    // the samosa be cooked and delivered while their receipt still said the kitchen
    // had it.
    onChanged: useCallback(() => {
      setReloadOrderKey((key) => key + 1);
    }, []),
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
    writeReceipt(slug, { ...placed, orderKey }, tableId, tableToken);

    // Mirrored into the address, which is the copy that survives the tab being closed
    // and the only one that can be sent to somebody else at the same table.
    if (orderKey !== null && tableId !== "") {
      rememberInUrl(orderKey, tableId, tableToken);
    }
  }, [slug, placed, orderKey, tableId, tableToken, recovering]);

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
        // Somebody else at this table got there first - the other phone, or a waiter
        // taking the order in person while this basket was being built. The table is
        // refusing a *second* order, which is correct, but there is now an order on it
        // that this guest is entitled to, and the code they scanned proves it.
        //
        // So rather than reporting a refusal and stranding an assembled basket, take
        // the order that exists. What they chose is still in the composer, and adding
        // it to the running order is one press away.
        const joined = await keyFromTable(slug, tableToken);

        if (joined !== null && orderKey === null) {
          setOrderKey(joined);
          setReloadOrderKey((current) => current + 1);
          setPlaceError(
            "Somebody at your table had already started an order, so we opened that one instead. Add what you chose to it.",
          );
          setReloadKey((current) => current + 1);

          throw caught;
        }

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
    [slug, tableId, orderKey, tableToken],
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
    // re-run the moment its own result arrived. Since the key moved out into its own
    // state this no longer reads `placed` at all, so the rule is satisfied and the
    // suppression it used to need is gone.
  }, [slug, reloadOrderKey, orderKey]);

  /**
   * Re-reads which tables are free when the page comes back into view.
   *
   * The list was fetched once and then trusted for as long as the tab stayed open, so
   * somebody who put their phone down while deciding could sit looking at a table that
   * had been taken minutes ago - and only find out after building a basket, which is
   * the exact moment this whole flow is arranged to avoid.
   *
   * Only while they are still choosing. Once a table is picked the composer is mounted
   * and holds the basket, and refetching could hide it mid-order and lose everything
   * they had chosen - a far worse outcome than a slightly stale list.
   */
  useEffect(() => {
    let cancelled = false;

    function recheck() {
      if (document.hidden || placed !== null) {
        return;
      }

      if (tableId === "") {
        setReloadKey((current) => current + 1);

        return;
      }

      // Sitting at a scanned table with no order of their own. Somebody else at the
      // table may have started one while this phone was in a pocket - a waiter taking
      // it at the table is the ordinary case - so ask the code again rather than
      // leaving them looking at a menu they can no longer order from.
      void keyFromTable(slug, tableToken).then((key) => {
        if (!cancelled && key !== null) {
          setOrderKey(key);
          setReloadOrderKey((current) => current + 1);
        }
      });
    }

    document.addEventListener("visibilitychange", recheck);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [placed, tableId, tableToken, slug]);

  /** Forgets this order and goes back to an empty page. */
  const startOver = useCallback(() => {
    setPlaced(null);
    setOrderKey(null);
    // The code is not forgotten. It belongs to the table rather than to the order, and
    // the next order on that table is theirs to reach as well.
    setFlowStage("table");
    setChecking(false);
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

  const table = restaurant.tables.find((candidate) => candidate.id === tableId);
  // Adding to an existing order keeps its table, which is by definition not free any
  // more - it has their own order running on it. Asking again, or refusing it as taken,
  // would both be wrong.
  const hasTable = adding ? tableId !== "" : table !== undefined && table.isAvailable;

  /**
   * The step actually on screen.
   *
   *
   * Checking wins over everything, because it is where they are. Adding a second round
   * has no table step at all - the table came with the order being added to - so it
   * starts on the menu. And a menu step with no table falls back to the table: a table
   * can be taken while somebody is deciding, and the menu is no use without one.
   */
  const step: "table" | "menu" | "check" = checking
    ? "check"
    : adding
      ? "menu"
      : flowStage === "menu" && hasTable
        ? "menu"
        : "table";

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
      <>
        <TopBar
          slug={slug}
          restaurantName={restaurant.restaurantName}
          eyebrow={table?.name ?? "Your order"}
        />

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

        {/* The number, given the room it earns.

            It used to be a paragraph in the middle of a stack of eight other things,
            below a green sentence, at the same weight as the bill. It is the one piece
            of this screen a guest has to read out loud to a stranger, and it wants
            finding at arm's length across a noisy table - so it leads, and the table it
            belongs to sits beside it as the check that they picked the right one. */}
        <Surface className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-2xs font-medium tracking-wide text-muted uppercase">
                Your order number
              </span>
              <span className="text-4xl leading-tight font-semibold text-text tabular">
                #{placed.orderNumber}
              </span>
            </div>

            {table !== undefined && (
              <span className="shrink-0 rounded-full border border-border-strong px-2.5 py-1 text-2xs font-medium text-muted">
                {table.name}
              </span>
            )}
          </div>

          <p
            role="status"
            className="flex items-start gap-2 border-t border-border pt-3 text-sm font-medium text-success"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Your order is with {restaurant.restaurantName}.
          </p>
        </Surface>

        {/* What was ordered, and what it comes to. One card, because a guest checking
            the bill is checking it against the list directly above it. */}
        <Surface className="flex flex-col gap-4 p-5">
          <ul className="flex flex-col divide-y divide-border">
            {placed.lines.map((line, index) => (
              <li
                key={`${line.itemName}-${index}`}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span>
                    <span className="tabular text-muted">{line.quantity}×</span>{" "}
                    <span className="text-text">{line.itemName}</span>
                  </span>

                  {/* Read back, so a guest can see that what they asked for landed on
                      the dish they meant. The kitchen is told the same thing against
                      the same line; this is the guest's copy of it. */}
                  {line.note !== null && (
                    <span className="text-2xs text-muted italic">
                      “{line.note}”
                    </span>
                  )}

                  {/* Where this dish has got to, rather than where the order has.

                      A table ordering momo and samosa was told one thing about both,
                      and for the fifteen minutes between them that one thing was wrong
                      about half the order - either the samosa was still described as
                      cooking or the momo was described as ready. The timeline above
                      still answers "is my food coming"; this answers "which of it". */}
                  <DishProgress line={line} />
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

        </Surface>

        {/* Everything about where it has got to and what happens next. Split off the
            bill deliberately: one card answers "what did I order", this one answers
            "what is happening", and running the two together as a single column of
            eight blocks was what made this screen a wall. */}
        <Surface className="flex flex-col gap-4 p-5">
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

        </Surface>

        {/* What they can do from here. Last, and on its own, so the buttons are not
            competing with a total for the same glance. */}
        <Surface className="flex flex-col gap-2 p-5">
          <div className="flex flex-col gap-2">
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
      </>
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

  return (
    <>
      {/* The bar says which of the three things they are doing, and is the way back
          out of it.

          This is all the orientation the flow needed. It had a three segment progress
          header as well, and on a flow this short that was a second thing to read
          saying what the line above it already said - a diagram of a journey with two
          stops in it. The steps themselves stay; only the picture of them is gone. */}
      <TopBar
        slug={slug}
        restaurantName={restaurant.restaurantName}
        eyebrow={
          adding
            ? `Adding to order #${placed?.orderNumber}`
            : step === "table"
              ? "Choose your table"
              : step === "check"
                ? "Check your order"
                : (table?.name ?? "Order online")
        }
        backLabel={adding ? "Your order" : "Table"}
        onBack={
          adding
            ? () => setAdding(false)
            : step === "menu"
              ? // The only move the bar owns. Going back from the check step is the
                // "Add more" button on the card itself, which is where somebody
                // looking at their order would reach for it.
                () => setFlowStage("table")
              : undefined
        }
      />

      {/* The height of the bar above, published to anything inside that needs to stick
          below it - the composer's search and course strip, and the scroll offset that
          lands a course heading clear of both. */}
      <MotionConfig reducedMotion="user">
      <main
        style={{ "--bar-h": "3.75rem" } as React.CSSProperties}
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 pb-28"
      >
        {/* Asked first, and the menu waits behind it. Discovering at the checkout that
            your table is taken, with a basket already built, is the one bad moment
            this flow can have.

            Skipped entirely when adding: the table was decided when the order was
            opened and cannot move. */}
        <AnimatePresence initial={false} mode="popLayout">
        {step === "table" && (
          <motion.div
            key="table"
            // Leftmost of the three, so it arrives from the left and leaves to the
            // left whichever direction it is being moved through. See SWAP in the
            // composer for why no direction is tracked anywhere.
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
          <Surface className="flex flex-col gap-3 p-4">
            <div>
              <h2 className="text-base font-semibold text-text">
                Which table are you at?
              </h2>
              <p className="text-sm text-muted">
                So your food reaches you, and so the bill is on the right table.
              </p>
            </div>

            {/* Offered above the list rather than under it, because it is the better
                way to answer this question and somebody should meet it before they
                start guessing. The code on the table names that table and nothing
                else, so it cannot be got wrong - which is exactly what this list can
                be, silently, with somebody else's dinner. */}
            <p className="flex items-start gap-2 rounded-md border border-primary-border bg-primary-soft px-3 py-2 text-2xs text-primary">
              <QrCode className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Sitting down already? Scanning the code on your table picks it for you,
                and it is always the right one.
              </span>
            </p>

            {/* Names only. Capacity was on these and could not be acted on - somebody
                choosing here is already sitting somewhere, so how many it seats is a
                fact for whoever assigns tables, not for them. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {restaurant.tables.map((candidate) => {
                const chosen = candidate.id === tableId;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    // aria-disabled rather than disabled, deliberately. A disabled
                    // button leaves the tab order entirely, so somebody using a screen
                    // reader was never told these tables existed - and the note about
                    // what to do if yours is taken referred to something they could
                    // not perceive. This way it is announced, reachable, and tapping
                    // it opens the help that explains it.
                    aria-disabled={!candidate.isAvailable}
                    aria-pressed={chosen}
                    onClick={() => {
                      if (!candidate.isAvailable) {
                        setTableHelp(true);

                        return;
                      }

                      // Answering the question is the whole of the step, so it moves
                      // on. There was a Continue button under this, which asked for a
                      // second press to confirm something a tile press had already
                      // said - and the only reason it existed was that the menu used
                      // to appear underneath on the spot, which was the surprise a
                      // drawer springs. The menu is its own step with its own slide
                      // now, so a tap can go straight there.
                      setTableId(candidate.id);
                      setFlowStage("menu");
                    }}
                    className={cn(
                      "pressable flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors",
                      chosen
                        ? "border-primary bg-primary-soft text-primary"
                        : candidate.isAvailable
                          ? "border-border-strong text-text hover:bg-surface-3"
                          : "border-border border-dashed text-subtle hover:bg-surface-3",
                    )}
                  >
                    <span className="text-sm font-medium">{candidate.name}</span>

                    {/* Only the ones that cannot be chosen say anything, so the eye
                        goes to the exceptions rather than reading a label under every
                        tile that says the same thing. */}
                    {!candidate.isAvailable && (
                      <span className="text-2xs">in use</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* The honest answer to "I do not know". It cannot place the order without
                a table - an order belongs to one, all the way down to the bill - so
                this does not pretend to skip the question. It answers it. */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setTableHelp((open) => !open)}
                aria-expanded={tableHelp}
                className="pressable flex items-center gap-1.5 self-start rounded-md text-2xs font-medium text-primary hover:underline"
              >
                <Info className="size-3.5 shrink-0" aria-hidden="true" />
                I am not sure which table I am at
              </button>

              {tableHelp && (
                <div className="settle-in flex flex-col gap-2 rounded-md bg-surface-3 px-3 py-2.5 text-2xs text-muted">
                  <p>
                    <strong className="font-semibold text-text">
                      Look for a number on the table
                    </strong>{" "}
                    — usually on a small stand, or printed next to the code you would
                    scan.
                  </p>

                  <p>
                    <strong className="font-semibold text-text">
                      Scan that code instead
                    </strong>{" "}
                    and you will not have to know. It opens the menu with your table
                    already chosen.
                  </p>

                  <p>
                    <strong className="font-semibold text-text">
                      Yours shows as in use?
                    </strong>{" "}
                    Somebody is already ordering on it. If that was you, scan the code
                    on the table to pick your order back up rather than starting a
                    second one.
                  </p>

                  <p>
                    Still stuck, or the tables have no numbers — ask a member of staff.
                    They can see the room and will order for you.
                  </p>
                </div>
              )}
            </div>
          </Surface>
          </motion.div>
        )}
        </AnimatePresence>

        {adding && (
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="pressable flex w-full items-center gap-3 rounded-lg border border-primary-border bg-primary-soft px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
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

        {/* Paused rather than unmounted on the table step, and that is load-bearing:
            the basket lives inside this component, so taking it off the page to show
            an earlier step would throw away everything they had chosen. Going back to
            correct a table has to cost nothing.

            Paused, though, rather than merely hidden: the basket bar is portalled to
            the body now, and `display: none` on this wrapper would not reach it. A
            composer that renders nothing takes its bar with it. */}
        {hasTable && (
          <motion.div
            // Bound to the step rather than keyed on it. A key would remount the
            // composer and lose the basket, which is the one thing this must not do -
            // so the wrapper is told where to be and the composer simply stays.
            initial={false}
            animate={{
              opacity: step === "table" ? 0 : 1,
              x: step === "table" ? 24 : 0,
            }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <OrderComposer
              flow="steps"
              paused={step === "table"}
              menu={restaurant.menu}
              currency={money}
              onPlace={place}
              placing={placing}
              error={placeError}
              onStageChange={(reported) => setChecking(reported === "check")}
            />
          </motion.div>
        )}
      </main>
      </MotionConfig>
    </>
  );
}

/**
 * How far along one dish is.
 *
 * Only ever four words, and only when there is something to say. A guest reading a
 * receipt of five lines does not want five sentences - they want to find the one that
 * has arrived, which is why this is a coloured chip rather than prose.
 *
 * Silent for a line nobody has sent yet: "waiting to be sent" is already what the
 * receipt as a whole is saying at that point, and repeating it per line would put a
 * label on every row that carries no information.
 */
function DishProgress({ line }: { line: PublicOrder["lines"][number] }) {
  if (line.isServed) {
    return (
      <span className="flex items-center gap-1 text-2xs font-medium text-success">
        <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden="true" />
        At your table
      </span>
    );
  }

  if (line.isReady) {
    return (
      <span className="flex items-center gap-1 text-2xs font-medium text-warning">
        <UtensilsCrossed className="size-3 shrink-0" aria-hidden="true" />
        Ready — coming over
      </span>
    );
  }

  if (line.isSentToKitchen) {
    return (
      <span className="flex items-center gap-1 text-2xs text-muted">
        <ChefHat className="size-3 shrink-0" aria-hidden="true" />
        With the kitchen
      </span>
    );
  }

  return null;
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

/**
 * Asks a table's printed code what is running on it.
 *
 * Null for anything that is not a workable answer - no code, no order on that table,
 * or a restaurant that cannot be reached. Every caller treats null as "carry on
 * without one", because none of them can do anything useful about it and a guest is
 * better served by a menu than by an error about a scan.
 */
async function keyFromTable(
  slug: string,
  token: string | null,
): Promise<string | null> {
  if (token === null) {
    return null;
  }

  try {
    const where = await resolveScannedRestaurant(token);

    // A code from another restaurant is somebody scanning the wrong thing, or an
    // address that has been edited. It names an order, but not one on this page.
    return where.slug === slug ? where.runningOrderKey : null;
  } catch {
    return null;
  }
}

/**
 * The bar across the top of every state of this page.
 *
 * There was one of these, written inline, and only the menu had it. The receipt - the
 * screen a guest sits with for the rest of the meal - had no bar at all, which meant no
 * way back to the restaurant's site short of the browser's own button.
 *
 * The restaurant's name is the heading but no longer the loudest thing on the screen.
 * At the old size it truncated on any phone and shouted the one fact a guest already
 * knows, over the line that says which table they are at and what they are doing.
 *
 * Sticky, because on the menu it is the way back and the menu is long.
 */
function TopBar({
  slug,
  restaurantName,
  eyebrow,
  backLabel = "Back",
  onBack,
}: {
  slug: string;
  restaurantName: string;
  /** The small line above the name: the table, or what this screen is for. */
  eyebrow: string;
  /** What the in-page back control says. Ignored without `onBack`. */
  backLabel?: string;
  /** Set to send the back control somewhere inside the page instead of out of it. */
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {onBack === undefined ? (
          <Link
            href={`/r/${slug}`}
            aria-label="Back to the website"
            className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-3"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </button>
        )}

        <div className="min-w-0">
          <p className="truncate text-2xs font-medium tracking-wide text-muted uppercase">
            {eyebrow}
          </p>
          <h1 className="truncate text-lg leading-tight font-semibold text-text">
            {restaurantName}
          </h1>
        </div>
      </div>
    </header>
  );
}

/** Centres a column of panels, for the states with no menu on the page. */
function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
      {children}
    </main>
  );
}
