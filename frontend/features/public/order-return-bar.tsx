"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { lookupWebsiteOrder } from "@/features/public/api";
import { readHandle } from "@/features/public/order-handle";
import { ApiError } from "@/lib/api/client";
import type { PublicOrder } from "@/types/public-ordering";

/**
 * The way back to an order you already have.
 *
 * Without this a guest who wanders off the receipt - back to the menu, back to the
 * restaurant's homepage, or away and in again through a search - has nothing telling
 * them their order exists. The recovery worked, but only if they happened to navigate to
 * the ordering page and trust that it would remember. Nobody trusts that, so they sit
 * and wait for a waiter instead.
 *
 * Fixed to the bottom of the screen, because a phone is scrolled and a link at the top
 * of a long marketing page is a link nobody sees. It shows what they owe, which is the
 * fact that makes it worth tapping.
 *
 * Renders nothing at all for the overwhelming majority of visitors, who are strangers
 * with no order. The check costs one read of local storage; only somebody holding a key
 * causes a request.
 */
export function OrderReturnBar({ slug }: { slug: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function look() {
      const handle = readHandle(slug);

      if (handle.orderKey === null) {
        return;
      }

      try {
        const found = await lookupWebsiteOrder(slug, handle.orderKey);

        if (!cancelled) {
          setOrder(found);
        }
      } catch (caught) {
        // A 404 means the key names nothing here any more. Anything else means the
        // request failed, and neither is worth telling somebody browsing a menu about -
        // the bar simply does not appear.
        //
        // Deliberately does not clear the stored key on a 404. Only the ordering page
        // does that, because it is the page that can explain what happened; a marketing
        // page quietly throwing away somebody's order would be the same bug this whole
        // feature exists to fix.
        if (!(caught instanceof ApiError)) {
          return;
        }
      }
    }

    void look();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (order === null) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <Link
        href={`/r/${slug}/order`}
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-primary-border bg-surface p-3 shadow-lg transition-colors hover:bg-primary-soft"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          <ReceiptText className="size-4" />
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-text">
            Your order #{order.orderNumber} is running
          </span>
          <span className="text-2xs text-muted">
            {order.billRequestedAtUtc === null
              ? "Tap to follow it or ask for the bill"
              : "A member of staff is on their way with your bill"}
          </span>
        </span>

        <span className="ml-auto shrink-0 text-sm font-semibold text-text tabular">
          {order.total.toFixed(2)}
        </span>
      </Link>
    </div>
  );
}
