import { apiFetch } from "@/lib/api/client";
import type {
  PlacePublicOrderPayload,
  ScannedTableRestaurant,
  PlaceWebsiteOrderPayload,
  PublicOrder,
  PublicRestaurant,
  PublicTable,
} from "@/types/public-ordering";

/**
 * Calls behind the code printed on a table, and from a restaurant own website.
 *
 * The scanned pad now needs a session: it is a member of staff standing at the table
 * with their own phone, not a guest ordering for themselves. So those two calls send
 * the access token like any other, and the table token in the URL narrows them to one
 * table rather than authorising them on its own.
 *
 * The rest stay `auth: false`, and not as an optimisation. A customer has no account,
 * so there is no token to attach; sending one would be worse than pointless, because a
 * manager signed in on the same phone would have their session travelling with every
 * scan.
 */

/**
 * Which restaurant a scanned table belongs to.
 *
 * Anonymous on purpose. It is what lets one printed code serve two people: staff get
 * the pad, and everybody else is redirected to this restaurant ordering page.
 */
export function resolveScannedRestaurant(
  token: string,
): Promise<ScannedTableRestaurant> {
  return apiFetch<ScannedTableRestaurant>(
    `/api/public/tables/${encodeURIComponent(token)}/restaurant`,
    { auth: false },
  );
}

/**
 * What the restaurant own website needs: the real menu, and the tables to pick from.
 *
 * Keyed by the public slug rather than a table token, because a customer reading a
 * website has not scanned anything.
 */
export function getPublicRestaurant(slug: string): Promise<PublicRestaurant> {
  return apiFetch<PublicRestaurant>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/menu`,
    { auth: false },
  );
}

/** Place an order from the website, on the table the customer chose. */
export function placeWebsiteOrder(
  slug: string,
  payload: PlaceWebsiteOrderPayload,
): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/orders`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    },
  );
}

/**
 * Call off an order the customer placed from the website.
 *
 * The key is the whole authority, which is why it never goes in the URL: a path is
 * what ends up in a server log, a browser history and a shared link, and this is the
 * one string that lets somebody cancel an order.
 */
export function cancelWebsiteOrder(
  slug: string,
  cancelKey: string,
): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/orders/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ cancelKey }),
      auth: false,
    },
  );
}

/** What the scanned page needs: where they are, the menu, and their order so far. */
export function getPublicTable(token: string): Promise<PublicTable> {
  return apiFetch<PublicTable>(
    `/api/public/tables/${encodeURIComponent(token)}`,
  );
}

/**
 * Place what the guest asked for.
 *
 * Adds to their existing order at this table when they already have one, so a second
 * round is one bill rather than two.
 */
export function placePublicOrder(
  token: string,
  payload: PlacePublicOrderPayload,
): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(
    `/api/public/tables/${encodeURIComponent(token)}/orders`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
