import { apiFetch } from "@/lib/api/client";
import type {
  PlacePublicOrderPayload,
  PublicOrder,
  PublicTable,
} from "@/types/public-ordering";

/**
 * Calls a guest makes from the code on their table.
 *
 * `auth: false` on both, and not as an optimisation. A guest has no account, so there
 * is no token to attach; sending one would be worse than pointless, because a manager
 * who happened to be signed in on the same phone would have their session travelling
 * with every scan. The token in the URL is the entire credential, and it authorises
 * exactly one table.
 */

/** What the scanned page needs: where they are, the menu, and their order so far. */
export function getPublicTable(token: string): Promise<PublicTable> {
  return apiFetch<PublicTable>(
    `/api/public/tables/${encodeURIComponent(token)}`,
    { auth: false },
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
      auth: false,
    },
  );
}
