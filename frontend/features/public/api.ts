import { apiFetch } from "@/lib/api/client";
import type {
  CustomerReview,
  PlacePublicOrderPayload,
  ScannedTableRestaurant,
  PlaceWebsiteOrderPayload,
  PublicOrder,
  PublicRestaurant,
  PublicTable,
  SubmitReviewPayload,
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

/**
 * Place an order from the website, or add to one they already have.
 *
 * One call for both, because to a customer they are the same act. Passing `orderKey`
 * is what makes it an addition; without it the table has to be free.
 *
 * The key never goes in the URL. A path ends up in a server log, a browser history and
 * a shared link, and this is the one string that stands for "this is my order".
 */
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
 * Read back an order from the key the customer holds.
 *
 * What turns a recovered key into a receipt. It is also what makes the receipt current
 * rather than merely remembered: the copy on the phone is a snapshot from whenever it
 * was written, and this is what the restaurant says now.
 *
 * A POST because the key travels in the body, never a path - a path ends up in a server
 * log and a browser history.
 */
export function lookupWebsiteOrder(
  slug: string,
  orderKey: string,
): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/orders/lookup`,
    {
      method: "POST",
      body: JSON.stringify({ orderKey }),
      auth: false,
    },
  );
}

/**
 * Ask a waiter to bring the bill.
 *
 * Recorded against the order as well as announced to the floor, so a waiter who was
 * carrying plates at that moment still finds the table waiting. Asking twice is not an
 * error and does not restart the wait.
 */
export function requestBill(
  slug: string,
  orderKey: string,
): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/orders/bill-request`,
    {
      method: "POST",
      body: JSON.stringify({ orderKey }),
      auth: false,
    },
  );
}

/**
 * Leave a review for a visit that has been paid for.
 *
 * Authorised by the key from that order, which is what makes the review evidence of a
 * meal rather than an opinion from nowhere - and why there is no sign-in behind it.
 */
export function submitReview(
  slug: string,
  payload: SubmitReviewPayload,
): Promise<CustomerReview> {
  return apiFetch<CustomerReview>(
    `/api/public/restaurants/${encodeURIComponent(slug)}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(payload),
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
