"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState, Spinner } from "@/components/ui/states";
import { getPublicRestaurant, placeWebsiteOrder } from "@/features/public/api";
import { OrderComposer, type OrderDraftLine } from "@/features/public/order-composer";
import { OrderSentOverlay } from "@/features/public/order-sent";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { PublicOrder, PublicRestaurant } from "@/types/public-ordering";

/**
 * Ordering from the restaurant's own website.
 *
 * The way in for somebody who found the restaurant rather than sat down in it. The one
 * difference from the code printed on a table is a single question: a scanned code
 * already says where the guest is, and this page has to ask.
 *
 * That question is asked first and deliberately holds back the menu. Choosing a table
 * after building a basket would mean discovering at the last step that the one you are
 * sitting at is taken, with an order already assembled.
 *
 * Choosing the food is `OrderComposer`, shared with the scanned pad, so improving one
 * improves both.
 */
export default function WebsiteOrderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tableId, setTableId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PublicOrder | null>(null);
  // Separate from the order itself, because the receipt should be built and
  // sitting there ready by the time the overlay clears, not assembling afterwards.
  const [celebrating, setCelebrating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPublicRestaurant(slug);

        if (!cancelled) {
          setRestaurant(loaded);
          setFailed(null);
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

  const place = useCallback(
    async (items: OrderDraftLine[]) => {
      setPlaceError(null);
      setPlacing(true);

      try {
        setPlaced(await placeWebsiteOrder(slug, { tableId, items }));
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
    [slug, tableId],
  );

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

  if (restaurant === null) {
    return (
      <Centre>
        <div className="flex justify-center py-12">
          <Spinner label="Loading the menu…" />
        </div>
      </Centre>
    );
  }

  // Sent. The page stops being a menu and becomes a receipt, because the only thing
  // that matters now is the number they quote to a member of staff.
  if (placed !== null) {
    return (
      <Centre>
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

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-text">Total</span>
            <span className="text-lg font-semibold text-text tabular">
              {placed.subtotal.toFixed(2)}
            </span>
          </div>

          <p className="text-sm text-muted">
            A member of staff will send it to the kitchen. Pay with them when you are
            finished, and quote order #{placed.orderNumber}.
          </p>

          <Button
            variant="secondary"
            onClick={() => {
              setPlaced(null);
              setReloadKey((key) => key + 1);
            }}
          >
            Order something else
          </Button>
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
  const hasTable = table !== undefined && table.isAvailable;

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href={`/r/${slug}`}
            aria-label="Back to the website"
            className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {hasTable ? table.name : "Order online"}
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
            this flow can have. */}
        <Surface className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-base font-semibold text-text">
              Which table are you at?
            </h2>
            <p className="text-sm text-muted">
              So your food reaches you. Ask a member of staff if you are not sure.
            </p>
          </div>

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

/** Centres a single panel, for the states with nothing else on the page. */
function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12">
      {children}
    </main>
  );
}
