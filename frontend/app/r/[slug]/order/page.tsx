"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChefHat, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { EmptyState, FormError, Spinner } from "@/components/ui/states";
import { getPublicRestaurant, placeWebsiteOrder } from "@/features/public/api";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type {
  PublicMenuItem,
  PublicOrder,
  PublicRestaurant,
} from "@/types/public-ordering";

/**
 * Ordering from the restaurant's own website.
 *
 * The second way into ordering, beside the code printed on a table, and the one for
 * somebody who found the restaurant rather than sat down in it. The difference is a
 * single question: a scanned code already says which table the guest is at, and this
 * page has to ask.
 *
 * That question is asked first and deliberately blocks the menu until it is answered.
 * Choosing a table after building a basket would mean discovering at the last step
 * that the table you are sitting at is taken, with an order already assembled.
 *
 * Everything else matches the scanned page, because it is the same product to the
 * same person: no account, no payment, thumb-sized controls, and the plain statement
 * that a member of staff still has to send the order to the kitchen.
 */
export default function WebsiteOrderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const [tableId, setTableId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PublicOrder | null>(null);
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

  const items = useMemo(() => {
    const byId = new Map<string, PublicMenuItem>();

    for (const section of restaurant?.menu ?? []) {
      for (const item of section.items) {
        byId.set(item.id, item);
      }
    }

    return byId;
  }, [restaurant]);

  const chosen = Object.entries(quantities).filter(([, quantity]) => quantity > 0);

  const chosenCount = chosen.reduce((total, [, quantity]) => total + quantity, 0);

  const chosenTotal = chosen.reduce((total, [id, quantity]) => {
    return total + (items.get(id)?.price ?? 0) * quantity;
  }, 0);

  function adjust(id: string, by: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(99, (current[id] ?? 0) + by)),
    }));
  }

  async function submit() {
    setPlaceError(null);
    setPlacing(true);

    try {
      const order = await placeWebsiteOrder(slug, {
        tableId,
        items: chosen.map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
          // One note for the whole order, repeated onto each line. Nobody on a phone
          // fills in six separate note boxes, and the kitchen reads it per line.
          note: note.trim() === "" ? null : note.trim(),
        })),
      });

      setPlaced(order);
      setQuantities({});
      setNote("");
    } catch (caught) {
      setPlaceError(
        caught instanceof ApiError
          ? caught.message
          : "We could not send your order. Please try again, or ask a member of staff.",
      );

      // A refused table is the likely failure, and the list of free tables has moved
      // on since the page loaded. Refetching is what makes the message actionable.
      setReloadKey((key) => key + 1);
    } finally {
      setPlacing(false);
    }
  }

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

  // Placed. The page stops being a menu and becomes a receipt, because the one thing
  // that matters now is the number they quote to a member of staff.
  if (placed !== null) {
    return (
      <Centre>
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
              Order online
            </p>
            <h1 className="truncate text-2xl font-semibold text-text">
              {restaurant.restaurantName}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 pb-40">
        {/* Asked first, and the menu stays behind it. Discovering at the checkout that
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
                  {candidate.isAvailable
                    ? `seats ${candidate.capacity}`
                    : "in use"}
                </span>
              </button>
            ))}
          </div>
        </Surface>

        {!hasTable ? (
          <p className="px-1 text-sm text-muted">
            Pick your table above to see the menu.
          </p>
        ) : restaurant.menu.length === 0 ? (
          <Surface>
            <EmptyState
              icon={<UtensilsCrossed />}
              title="Nothing on the menu yet"
              description="Please order with a member of staff."
            />
          </Surface>
        ) : (
          restaurant.menu.map((section) => (
            <Surface key={section.name} className="overflow-hidden">
              <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text">
                {section.name}
              </h2>

              <ul className="flex flex-col divide-y divide-border">
                {section.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    {item.imageUrl !== null && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={apiAssetSrc(item.imageUrl)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-20 shrink-0 rounded-md border border-border object-cover"
                      />
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-base font-medium text-text">{item.name}</p>
                      {item.description !== null && (
                        <p className="text-sm text-muted">{item.description}</p>
                      )}
                      <p className="text-sm tabular text-text">
                        {item.price.toFixed(2)}
                      </p>
                    </div>

                    <Stepper
                      quantity={quantities[item.id] ?? 0}
                      label={item.name}
                      onAdjust={(by) => adjust(item.id, by)}
                    />
                  </li>
                ))}
              </ul>
            </Surface>
          ))
        )}
      </main>

      {hasTable && chosenCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
            {placeError !== null && <FormError message={placeError} />}

            <p className="flex items-center gap-1.5 text-xs text-muted">
              <ChefHat className="size-3.5 shrink-0" aria-hidden="true" />
              Staff send this to the kitchen. Pay with them at the end.
            </p>

            <Textarea
              rows={2}
              maxLength={200}
              aria-label="Anything we should know"
              placeholder="Anything we should know? No ice, no nuts, extra spicy…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <Button
              size="md"
              className="h-11 w-full text-base"
              disabled={placing}
              onClick={() => void submit()}
            >
              {placing
                ? "Sending…"
                : `Order ${chosenCount} ${
                    chosenCount === 1 ? "item" : "items"
                  } to ${table.name} · ${chosenTotal.toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}
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

/**
 * Plus and minus with a count between them.
 *
 * The same control as the scanned page, at the same size, because it is the same
 * person on the same phone. The minus disappears at zero rather than sitting there
 * disabled, so there is only ever one obvious thing to press on an untouched item.
 */
function Stepper({
  quantity,
  label,
  onAdjust,
}: {
  quantity: number;
  label: string;
  onAdjust: (by: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {quantity > 0 && (
        <>
          <button
            type="button"
            aria-label={`One fewer ${label}`}
            className="flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface text-text transition-colors hover:bg-surface-3"
            onClick={() => onAdjust(-1)}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>

          <span
            aria-live="polite"
            className="w-6 text-center text-base font-semibold text-text tabular"
          >
            {quantity}
          </span>
        </>
      )}

      <button
        type="button"
        aria-label={`One more ${label}`}
        className="flex size-9 items-center justify-center rounded-md border border-primary-solid bg-primary-solid text-primary-fg transition-colors hover:bg-primary-hover"
        onClick={() => onAdjust(1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
