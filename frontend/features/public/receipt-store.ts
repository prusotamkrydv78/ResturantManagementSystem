import type { PublicOrder } from "@/types/public-ordering";

/**
 * The customer's own copy of the order they just placed.
 *
 * Without this the receipt lives in React state and nothing else, which means a pulled
 * refresh, a phone locking, or a browser reclaiming a backgrounded tab loses it. That
 * costs the order number they were told to quote, and - worse - the cancel key, which
 * the server hands out exactly once and never returns on a read. Losing it takes away a
 * cancellation the customer was still entitled to make, with no way to get it back.
 *
 * Kept per restaurant, because somebody can plausibly have an order at two of them and
 * the second should not overwrite the first.
 *
 * Deliberately only what the receipt needs. This is a customer's phone, not a store of
 * record: the restaurant holds the order, and everything here is recoverable from it
 * except the key.
 */

/** How long a saved receipt stays interesting. */
const LIFETIME_MS = 12 * 60 * 60 * 1000;

const PREFIX = "rms.receipt.";

/** A placed order as the phone remembers it. */
export interface StoredReceipt {
  order: PublicOrder;
  /**
   * The table it was placed on.
   *
   * Kept because the order itself does not carry it - a customer's own order
   * deliberately holds no identifiers - and adding a second round has to name the same
   * table. Without this, a phone that reloaded could follow its order but not add to
   * it.
   */
  tableId: string;
  /** When this was written, so a stale one can be ignored rather than shown. */
  savedAtMs: number;
}

function keyFor(slug: string): string {
  return `${PREFIX}${slug}`;
}

/**
 * Reads back a saved receipt, or null.
 *
 * Returns null for anything it cannot trust: storage that throws, JSON that does not
 * parse, a shape that has changed since it was written, or a receipt old enough that
 * showing it would be confusing. A customer seeing no receipt is a much smaller problem
 * than one seeing yesterday's.
 */
export function readReceipt(slug: string): StoredReceipt | null {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));

    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    // Written by an older version of this page, or by nothing at all. Checked rather
    // than trusted, because everything below reads fields off it.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("order" in parsed) ||
      !("savedAtMs" in parsed) ||
      typeof (parsed as StoredReceipt).savedAtMs !== "number" ||
      typeof (parsed as StoredReceipt).order?.orderNumber !== "number"
    ) {
      clearReceipt(slug);

      return null;
    }

    const stored = parsed as StoredReceipt;

    if (Date.now() - stored.savedAtMs > LIFETIME_MS) {
      clearReceipt(slug);

      return null;
    }

    return stored;
  } catch {
    // A private window, storage turned off, or a quota error. The page works without
    // this; it just forgets.
    return null;
  }
}

/** Saves the receipt, replacing whatever was there for this restaurant. */
export function writeReceipt(
  slug: string,
  order: PublicOrder,
  tableId: string,
): void {
  try {
    window.localStorage.setItem(
      keyFor(slug),
      JSON.stringify({ order, tableId, savedAtMs: Date.now() }),
    );
  } catch {
    // Nothing to do and nothing worth telling the customer. Failing to remember an
    // order must not stop them placing one.
  }
}

/** Forgets the receipt, for when they start something new. */
export function clearReceipt(slug: string): void {
  try {
    window.localStorage.removeItem(keyFor(slug));
  } catch {
    // As above.
  }
}
