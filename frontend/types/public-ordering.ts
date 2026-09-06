/**
 * What a guest sees after scanning the code on their table.
 *
 * Nothing here carries an identifier except the menu item ids an order has to name.
 * No order id, no table id, no restaurant id: every action goes through the token in
 * the link, so a public page has nothing it could leak and nothing it could be talked
 * into substituting.
 */

/** A menu item as a guest sees it. */
export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  /** For display. The server prices the order again from its own menu. */
  price: number;
  /** The dish photograph, or null when the restaurant has not added one. */
  imageUrl: string | null;
}

/** A course or section of the menu. */
export interface PublicMenuSection {
  name: string;
  items: PublicMenuItem[];
  /** The photograph heading the section, or null. */
  imageUrl: string | null;
}

/** One line of a guest own order. */
export interface PublicOrderLine {
  itemName: string;
  quantity: number;
  note: string | null;
  lineTotal: number;
  /** Whether the kitchen has been told about this line yet. */
  isSentToKitchen: boolean;
}

/** A guest own order at the table. */
export interface PublicOrder {
  /** What to say to a member of staff. The only number a guest is given. */
  orderNumber: number;
  lines: PublicOrderLine[];
  itemCount: number;
  /** What the food came to, before anything is added. Never the amount to pay. */
  subtotal: number;
  serviceChargeAmount: number;
  vatAmount: number;
  /**
   * What the table owes, and the only figure to put in front of a guest.
   *
   * The receipt used to show the subtotal under the word "Total", which understated
   * every bill by the tax and the service charge.
   */
  total: number;
  /** When they asked to pay, or null. Survives a reload, so the page stays honest. */
  billRequestedAtUtc: string | null;
  /** Whether asking for the bill would do anything now. */
  canRequestBill: boolean;
  /**
   * Whether the bill has been paid and the visit is over.
   *
   * Told apart from an order that was called off, because both stop the timeline and
   * only one of them is worth thanking somebody for.
   */
  isSettled: boolean;
  /**
   * Whether they can still say what they thought.
   *
   * Decided by the restaurant, so a phone that has been shut since the meal does not
   * offer a form that would be refused.
   */
  canReview: boolean;
  awaitingKitchenCount: number;
  placedAtUtc: string;
  /**
   * Whether the customer may still add to this order themselves.
   *
   * True until any part of it goes to the kitchen. After that a second round has to be
   * a conversation with a waiter, so that somebody knows to send it.
   */
  canAddMore: boolean;
  /**
   * What to send back to add to this order, or null.
   *
   * Given in the response to placing an order and to adding to one, and never on a
   * read - a page that could read it back for any order would be able to change other
   * people's.
   */
  orderKey: string | null;
}

/** Everything the scanned page needs, in one response. */
export interface PublicTable {
  restaurantName: string;
  /** The ISO code every amount on this pad is in. One per restaurant. */
  currency: string;
  tableName: string;
  /** False while a member of staff is running an order on this table. */
  canOrder: boolean;
  /** What to tell the guest when they cannot order. Null when they can. */
  unavailableReason: string | null;
  menu: PublicMenuSection[];
  /** Their own order, if they have started one. */
  currentOrder: PublicOrder | null;
}

/**
 * Which restaurant a printed table code belongs to.
 *
 * The only thing about a scanned code still answered without a session. It exists so a
 * customer who scans a table can be sent to that restaurant ordering page, which the
 * browser cannot work out on its own.
 */
export interface ScannedTableRestaurant {
  slug: string;
  restaurantName: string;
  /**
   * The key for the order already running on this table, or null.
   *
   * How somebody who lost their place gets it back. A phone that cleared its storage
   * or ran out of battery still has the printed code on the table, and that code names
   * exactly one order.
   */
  runningOrderKey: string | null;
  /**
   * The table the printed code belongs to.
   *
   * The whole point of scanning rather than typing an address: the code already says
   * where the customer is sitting, so the ordering page should not ask them again.
   */
  tableId: string;
  /** What that table is called in the room. */
  tableName: string;
}

/**
 * What a customer thought of their visit.
 *
 * Anonymous, like everything else on this side: it carries scores and words, and
 * nothing about who left them.
 */
export interface CustomerReview {
  /** How the visit was overall, one to five. */
  rating: number;
  /** The food, or null if they did not say. */
  foodRating: number | null;
  /** The service, or null if they did not say. */
  serviceRating: number | null;
  comment: string | null;
  submittedAtUtc: string;
}

/** What a customer is submitting. */
export interface SubmitReviewPayload {
  orderKey: string;
  rating: number;
  foodRating?: number;
  serviceRating?: number;
  comment?: string;
}

/** A table a customer may say they are sitting at. */
export interface PublicTableChoice {
  id: string;
  name: string;
  capacity: number;
  /** False when an order is already running on it, so it cannot be chosen. */
  isAvailable: boolean;
}

/**
 * What the restaurant own website needs to take an order.
 *
 * The menu here is the real one, priced from the menu records - not the menu a manager
 * types into their site content, which is prose with free-text prices and no
 * identifiers, so nothing in it could ever be ordered.
 */
export interface PublicRestaurant {
  restaurantName: string;
  /** The ISO code every amount on this page is in. One per restaurant. */
  currency: string;
  menu: PublicMenuSection[];
  tables: PublicTableChoice[];
  /** False when no table is open to ordering at all. */
  isAcceptingOrders: boolean;
}

/**
 * Payload for ordering from the website.
 *
 * Carries a table, which the scanned request does not: a code says where the guest is,
 * and somebody on a website has to be asked. Still no prices and no total.
 */
export interface PlaceWebsiteOrderPayload {
  tableId: string;
  items: PublicOrderLinePayload[];
  /**
   * The key from an order they already have at this table, for a second round.
   *
   * Omitted for a first order, where the table has to be free. Sending it is what
   * tells the person who started that order from a stranger claiming the table.
   */
  orderKey?: string;
}

/** One line a guest is asking for. */
export interface PublicOrderLinePayload {
  menuItemId: string;
  quantity: number;
  note?: string | null;
}

/**
 * Payload for placing an order. No table, no restaurant, no prices and no total: the
 * table comes from the link and every amount is calculated by the server.
 */
export interface PlacePublicOrderPayload {
  items: PublicOrderLinePayload[];
}
