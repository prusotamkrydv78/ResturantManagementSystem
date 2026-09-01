"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChefHat, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { EmptyState, FormError, Spinner } from "@/components/ui/states";
import { getPublicTable, placePublicOrder } from "@/features/public/api";
import { apiAssetSrc } from "@/lib/api/asset-url";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { PublicMenuItem, PublicTable } from "@/types/public-ordering";

/**
 * Ordering from the code on a table.
 *
 * The one page in this product with no account behind it, which changes almost every
 * decision on it. A guest arrives on a phone, in a restaurant, with one hand free, and
 * has never seen this before: so there is no navigation, no sign-in, no jargon, nothing
 * to learn, and every control is thumb-sized.
 *
 * What they are told is deliberately limited to their own table. The link carries the
 * whole permission, and this page never asks for a restaurant, a table or an order by
 * identifier, because it has none to ask with.
 *
 * Nothing here reaches the kitchen on its own. What a guest orders arrives as an
 * ordinary order that staff send through, which is said plainly on the page rather than
 * left as a surprise: somebody at the table needs to know their food is not yet cooking.
 */
export default function PublicOrderingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [table, setTable] = useState<PublicTable | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [justOrdered, setJustOrdered] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getPublicTable(token);

        if (!cancelled) {
          setTable(loaded);
          setFailed(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setTable(null);
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
  }, [token, reloadKey]);

  const chosen = useMemo(
    () => Object.entries(quantities).filter(([, quantity]) => quantity > 0),
    [quantities],
  );

  const items = useMemo(() => {
    const byId = new Map<string, PublicMenuItem>();

    for (const section of table?.menu ?? []) {
      for (const item of section.items) {
        byId.set(item.id, item);
      }
    }

    return byId;
  }, [table]);

  const chosenTotal = chosen.reduce((total, [id, quantity]) => {
    const price = items.get(id)?.price ?? 0;

    return total + price * quantity;
  }, 0);

  const chosenCount = chosen.reduce((total, [, quantity]) => total + quantity, 0);

  function adjust(id: string, by: number) {
    setJustOrdered(false);
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, (current[id] ?? 0) + by));

      return { ...current, [id]: next };
    });
  }

  async function submit() {
    setPlaceError(null);
    setPlacing(true);

    try {
      await placePublicOrder(token, {
        items: chosen.map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
          // One note for the whole request, repeated onto each line. A guest on a
          // phone will not fill in six separate note boxes, and the kitchen reads
          // the note per line anyway.
          note: note.trim() === "" ? null : note.trim(),
        })),
      });

      setQuantities({});
      setNote("");
      setJustOrdered(true);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setPlaceError(
        caught instanceof ApiError
          ? caught.message
          : "We could not send your order. Please try again, or ask a member of staff.",
      );
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
            title="This link is not working"
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

  if (table === null) {
    return (
      <Centre>
        <div className="flex justify-center py-12">
          <Spinner label="Loading the menu…" />
        </div>
      </Centre>
    );
  }

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-0.5 px-4 py-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {table.tableName}
          </p>
          <h1 className="text-2xl font-semibold text-text">{table.restaurantName}</h1>
        </div>
      </header>

      {/* Room at the bottom for the order bar, which is fixed over the menu. */}
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 pb-40">
        {justOrdered && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-success-border bg-success-soft px-3 py-2.5 text-sm text-success"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Your order is with the restaurant. A member of staff will send it to the
              kitchen.
            </span>
          </p>
        )}

        {table.currentOrder !== null && (
          <Surface className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text">
                Your order · #{table.currentOrder.orderNumber}
              </h2>
              {table.currentOrder.awaitingKitchenCount > 0 ? (
                <Badge tone="warning" dot>
                  {table.currentOrder.awaitingKitchenCount} waiting to go to the kitchen
                </Badge>
              ) : (
                <Badge tone="success" dot>
                  <ChefHat className="size-3" aria-hidden="true" />
                  With the kitchen
                </Badge>
              )}
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {table.currentOrder.lines.map((line, index) => (
                <li
                  key={`${line.itemName}-${index}`}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="tabular text-muted">{line.quantity}×</span>{" "}
                    <span className="text-text">{line.itemName}</span>
                    {line.note !== null && (
                      <span className="block text-xs text-muted">{line.note}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular text-text">
                    {line.lineTotal.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-text">So far</span>
              <span className="text-lg font-semibold text-text tabular">
                {table.currentOrder.subtotal.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-muted">
              Pay with a member of staff when you are finished. Quote order #
              {table.currentOrder.orderNumber}.
            </p>
          </Surface>
        )}

        {!table.canOrder && (
          <Surface className="p-4">
            <p className="text-sm text-text">
              {table.unavailableReason ??
                "Ordering is not available at this table right now."}
            </p>
          </Surface>
        )}

        {table.canOrder && table.menu.length === 0 && (
          <Surface>
            <EmptyState
              icon={<UtensilsCrossed />}
              title="Nothing on the menu yet"
              description="Please ask a member of staff."
            />
          </Surface>
        )}

        {table.canOrder &&
          table.menu.map((section) => (
            <Surface key={section.name} className="overflow-hidden">
              {/* A section photograph when there is one, with the name laid over it.
                  Scrolling a long menu on a phone is mostly a search for the right
                  heading, and a picture is found faster than a line of text. */}
              {section.imageUrl === null ? (
                <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text">
                  {section.name}
                </h2>
              ) : (
                <div className="relative isolate flex h-28 items-end border-b border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={apiAssetSrc(section.imageUrl)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 -z-10 size-full object-cover"
                  />
                  {/* Darkened from the bottom only, so the half carrying the name is
                      readable without dulling the whole picture. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 to-black/10"
                  />
                  <h2 className="px-4 py-2.5 text-base font-semibold text-white">
                    {section.name}
                  </h2>
                </div>
              )}

              <ul className="flex flex-col divide-y divide-border">
                {section.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    {/* Only shown when the restaurant has added one. A placeholder
                        beside every dish would be a page of grey boxes, which reads
                        worse than a plain list of names. */}
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
          ))}
      </main>

      {table.canOrder && chosenCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
            {placeError !== null && <FormError message={placeError} />}

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
                : `Order ${chosenCount} ${chosenCount === 1 ? "item" : "items"} · ${chosenTotal.toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Centres a single panel, for the states that have nothing else on the page. */
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
 * Bigger than the buttons anywhere else in the product, because this one is pressed
 * with a thumb by somebody holding a phone in a busy room. The minus disappears at zero
 * rather than sitting there disabled, so there is only ever one obvious thing to press
 * on an item nobody has chosen.
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
            className={cn(
              "flex size-9 items-center justify-center rounded-md",
              "border border-border-strong bg-surface text-text",
              "transition-colors hover:bg-surface-3",
            )}
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
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          "border border-primary-solid bg-primary-solid text-primary-fg",
          "transition-colors hover:bg-primary-hover",
        )}
        onClick={() => onAdjust(1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
