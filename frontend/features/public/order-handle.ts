import { readReceipt, writeReceipt } from "@/features/public/receipt-store";

/**
 * Keeping hold of which order is yours.
 *
 * A customer has no account, so the only thing that says "this order is mine" is the key
 * handed back when they placed it. Everything here exists to make losing that key hard,
 * because a lost key means a guest sitting in front of their food with no idea whether
 * the restaurant heard them and no way to add to the order.
 *
 * Three places hold it, and they fail in different ways on purpose:
 *
 *   the address bar   survives a closed tab, a crash, and cleared site data, and can be
 *                     re-opened from history or sent to somebody at the same table
 *   local storage     survives following a link away and coming back, and works when
 *                     the address was retyped without the query string
 *   the printed code  survives everything, including a different phone entirely - the
 *                     table's own code hands back whatever order is running on it
 *
 * No one of them is enough. Storage is cleared by a browser reclaiming space, an address
 * is lost when a tab is closed from a crash report, and a code cannot be scanned by
 * somebody who has gone home. Together they cover every way this has actually been seen
 * to break.
 *
 * Deliberately not the customer's network address, which cannot do this job: every phone
 * on a restaurant's wifi shares one, so it identifies the building rather than the table.
 */

/** The query parameter carrying the key. Short, because it is visible in the bar. */
export const ORDER_KEY_PARAM = "k";

/** The query parameter carrying the table, written when a code is scanned. */
export const TABLE_PARAM = "table";

/**
 * The query parameter carrying the code printed on the table.
 *
 * Kept for the life of the visit rather than spent once at the scan. Resolving it
 * returns whatever order is open on that table right now, so a page holding it can ask
 * again later - which is the whole difference between a scan that worked and a scan
 * that happened to be early.
 */
export const TABLE_TOKEN_PARAM = "t";

/**
 * Everything the page can work out about which order belongs to this visitor, before
 * it has spoken to the server.
 */
export interface OrderHandle {
  /** The key, from wherever it was found. Null when there is nothing to go on. */
  orderKey: string | null;
  /** The table, when the address named one. */
  tableId: string | null;
  /**
   * The code printed on the table, when they got here by scanning it.
   *
   * Evidence of being at the table, which the table's identifier is not. It is what
   * lets a second phone - or the same phone after a flat battery - pick up an order
   * somebody else at the table started, including one a waiter took.
   */
  tableToken: string | null;
}

/**
 * Reads the key and table out of the address and storage.
 *
 * The address wins over storage. Somebody who has just followed a link, or scanned the
 * code on a table, is telling the page which order they mean - and that is newer
 * information than whatever this browser happened to remember from earlier.
 */
export function readHandle(slug: string): OrderHandle {
  let fromUrl: string | null = null;
  let table: string | null = null;
  let token: string | null = null;

  try {
    const params = new URLSearchParams(window.location.search);

    fromUrl = params.get(ORDER_KEY_PARAM);
    table = params.get(TABLE_PARAM);
    token = params.get(TABLE_TOKEN_PARAM);
  } catch {
    // No window, or an address the URL parser refuses. Storage still works.
  }

  const saved = readReceipt(slug);

  return {
    orderKey: fromUrl ?? saved?.order.orderKey ?? null,
    tableId: table ?? saved?.tableId ?? null,
    tableToken: token ?? saved?.tableToken ?? null,
  };
}

/**
 * Puts the key in the address bar without adding a history entry.
 *
 * Replaced rather than pushed, so the back button still goes back to the menu rather
 * than stepping through one entry per order. The address is the copy that survives a
 * tab being closed, which is the failure this is here for.
 */
export function rememberInUrl(
  orderKey: string,
  tableId: string,
  tableToken: string | null,
): void {
  try {
    const url = new URL(window.location.href);

    url.searchParams.set(ORDER_KEY_PARAM, orderKey);
    url.searchParams.set(TABLE_PARAM, tableId);

    if (tableToken !== null) {
      url.searchParams.set(TABLE_TOKEN_PARAM, tableToken);
    }

    window.history.replaceState(null, "", url.toString());
  } catch {
    // Some in-app browsers refuse replaceState. Storage and the printed code remain.
  }
}

/** Takes the key back out of the address, for when the order is finished with. */
export function forgetInUrl(): void {
  try {
    const url = new URL(window.location.href);

    url.searchParams.delete(ORDER_KEY_PARAM);
    url.searchParams.delete(TABLE_PARAM);
    url.searchParams.delete(TABLE_TOKEN_PARAM);

    window.history.replaceState(null, "", url.toString());
  } catch {
    // As above.
  }
}

/** Saves the receipt and mirrors the key into the address, in one call. */
export function remember(
  slug: string,
  order: { orderKey: string | null },
  tableId: string,
  tableToken: string | null,
): void {
  // The store takes the whole order; this module only ever cares about the key.
  writeReceipt(
    slug,
    order as Parameters<typeof writeReceipt>[1],
    tableId,
    tableToken,
  );

  if (order.orderKey !== null && tableId !== "") {
    rememberInUrl(order.orderKey, tableId, tableToken);
  }
}
